"""Core banking adapters that are configured, not coded, per bank.

Two ways a bank can let HPMS read its loan accounts:

``FileExtractAdapter``
    The bank schedules an end-of-day extract (delimited text) into a directory HPMS can read,
    typically an SFTP drop. Needs no API on the bank's side, so it is the quickest to stand up.

``HttpAdapter``
    HPMS asks the bank's API gateway / middleware for one account at a time. The request is a
    template and the response (JSON or XML) is read by path, so the same class serves a REST
    service and an XML inquiry service.

Both are driven by a mapping file (JSON) that says where each HPMS field is found in the bank's
data, how dates and signs are written, and what the status codes mean. Bringing on another bank,
or another core banking product, is a new mapping file.

A field the bank does not supply is ``None`` on the record, and the sync services leave the
local value alone. HPMS never writes to the core banking system.
"""

import csv
import json
import logging
import uuid
from dataclasses import dataclass, field, fields
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .finacle_adapter import FinacleAdapterBase
from .finacle_schema import FinacleAccountRecord, FinacleFieldMapping, FinacleSyncRequest, FinacleSyncResponse

logger = logging.getLogger(__name__)

RECORD_FIELDS = {f.name for f in fields(FinacleAccountRecord)}
DECIMAL_FIELDS = {"sanctioned_amount", "disbursed_amount", "outstanding_principal", "outstanding_interest",
                  "overdue_principal", "overdue_interest", "interest_rate_pct", "collateral_value"}
DATE_FIELDS = {"rate_reset_date", "sanction_date", "disbursement_date", "moratorium_end_date", "maturity_date"}
REQUIRED_FIELDS = ("finacle_account_id", "outstanding_principal")
MAX_EXTRACT_BYTES = 200 * 1024 * 1024


class CBSMappingError(ValueError):
    """The mapping file is unusable, or the bank's data does not fit it."""


