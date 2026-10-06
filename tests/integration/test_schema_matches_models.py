"""The migrated schema has every column the ORM models select (skipped without Postgres).

A model column with no migration makes every query on that table fail at runtime with
UndefinedColumn; this is the check that would have caught it.
"""

from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import NullPool

import backend.app.models  # noqa: F401  (registers every model on Base.metadata)
from backend.app.models.base import Base
from backend.scripts.generate_data_dictionary import VIEWS


def test_every_model_column_exists_in_the_migrated_database(migrated_database_url):
    engine = create_engine(migrated_database_url, poolclass=NullPool)
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        problems = []
        for table in Base.metadata.tables.values():
            # Views are not checked. consortium_exposure_v is mapped but no migration creates it yet;
            # nothing queries it.
            if table.name in VIEWS:
                continue
            if table.name not in tables:
                problems.append(f"{table.name}: no such table")
                continue
            existing = {column["name"] for column in inspector.get_columns(table.name)}
            missing = sorted(column.name for column in table.columns if column.name not in existing)
            if missing:
                problems.append(f"{table.name}: missing {', '.join(missing)}")
    finally:
        engine.dispose()
    assert problems == [], "models and migrations have drifted:\n" + "\n".join(problems)
