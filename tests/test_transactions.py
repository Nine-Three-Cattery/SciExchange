"""Write-session ownership preserves read-modify-write and rollback semantics."""

from collections.abc import Iterator
from pathlib import Path
from types import SimpleNamespace

from fastapi import Request
import pytest
from sqlalchemy import Engine, text

from app.database import get_session, get_write_session, make_engine


@pytest.fixture()
def transaction_database(tmp_path: Path) -> Iterator[tuple[Engine, Request]]:
    engine = make_engine(f"sqlite:///{tmp_path / 'transactions.sqlite'}")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE counter (value INTEGER NOT NULL)"))
        connection.execute(text("INSERT INTO counter VALUES (0)"))
    request = Request({"type": "http", "app": SimpleNamespace(state=SimpleNamespace(engine=engine))})
    try:
        yield engine, request
    finally:
        engine.dispose()


def test_write_session_allows_read_before_mutation_and_commits(transaction_database) -> None:
    engine, request = transaction_database
    dependency = get_write_session(request)
    session = next(dependency)
    current = session.scalar(text("SELECT value FROM counter"))
    session.execute(text("UPDATE counter SET value = :next_value"), {"next_value": current + 1})
    with pytest.raises(StopIteration):
        next(dependency)
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT value FROM counter")) == 1


def test_exception_rolls_back_write_and_releases_transaction(transaction_database) -> None:
    engine, request = transaction_database
    dependency = get_write_session(request)
    session = next(dependency)
    session.execute(text("UPDATE counter SET value = 99"))
    with pytest.raises(RuntimeError, match="approval failed"):
        dependency.throw(RuntimeError("approval failed"))
    with engine.begin() as connection:
        assert connection.scalar(text("SELECT value FROM counter")) == 0
        connection.execute(text("UPDATE counter SET value = 1"))


def test_uncommitted_mutation_is_not_implicitly_saved(transaction_database) -> None:
    engine, request = transaction_database
    dependency = get_write_session(request)
    session = next(dependency)
    session.execute(text("UPDATE counter SET value = 99"))
    dependency.close()
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT value FROM counter")) == 0


def test_read_only_request_does_not_reserve_the_sqlite_writer(transaction_database) -> None:
    engine, request = transaction_database
    dependency = get_session(request)
    session = next(dependency)
    assert session.scalar(text("SELECT value FROM counter")) == 0
    with engine.begin() as connection:
        connection.execute(text("UPDATE counter SET value = 1"))
    dependency.close()
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT value FROM counter")) == 1
