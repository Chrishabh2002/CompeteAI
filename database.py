"""DB engine and session setup."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import settings

_db_url = settings.DATABASE_URL

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
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