@dataclass(frozen=True)
class CBSMapping:
    """Where each HPMS loan field is found in one bank's data."""

    name: str
    fields: Dict[str, str]  # HPMS field -> column name (file) or path (HTTP)
    date_formats: tuple = ("%Y-%m-%d",)
    negate: frozenset = frozenset()  # amounts the bank reports with the opposite sign (debit balances)
    defaults: Dict[str, Any] = field(default_factory=dict)
    status_values: Dict[str, str] = field(default_factory=dict)  # bank's code -> ACTIVE / CLOSED / ...
    thousands_separator: str = ","
    file: Dict[str, Any] = field(default_factory=dict)
    http: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CBSMapping":
        mapped = data.get("fields")
        if not isinstance(mapped, dict) or not mapped:
            raise CBSMappingError("mapping needs a non-empty 'fields' object")
        named = set(mapped) | set(data.get("defaults", {})) | set(data.get("negate", []))
        unknown = sorted(named - RECORD_FIELDS)
        if unknown:
            raise CBSMappingError(f"mapping names fields HPMS does not have: {', '.join(unknown)}")
        missing = [name for name in REQUIRED_FIELDS if name not in mapped]
        if missing:
            raise CBSMappingError(f"mapping must say where to find: {', '.join(missing)}")
        not_amounts = sorted(set(data.get("negate", [])) - DECIMAL_FIELDS)
        if not_amounts:
            raise CBSMappingError(f"only amounts can be negated, not: {', '.join(not_amounts)}")
        formats = data.get("date_formats") or [data.get("date_format") or "%Y-%m-%d"]
        return cls(
            name=str(data.get("name") or "unnamed"), fields=dict(mapped), date_formats=tuple(formats),
            negate=frozenset(data.get("negate", [])), defaults=dict(data.get("defaults", {})),
            status_values={str(k): str(v) for k, v in data.get("status_values", {}).items()},
            thousands_separator=data.get("thousands_separator", ","),
            file=dict(data.get("file", {})), http=dict(data.get("http", {})))

    @classmethod
    def load(cls, path: str) -> "CBSMapping":
        try:
            return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))
        except OSError as exc:
            raise CBSMappingError(f"cannot read mapping file {path}: {exc.strerror}") from None
        except json.JSONDecodeError as exc:
            raise CBSMappingError(f"mapping file {path} is not valid JSON: {exc}") from None

    @classmethod
    def default_extract(cls) -> "CBSMapping":
        """Column names HPMS has assumed so far. A placeholder until the bank's real extract layout is known."""
        return cls.from_dict({
            "name": "default extract layout (placeholder column names)",
            "fields": {hpms: source for source, hpms in FinacleFieldMapping.ACCOUNT_MAPPING.items()},
            "defaults": {"currency_code": "NPR"},
        })

    # ---------------------------------------------------------------- conversion

    def _amount(self, name: str, raw: Any) -> Decimal:
        text = str(raw).strip().replace(self.thousands_separator, "") if self.thousands_separator else str(raw).strip()
        try:
            value = Decimal(text)
        except InvalidOperation:
            raise CBSMappingError(f"{name}: {raw!r} is not a number") from None
        if not value.is_finite():
            raise CBSMappingError(f"{name}: {raw!r} is not a number")
        return -value if name in self.negate and value != 0 else value

    def _date(self, name: str, raw: Any) -> date:
        text = str(raw).strip()
        for pattern in self.date_formats:
            try:
                return datetime.strptime(text, pattern).date()
            except ValueError:
                continue
        raise CBSMappingError(f"{name}: {raw!r} does not match {' or '.join(self.date_formats)}")

    def record(self, lookup: Callable[[str], Any]) -> FinacleAccountRecord:
        """Build a record by asking ``lookup`` for each mapped source name. Unmapped or blank fields are None."""
        values: Dict[str, Any] = {name: None for name in RECORD_FIELDS}
        values.update(self.defaults)
        for name, source in self.fields.items():
            raw = lookup(source)
            if raw is None or str(raw).strip() == "":
                continue
            if name in DECIMAL_FIELDS:
                values[name] = self._amount(name, raw)
            elif name in DATE_FIELDS:
                values[name] = self._date(name, raw)
            elif name == "record_version":
                values[name] = int(str(raw).strip())
            elif name == "account_status":
                code = str(raw).strip()
                values[name] = self.status_values.get(code, code).upper()
            else:
                values[name] = str(raw).strip()
        missing = [name for name in REQUIRED_FIELDS if values[name] is None]
        if missing:
            raise CBSMappingError(f"record has no {', '.join(missing)}")
        for name in ("outstanding_principal", "disbursed_amount", "sanctioned_amount"):
            if values[name] is not None and values[name] < 0:
                raise CBSMappingError(f"{name} is negative; if the bank reports debit balances as negative, "
                                      f"add it to 'negate' in the mapping")
        values["last_updated_at_cbs"] = values["last_updated_at_cbs"] or datetime.now(timezone.utc).isoformat()
        values["record_version"] = values["record_version"] or 1
        return FinacleAccountRecord(**values)


def _response(request: FinacleSyncRequest, records: List[FinacleAccountRecord], failed: int,
              message: str = "Success") -> FinacleSyncResponse:
    return FinacleSyncResponse(
        request_id=request.request_id or str(uuid.uuid4()), response_code="000", response_message=message,
        account_records=records, sync_timestamp=datetime.now(timezone.utc).isoformat(),
        total_records=len(records) + failed, records_processed=len(records), records_failed=failed)


# ---------------------------------------------------------------- file extract

