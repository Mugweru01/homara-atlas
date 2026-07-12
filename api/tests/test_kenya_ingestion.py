"""
Homara Atlas — Test Suite for Kenya Listings Ingestion Pipeline.
"""

import pytest
import pandas as pd
from app.ingestion.kenya_open_data import extract_kenya_listings, run_kenya_listings_ingestion


def test_extract_returns_dataframe():
    """Extraction must return a non-empty DataFrame."""
    df = extract_kenya_listings()
    assert isinstance(df, pd.DataFrame)
    assert len(df) > 0


def test_extract_has_required_columns():
    """Extracted data must contain all columns needed by the Star Schema."""
    required_columns = [
        "listing_id",
        "neighbourhood",
        "county",
        "property_type",
        "bedrooms",
        "listing_price_ksh",
        "asking_rent_ksh",
        "size_sqft",
        "source",
        "extracted_at",
    ]
    df = extract_kenya_listings()
    for col in required_columns:
        assert col in df.columns, f"Missing required column: {col}"


def test_extract_no_null_listing_ids():
    """listing_id must never be null — it is the primary key."""
    df = extract_kenya_listings()
    assert df["listing_id"].isnull().sum() == 0


def test_extract_positive_prices():
    """All listing prices must be positive numbers."""
    df = extract_kenya_listings()
    assert (df["listing_price_ksh"] > 0).all()


def test_pipeline_success():
    """Full pipeline run must succeed and return a SUCCESS status."""
    result = run_kenya_listings_ingestion(job_id="pytest-test-run")
    assert result["status"] == "SUCCESS"
    assert result["records_processed"] > 0
