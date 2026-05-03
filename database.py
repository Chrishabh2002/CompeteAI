"""
CompeteAI — Database Engine & Session
SQLite via SQLAlchemy. Auto-creates the DB file on first run.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

import os

from config import settings

_db_url = settings.DATABASE_URL

# On Vercel the project root is read-only; redirect SQLite to /tmp
if os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"):
    if _db_url.startswith("sqlite"):
        _db_url = "sqlite:////tmp/competeai.db"

_connect_args = {}
if _db_url.startswith("sqlite"):
    _connect_args["check_same_thread"] = False  # required for SQLite

engine = create_engine(
    _db_url,
    connect_args=_connect_args,
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


def get_db():
    """FastAPI dependency — yields a session then closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables if they don't exist yet."""
    Base.metadata.create_all(bind=engine)
