import sys
from types import SimpleNamespace
from unittest.mock import Mock

from app import db


def test_database_url_selects_postgres_in_development(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:password@example.test/atlas")
    connect = Mock(return_value=object())
    monkeypatch.setitem(sys.modules, "psycopg2", SimpleNamespace(connect=connect))
    assert db.get_db_type() == "postgresql"
    assert db.get_db_connection() is connect.return_value
    assert connect.call_args.kwargs["sslmode"] == "require"


def test_postgres_failure_never_falls_back_to_local(monkeypatch):
    import pytest

    monkeypatch.setenv("DATABASE_URL", "postgresql://example.test/atlas")
    connect = Mock(side_effect=RuntimeError("connection unavailable"))
    monkeypatch.setitem(sys.modules, "psycopg2", SimpleNamespace(connect=connect))
    with pytest.raises(RuntimeError, match="unavailable"):
        db.get_db_connection()


def test_analytics_loads_postgres_and_closes_connection(monkeypatch):
    from app.routers import analytics

    cursor = Mock()
    cursor.description = [("listing_id",), ("county",)]
    cursor.fetchall.return_value = [("test-1", "Nairobi")]
    connection = Mock()
    connection.cursor.return_value.__enter__ = Mock(return_value=cursor)
    connection.cursor.return_value.__exit__ = Mock(return_value=False)
    monkeypatch.setattr(analytics, "get_db_type", lambda: "postgresql")
    monkeypatch.setattr(analytics, "get_db_connection", lambda: connection)
    frame = analytics._load_latest_parquet()
    assert frame.to_dict("records") == [{"listing_id": "test-1", "county": "Nairobi"}]
    connection.close.assert_called_once()


def test_demo_ingestion_denied_for_database_deployment(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app

    monkeypatch.setenv("DATABASE_URL", "postgresql://example.test/atlas")
    assert (
        TestClient(app).post("/api/v1/ingestion/trigger/kenya-listings").status_code
        == 403
    )
