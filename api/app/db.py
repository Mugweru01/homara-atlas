"""
Database configuration module for Homara Atlas API.

Provides a unified database connection that:
  - In PRODUCTION: connects to AWS RDS PostgreSQL via environment variables
  - In LOCAL/DEV: falls back to DuckDB for zero-cost local development

Usage:
    from app.db import get_db_connection
    conn = get_db_connection()
"""

import os
import logging

logger = logging.getLogger(__name__)

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

def get_db_connection():
    """
    Returns a database connection appropriate for the current environment.
    - Production: psycopg2 connection to AWS RDS PostgreSQL
    - Development: DuckDB connection to local warehouse file
    """
    if ENVIRONMENT == "production":
        import psycopg2
        db_host = os.environ["DB_HOST"]
        db_user = os.environ["DB_USER"]
        db_pass = os.environ["DB_PASS"]
        db_name = os.getenv("DB_NAME", "homara_atlas_dw")
        db_port = os.getenv("DB_PORT", "5432")

        logger.info(f"Connecting to production PostgreSQL at {db_host}")
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            dbname=db_name,
            user=db_user,
            password=db_pass,
            sslmode="require",  # RDS requires SSL
            connect_timeout=10,
        )
        return conn
    else:
        import duckdb
        db_path = os.getenv("DUCKDB_PATH", "data-platform/warehouse/homara_atlas.duckdb")
        logger.info(f"Connecting to local DuckDB at {db_path}")
        return duckdb.connect(db_path)


def get_db_type() -> str:
    """Returns the type of database currently in use."""
    return "postgresql" if ENVIRONMENT == "production" else "duckdb"