class FileExtractAdapter(FinacleAdapterBase):
    """Reads the newest end-of-day extract in a directory."""

    name = "file"
    requires_account_ids = False

    def __init__(self, mapping: CBSMapping, directory: str, max_age_hours: Optional[int] = None, **kwargs):
        super().__init__(**kwargs)
        self.mapping = mapping
        self.directory = Path(directory)
        self.max_age_hours = max_age_hours
        self.row_errors: List[str] = []  # from the last read, for the operator

    def latest_file(self) -> Path:
        pattern = self.mapping.file.get("pattern", "*.csv")
        if not self.directory.is_dir():
            raise FileNotFoundError(f"CBS extract directory {self.directory} does not exist")
        candidates = [p for p in self.directory.glob(pattern) if p.is_file()]
        if not candidates:
            raise FileNotFoundError(f"No extract matching {pattern} in {self.directory}")
        return max(candidates, key=lambda p: (p.stat().st_mtime, p.name))

    def _age_hours(self, path: Path) -> float:
        return (datetime.now(timezone.utc).timestamp() - path.stat().st_mtime) / 3600

    def read(self, path: Path) -> List[FinacleAccountRecord]:
        if path.stat().st_size > MAX_EXTRACT_BYTES:
            raise CBSMappingError(f"{path.name} is larger than {MAX_EXTRACT_BYTES // (1024 * 1024)} MB")
        options = self.mapping.file
        records: List[FinacleAccountRecord] = []
        self.row_errors = []
        seen = set()
        with path.open(encoding=options.get("encoding", "utf-8-sig"), newline="") as handle:
            reader = csv.DictReader(handle, delimiter=options.get("delimiter", ","))
            headers = [h.strip() for h in (reader.fieldnames or [])]
            absent = sorted({self.mapping.fields[name] for name in REQUIRED_FIELDS} - set(headers))
            if absent:
                raise CBSMappingError(f"{path.name} has no column {', '.join(absent)}; found: {', '.join(headers)}")
            for line, row in enumerate(reader, start=2):
                row = {(k or "").strip(): v for k, v in row.items()}
                try:
                    record = self.mapping.record(row.get)
                except (CBSMappingError, ValueError) as exc:
                    self.row_errors.append(f"line {line}: {exc}")
                    continue
                if record.finacle_account_id in seen:
                    self.row_errors.append(f"line {line}: account appears more than once; first occurrence kept")
                    continue
                seen.add(record.finacle_account_id)
                records.append(record)
        return records

    async def sync_accounts(self, request: FinacleSyncRequest) -> FinacleSyncResponse:
        path = self.latest_file()
        age = self._age_hours(path)
        if self.max_age_hours is not None and age > self.max_age_hours:
            raise TimeoutError(f"Newest extract {path.name} is {age:.0f} hours old (limit {self.max_age_hours})")
        records = self.read(path)
        if request.account_ids:
            wanted = set(request.account_ids)
            records = [r for r in records if r.finacle_account_id in wanted]
        logger.info("CBS extract %s: %d records, %d rejected rows", path.name, len(records), len(self.row_errors))
        return _response(request, records, len(self.row_errors), f"Read {path.name}")

    def describe(self) -> Dict[str, Any]:
        info: Dict[str, Any] = {"adapter": self.name, "mapping": self.mapping.name, "directory": str(self.directory)}
        try:
            path = self.latest_file()
            info.update(latest_file=path.name, latest_file_age_hours=round(self._age_hours(path), 1))
        except FileNotFoundError as exc:
            info["problem"] = str(exc)
        return info


# ---------------------------------------------------------------- HTTP inquiry

def _json_path(document: Any, path: str) -> Any:
    """Follow a dotted path through objects and list indexes: ``data.accounts.0.balance``."""
    node = document
    for part in filter(None, path.split(".")):
        if isinstance(node, list):
            try:
                node = node[int(part)]
            except (ValueError, IndexError):
                return None
        elif isinstance(node, dict):
            node = node.get(part)
        else:
            return None
        if node is None:
            return None
    return node


def _xml_path(element: Any, path: str) -> Optional[str]:
    """Follow a slash path of tag names, ignoring namespaces: ``Body/LoanAcctInqRs/OutBal``."""
    node = element
    for part in filter(None, path.split("/")):
        node = next((child for child in node if isinstance(child.tag, str)
                     and child.tag.rsplit("}", 1)[-1] == part), None)
        if node is None:
            return None
    return (node.text or "").strip() or None


