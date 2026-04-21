from collections.abc import Generator

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


engine_kwargs: dict[str, object] = {"future": True, "pool_pre_ping": True}
if settings.database_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.database_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)

REQUIRED_TABLES = {
    "credit_transactions",
    "generations",
    "guest_sessions",
    "payments",
    "users",
}


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema_ready() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    missing_tables = REQUIRED_TABLES.difference(existing_tables)
    if missing_tables:
        missing = ", ".join(sorted(missing_tables))
        raise RuntimeError(
            "Database schema is not initialized. Run `alembic upgrade head` in "
            f"`backend/` before starting the API. Missing tables: {missing}."
        )
