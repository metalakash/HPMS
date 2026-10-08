"""A write route that changes the session must commit it.

``get_db`` hands out a session and does not commit when the request ends, so a handler that only
flushes answers 201 and then loses the row. The database tests cannot see that (they share one
session with the handler), which is how the report builder, report schedules and regulatory
routes shipped saving nothing. This reads the route modules instead.
"""

import re
from pathlib import Path

import pytest

API = Path(__file__).resolve().parent.parent / "backend" / "app" / "api"
WRITES = re.compile(r"db\.(add|add_all|delete|flush)\(")


def _write_handlers():
    for module in sorted(API.glob("routes_*.py")):
        blocks = re.split(r"(?=^\s*@router\.)", module.read_text(encoding="utf-8"), flags=re.M)
        for block in blocks[1:]:
            if re.match(r"\s*@router\.(post|put|patch|delete)\(", block):
                name = re.search(r"async def (\w+)", block)
                if name and WRITES.search(block):
                    yield pytest.param(block, id=f"{module.stem}.{name.group(1)}")


@pytest.mark.parametrize("handler", _write_handlers())
def test_write_handlers_commit(handler):
    assert "db.commit()" in handler, "this handler changes the session but never commits it"


def test_the_scan_finds_the_handlers_it_is_meant_to_guard():
    names = {p.id for p in _write_handlers()}
    assert {"routes_report_builder.create_definition", "routes_regulatory.create_reminder",
            "routes_regulatory.create_requirement"} <= names
