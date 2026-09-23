import asyncio
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import sys
import os

# Add parent directory to path so we can import our app
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + "/.."))

from backend.app.models import Base
from backend.app.config import settings

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    sync_url = url.replace("postgresql+asyncpg://", "postgresql://")
    context.configure(
        url=sync_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    configuration = config.get_section(config.config_ini_section)
    # Convert async URL to sync for Alembic autogenerate
    sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    configuration["sqlalchemy.url"] = sync_url
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.begin() as connection:
        do_run_migrations(connection)

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    try:
        asyncio.run(run_migrations_online())
    except Exception as e:
        print(f"Database connection failed: {e}")
        print("Falling back to offline mode (SQL file generation)...")
        run_migrations_offline()
