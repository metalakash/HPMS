"""Generate docs/DATA-DICTIONARY.md from the SQLAlchemy models (RFP D.7).

    python -m backend.scripts.generate_data_dictionary            # rewrite the committed file
    python -m backend.scripts.generate_data_dictionary --check    # exit 1 if the file is out of date

The output is deterministic, so a test (tests/test_data_dictionary.py) fails whenever a model changes
without the dictionary being regenerated.
"""

import argparse
import inspect
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional

from sqlalchemy import Table
from sqlalchemy.schema import CheckConstraint, ForeignKeyConstraint, UniqueConstraint

# Association tables have no mapped class; place them by name
TABLE_AREAS = {"role_permissions": "Workflow and approvals"}

# Mapped read-only models whose relation is a database view, not a table
VIEWS = {"consortium_exposure_v"}

OUTPUT = Path(__file__).resolve().parents[2] / "docs" / "DATA-DICTIONARY.md"

# Models module -> functional area (order here is the order of the document)
AREAS = [
    ("project", "Projects"), ("financial", "Loans and financing"), ("consortium", "Consortium"),
    ("operations", "Operations: PPA, hydrology, land, ESG, maintenance, covenants"),
    ("risk", "Risk register, milestones, insurance, permits, ESIA, community"),
    ("regulatory", "Regulatory filing calendar, reminders, stakeholder contacts"),
    ("reporting", "Report builder"), ("scheduler", "Scheduled exports"),
    ("auth", "Users and access"), ("mfa", "Multi-factor authentication"), ("governance", "Workflow and approvals"),
    ("audit", "Audit trail"), ("document", "Documents"), ("etl", "Import / ETL"), ("import_tracking", "Bulk import tracking"),
]


def _first_line(doc: Optional[str]) -> str:
    return (inspect.cleandoc(doc).splitlines()[0] if doc and doc.strip() else "").strip()


def _type(col) -> str:
    try:
        return str(col.type).replace("\n", " ")
    except Exception:  # dialect-specific types without a generic compile
        return col.type.__class__.__name__


def _default(col) -> str:
    if col.server_default is not None:
        text = getattr(col.server_default, "arg", col.server_default)
        return f"`{str(getattr(text, 'text', text))}`"
    if col.default is not None and getattr(col.default, "is_scalar", False):
        return f"`{col.default.arg}`"
    return ""


def _notes(table: Table, col) -> str:
    notes = []
    if col.primary_key:
        notes.append("PK")
    for fk in col.foreign_keys:
        notes.append(f"FK → {fk.column.table.name}.{fk.column.name}")
    if col.unique:
        notes.append("unique")
    if col.index:
        notes.append("indexed")
    return ", ".join(notes)


def _model_registry() -> Dict[str, type]:
    """table name -> mapped class, for descriptions and functional areas."""
    from backend.app.models.base import Base
    registry = {}
    for mapper in Base.registry.mappers:
        table = mapper.local_table
        if isinstance(table, Table):
            registry.setdefault(table.name, mapper.class_)
    return registry


def _area_of(cls: Optional[type]) -> str:
    module = (cls.__module__.rsplit(".", 1)[-1] if cls else "")
    for key, label in AREAS:
        if module == key:
            return label
    return "Other"


def render() -> str:
    import backend.app.models  # noqa: F401  (registers every model)
    from backend.app.models.base import Base

    registry = _model_registry()
    by_area: Dict[str, List[Table]] = defaultdict(list)
    for table in Base.metadata.sorted_tables:
        area = TABLE_AREAS.get(table.name) or _area_of(registry.get(table.name))
        by_area[area].append(table)

    order = [label for _, label in AREAS] + ["Other"]
    total_cols = sum(len(t.columns) for t in Base.metadata.tables.values())

    out = [
        "# HPMS Data Dictionary",
        "",
        "> Generated from the SQLAlchemy models by `backend/scripts/generate_data_dictionary.py`. "
        "Do not edit by hand; run `python -m backend.scripts.generate_data_dictionary` and commit the result.",
        "",
        f"**{len(Base.metadata.tables)} tables and views, {total_cols} columns.** "
        "Dates are stored as AD `DATE` columns with a paired `*_bs` text column (`YYYY-MM-DD` Bikram Sambat) "
        "where the business needs both calendars. Descriptions come from the model docstrings.",
        "",
        "## Contents",
        "",
    ]
    for label in order:
        if by_area.get(label):
            out.append(f"- **{label}**: " + ", ".join(f"`{t.name}`" for t in sorted(by_area[label], key=lambda t: t.name)))
    out.append("")

    for label in order:
        tables = sorted(by_area.get(label, []), key=lambda t: t.name)
        if not tables:
            continue
        out += [f"## {label}", ""]
        for table in tables:
            cls = registry.get(table.name)
            out += [f"### `{table.name}`", ""]
            description = _first_line(cls.__doc__) if cls else ""
            if table.name in VIEWS:
                description = (description + " " if description else "") + "(Database view, read-only.)"
            if description:
                out += [description, ""]
            out += ["| Column | Type | Null | Default | Notes |", "|---|---|---|---|---|"]
            for col in table.columns:
                out.append(f"| `{col.name}` | {_type(col)} | {'yes' if col.nullable else 'no'} | {_default(col)} | "
                           f"{_notes(table, col)} |")
            extras = []
            for c in sorted(table.constraints, key=lambda c: (type(c).__name__, str(c.name))):
                if isinstance(c, UniqueConstraint) and len(c.columns) > 1:
                    extras.append(f"unique ({', '.join(col.name for col in c.columns)})")
                elif isinstance(c, CheckConstraint) and c.name:
                    extras.append(f"check `{c.name}`")
                elif isinstance(c, ForeignKeyConstraint) and len(c.columns) > 1:
                    extras.append(f"foreign key ({', '.join(col.name for col in c.columns)})")
            for ix in sorted(table.indexes, key=lambda i: str(i.name)):
                cols = ", ".join(c.name for c in ix.columns)
                if len(ix.columns) > 1 or ix.unique:
                    extras.append(f"{'unique ' if ix.unique else ''}index `{ix.name}` ({cols})")
            if extras:
                out += ["", "Constraints and composite indexes: " + "; ".join(extras) + "."]
            out.append("")
    return "\n".join(out).rstrip() + "\n"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if the committed dictionary is out of date")
    args = parser.parse_args(argv)
    text = render()
    if args.check:
        current = OUTPUT.read_text(encoding="utf-8").replace("\r\n", "\n") if OUTPUT.exists() else ""
        if current != text:
            print(f"{OUTPUT} is out of date; run python -m backend.scripts.generate_data_dictionary", file=sys.stderr)
            return 1
        return 0
    OUTPUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"Wrote {OUTPUT} ({text.count(chr(10))} lines)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
