"""Shared fixtures.

``db_session`` gives each test an AsyncSession on a real, migrated Postgres test
database. Everything a test writes (including code under test that calls
``commit()``) is rolled back afterwards.

The test database is ``TEST_DATABASE_URL`` if set, otherwise ``DATABASE_URL`` with
``_test`` appended to the database name. It is dropped and recreated once per run
via ``alembic upgrade head``, so tests exercise the real schema. If no server is
reachable, DB-backed tests are skipped.
"""

import os
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from backend.app.config import settings

ROOT = Path(__file__).resolve().parent.parent


def _test_database_url() -> str:
    explicit = os.getenv("TEST_DATABASE_URL")
    if explicit:
        return explicit
    url = make_url(settings.DATABASE_URL.replace("+asyncpg", ""))
    return url.set(database=f"{url.database}_test").render_as_string(hide_password=False)


@pytest.fixture(scope="session")
def migrated_database_url() -> str:
    """Create a fresh test database and migrate it to head. Skips if Postgres is unavailable."""
    from alembic import command
    from alembic.config import Config

    url = make_url(_test_database_url())
    if url.database in (None, "", "postgres") or not url.database.endswith("_test"):
        pytest.fail(f"Refusing to use {url.database!r} as a throwaway test database (name must end in _test)")

    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT", poolclass=NullPool)
    try:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{url.database}" WITH (FORCE)'))
            conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    except Exception as e:
        pytest.skip(f"Postgres not available for DB tests ({url.render_as_string()}): {e}")
    finally:
        admin.dispose()

    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "alembic"))
    engine = create_engine(url, poolclass=NullPool)
    with engine.begin() as conn:
        config.attributes["connection"] = conn
        command.upgrade(config, "head")
    engine.dispose()

    return url.render_as_string(hide_password=False)


@pytest.fixture
async def db_session(migrated_database_url):
    """AsyncSession inside an outer transaction that is rolled back after the test."""
    async_url = migrated_database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(async_url, poolclass=NullPool)
    async with engine.connect() as conn:
        outer = await conn.begin()
        # commit() inside code under test releases a SAVEPOINT instead of committing
        session = AsyncSession(bind=conn, join_transaction_mode="create_savepoint", expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await outer.rollback()
    await engine.dispose()