class HttpAdapter(FinacleAdapterBase):
    """Asks the bank's API for one account at a time."""

    name = "http"
    requires_account_ids = True

    def __init__(self, mapping: CBSMapping, base_url: str, auth_header: str = "", auth_value: str = "",
                 timeout_seconds: float = 15, verify_tls: bool = True, client_cert: Optional[tuple] = None,
                 transport: Any = None, **kwargs):
        super().__init__(**kwargs)
        if not base_url.lower().startswith("https://") and verify_tls:
            raise CBSMappingError("CBS_HTTP_BASE_URL must be https (set CBS_HTTP_VERIFY_TLS=false only for a lab)")
        options = mapping.http
        if not options.get("path"):
            raise CBSMappingError("mapping needs http.path, e.g. /loans/{account_id}")
        self.mapping = mapping
        self.base_url = base_url.rstrip("/")
        self._headers = {**options.get("headers", {})}
        if auth_header and auth_value:
            self._headers[auth_header] = auth_value
        self._client_options = dict(timeout=timeout_seconds, verify=verify_tls, cert=client_cert, transport=transport)

    def _parse(self, body: bytes) -> Callable[[str], Any]:
        options = self.mapping.http
        record_path = options.get("record_path", "")
        if options.get("format", "json") == "xml":
            from lxml import etree
            parser = etree.XMLParser(resolve_entities=False, no_network=True, huge_tree=False)
            root = etree.fromstring(body, parser=parser)
            base = root
            for part in filter(None, record_path.split("/")):
                base = next((c for c in base if isinstance(c.tag, str) and c.tag.rsplit("}", 1)[-1] == part), None)
                if base is None:
                    raise CBSMappingError(f"response has no {record_path}")
            return lambda path: _xml_path(base, path)
        document = json.loads(body)
        base = _json_path(document, record_path) if record_path else document
        if base is None:
            raise CBSMappingError(f"response has no {record_path}")
        return lambda path: _json_path(base, path)

    async def _fetch(self, client: Any, account_id: str, request_id: str) -> FinacleAccountRecord:
        from urllib.parse import quote
        options = self.mapping.http
        context = {"account_id": account_id, "request_id": request_id,
                   "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000")}
        url = self.base_url + options["path"].format(**{k: quote(v, safe="") for k, v in context.items()})
        body = options.get("body_template")
        if body is not None:
            from xml.sax.saxutils import escape
            is_xml = options.get("format", "json") == "xml"
            safe = {k: (escape(v) if is_xml else json.dumps(v)[1:-1]) for k, v in context.items()}
            for key, value in safe.items():
                body = body.replace("{" + key + "}", value)
        response = await client.request(options.get("method", "POST" if body else "GET"), url,
                                        content=body.encode("utf-8") if body is not None else None,
                                        headers=self._headers)
        if response.status_code == 404:
            raise LookupError("Account not found in CBS (HTTP 404)")
        if response.status_code >= 400:
            raise ConnectionError(f"CBS answered HTTP {response.status_code}")
        return self.mapping.record(self._parse(response.content))

    async def sync_accounts(self, request: FinacleSyncRequest) -> FinacleSyncResponse:
        import httpx
        if not request.account_ids:
            raise ValueError("The HTTP adapter inquires account by account and needs account ids")
        request_id = request.request_id or str(uuid.uuid4())
        records, failed, last_error = [], 0, None
        async with httpx.AsyncClient(**{k: v for k, v in self._client_options.items() if v is not None}) as client:
            for account_id in request.account_ids:
                try:
                    records.append(await self._fetch(client, account_id, request_id))
                except (LookupError, ValueError, SyntaxError) as exc:
                    # This account's answer is missing or unreadable (bad JSON/XML, mapping mismatch);
                    # the service itself is up, so it does not count against the circuit breaker
                    failed += 1
                    last_error = exc
                    logger.warning("CBS inquiry failed for one account: %s", exc)
                except httpx.HTTPError as exc:
                    raise ConnectionError(f"CBS unreachable: {type(exc).__name__}") from None
        return _response(request, records, failed, str(last_error) if last_error else "Success")

    def describe(self) -> Dict[str, Any]:
        return {"adapter": self.name, "mapping": self.mapping.name, "base_url": self.base_url,
                "format": self.mapping.http.get("format", "json")}
