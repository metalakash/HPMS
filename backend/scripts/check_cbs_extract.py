"""Check a bank's loan extract against a mapping file before connecting it.

Reads the extract exactly as the file adapter would and reports what it found: how many rows
were read, which were rejected and why, which HPMS fields the extract supplies, and (with
--compare) how the accounts line up with the loans HPMS holds. It writes nothing.

Run from the repository root:
    python -m backend.scripts.check_cbs_extract loans_20261007.txt --mapping bank-mapping.json
    python -m backend.scripts.check_cbs_extract loans_20261007.txt --mapping bank-mapping.json --compare

Exit status: 0 when the extract is usable, 1 when it is not (unreadable, or no row could be read).
Account numbers are shown by their last four characters only.
"""

import argparse
import asyncio
import sys
from dataclasses import fields
from pathlib import Path
from typing import Any, Dict, List

from backend.app.integration.cbs_adapters import CBSMapping, CBSMappingError, FileExtractAdapter
from backend.app.integration.finacle_schema import FinacleAccountRecord
from backend.app.services.cbs_sync_real_service import CBS_OWNED

GENERATED = {"last_updated_at_cbs", "record_version"}  # filled in by HPMS when the bank sends none


def mask(account: str) -> str:
    return "…" + account[-4:] if len(account) > 4 else "…" + account


def inspect(path: Path, mapping: CBSMapping) -> Dict[str, Any]:
    """Parse the extract and summarise it. Raises CBSMappingError / OSError if it cannot be read at all."""
    adapter = FileExtractAdapter(mapping, str(path.parent))
    records = adapter.read(path)
    names = [f.name for f in fields(FinacleAccountRecord) if f.name not in GENERATED]
    supplied = {name: sum(1 for r in records if getattr(r, name) is not None) for name in names}
    return {
        "records": records,
        "row_errors": list(adapter.row_errors),
        "supplied": {name: count for name, count in supplied.items() if count},
        "never_supplied": [name for name, count in supplied.items() if not count],
        "synced_but_missing": sorted(source for source in CBS_OWNED.values() if not supplied.get(source)),
    }


async def compare(records: List[FinacleAccountRecord], session: Any = None) -> Dict[str, Any]:
    """Line the extract up with the loans HPMS holds. Reads only. Opens its own session unless given one."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession

    from backend.app.models.financial import LoanAccount

    async def held(db) -> Dict[str, Any]:
        return {loan.finacle_account_id: loan for loan in (await db.execute(select(LoanAccount))).scalars()}

    if session is not None:
        loans = await held(session)
    else:
        from backend.app.database import engine
        async with AsyncSession(engine) as own:
            loans = await held(own)
    by_account = {r.finacle_account_id: r for r in records}
    matched = sorted(set(loans) & set(by_account))
    would_change = 0
    for account in matched:
        loan, record = loans[account], by_account[account]
        if any(getattr(record, source) is not None and getattr(loan, column) != getattr(record, source)
               for column, source in CBS_OWNED.items()):
            would_change += 1
    return {
        "held": len(loans), "matched": len(matched), "would_change": would_change,
        "held_not_in_extract": sorted(set(loans) - set(by_account)),
        "in_extract_not_held": len(set(by_account) - set(loans)),
    }


def report(path: Path, mapping: CBSMapping, summary: Dict[str, Any], comparison: Dict[str, Any] | None) -> List[str]:
    records, errors = summary["records"], summary["row_errors"]
    lines = [f"Extract : {path.name}", f"Mapping : {mapping.name}", "",
             f"Rows read     : {len(records)}", f"Rows rejected : {len(errors)}"]
    lines += [f"  {error}" for error in errors[:20]]
    if len(errors) > 20:
        lines.append(f"  ... and {len(errors) - 20} more")

    lines += ["", "Fields the extract supplies (rows with a value):"]
    lines += [f"  {name:<24}{count}" for name, count in summary["supplied"].items()]
    if summary["synced_but_missing"]:
        lines += ["", "Fields HPMS syncs that this extract never supplies (local values will be kept):"]
        lines += [f"  {name}" for name in summary["synced_but_missing"]]

    if comparison is not None:
        lines += ["", "Against the loans HPMS holds:",
                  f"  loans held in HPMS            : {comparison['held']}",
                  f"  found in the extract          : {comparison['matched']}",
                  f"  of those, a sync would change : {comparison['would_change']}",
                  f"  in the extract, not in HPMS   : {comparison['in_extract_not_held']} (ignored by a sync)"]
        missing = comparison["held_not_in_extract"]
        if missing:
            lines.append(f"  held in HPMS, not in extract  : {len(missing)} "
                         f"({', '.join(mask(a) for a in missing[:10])}{' ...' if len(missing) > 10 else ''})")
            if comparison["matched"] == 0:
                lines.append("  None of the held loans were found: check which column holds the account number "
                             "and that it is written the same way in HPMS.")
    lines += ["", "Result: usable" if records else "Result: NOT usable (no row could be read)"]
    return lines


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check a bank's loan extract against a mapping file.")
    parser.add_argument("extract", type=Path, help="the extract file")
    parser.add_argument("--mapping", help="mapping JSON; the placeholder layout is used if omitted")
    parser.add_argument("--compare", action="store_true", help="also compare with the loans in the database")
    args = parser.parse_args(argv)

    try:
        mapping = CBSMapping.load(args.mapping) if args.mapping else CBSMapping.default_extract()
        summary = inspect(args.extract, mapping)
    except (CBSMappingError, OSError) as exc:
        print(f"Cannot use this extract: {exc}")
        return 1
    comparison = asyncio.run(compare(summary["records"])) if args.compare else None
    print("\n".join(report(args.extract, mapping, summary, comparison)))
    return 0 if summary["records"] else 1


if __name__ == "__main__":
    sys.exit(main())
