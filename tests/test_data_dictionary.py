"""Phase 11.5: the data dictionary is current, and every model table has a migration."""

import re
from pathlib import Path

from backend.scripts import generate_data_dictionary as gen

ROOT = Path(__file__).resolve().parents[1]


def test_committed_data_dictionary_is_up_to_date():
    current = gen.OUTPUT.read_text(encoding="utf-8").replace("\r\n", "\n")
    assert current == gen.render(), (
        "docs/DATA-DICTIONARY.md is stale; run: python -m backend.scripts.generate_data_dictionary")


def test_dictionary_covers_every_model_table_with_columns():
    import backend.app.models  # noqa: F401
    from backend.app.models.base import Base
    text = gen.render()
    for name, table in Base.metadata.tables.items():
        assert f"### `{name}`" in text, name
        for col in table.columns:
            assert f"| `{col.name}` |" in text
    assert "## Other" not in text or all(  # nothing should fall through to the catch-all area unnoticed
        t in text for t in ("backup_code", "user_mfa"))


def test_every_model_table_is_created_by_a_migration():
    """Models without a migration only work on databases built with create_all, never on `alembic upgrade head`.

    Phase 8.3 shipped two such tables; this guard keeps it from recurring.
    """
    import backend.app.models  # noqa: F401
    from backend.app.models.base import Base

    created = set()
    for f in (ROOT / "alembic" / "versions").glob("*.py"):
        created |= set(re.findall(r"create_table\(\s*['\"](\w+)['\"]", f.read_text(encoding="utf-8")))
    missing = set(Base.metadata.tables) - created - gen.VIEWS
    assert not missing, f"models without a migration: {sorted(missing)}"


def test_migration_chain_has_a_single_linear_head():
    revisions, parents = {}, set()
    for f in (ROOT / "alembic" / "versions").glob("*.py"):
        src = f.read_text(encoding="utf-8")
        rev = re.search(r"^revision\s*=\s*['\"]([^'\"]+)['\"]", src, re.M).group(1)
        down = re.search(r"^down_revision\s*=\s*(None|['\"]([^'\"]+)['\"])", src, re.M)
        revisions[rev] = down.group(2)
        if down.group(2):
            parents.add(down.group(2))
    heads = set(revisions) - parents
    assert len(heads) == 1, f"multiple heads: {sorted(heads)}"
    assert sum(1 for d in revisions.values() if d is None) == 1  # exactly one root
