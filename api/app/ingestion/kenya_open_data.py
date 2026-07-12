"""
Homara Atlas — Kenya Public Property Listings Ingestion Pipeline.

Stage: Extract & Load (EL)
Source: Simulated public property listing data representative of Nairobi market.

In production this pipeline will:
  1. EXTRACT: Fetch real data from public Kenyan property APIs and web sources
     (e.g., Kenya National Bureau of Statistics, county land registries, open portals).
  2. LOAD: Write raw, immutable Parquet files to the S3 Data Lake under a
     structured partition path: s3://homara-atlas-datalake/raw/kenya/listings/YYYY/MM/DD/

For local development and testing, data is written to:
  data-platform/raw/kenya/listings/YYYY/MM/DD/

This script never transforms or aggregates data. That is the responsibility
of the dbt transformation layer (Phase 9).
"""

import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("atlas.ingestion.kenya_listings")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Local path (mock Data Lake). Resolves to: homara-atlas/data-platform/raw/
# __file__ is at: homara-atlas/api/app/ingestion/kenya_open_data.py
# parents[3] = homara-atlas/
LOCAL_LAKE_BASE = Path(__file__).resolve().parents[3] / "data-platform" / "raw"

# In production, set USE_S3=true and configure AWS credentials via IAM/IRSA.
USE_S3 = os.getenv("USE_S3", "false").lower() == "true"
S3_BUCKET = os.getenv("S3_BUCKET", "homara-atlas-datalake-prod-us-east-1")


# ---------------------------------------------------------------------------
# Step 1: EXTRACT — Simulate fetching public Kenyan property data
# ---------------------------------------------------------------------------

def extract_kenya_listings() -> pd.DataFrame:
    """
    Extracts public property listing data.

    In production: calls real public APIs or scrapes open data portals.
    Currently: generates a representative synthetic dataset to validate
    the pipeline and schema before live data sources are integrated.

    Returns:
        pd.DataFrame: Raw extracted listings data.
    """
    logger.info("EXTRACT: Fetching public Kenya property listings...")
    now_utc = datetime.now(timezone.utc).isoformat()

    # Synthetic dataset representing publicly available Nairobi property data.
    # Schema mirrors what a real estate portal or government registry would expose.
    data = [
        {
            "listing_id": "NBI-001",
            "neighbourhood": "Westlands",
            "county": "Nairobi",
            "property_type": "Apartment",
            "bedrooms": 2,
            "listing_price_ksh": 8_500_000,
            "asking_rent_ksh": 65_000,
            "size_sqft": 950,
            "year_built": 2018,
            "source": "synthetic_public_data",
            "extracted_at": now_utc,
        },
        {
            "listing_id": "NBI-002",
            "neighbourhood": "Karen",
            "county": "Nairobi",
            "property_type": "Villa",
            "bedrooms": 4,
            "listing_price_ksh": 45_000_000,
            "asking_rent_ksh": 250_000,
            "size_sqft": 3_200,
            "year_built": 2015,
            "source": "synthetic_public_data",
            "extracted_at": now_utc,
        },
        {
            "listing_id": "NBI-003",
            "neighbourhood": "Kilimani",
            "county": "Nairobi",
            "property_type": "Apartment",
            "bedrooms": 1,
            "listing_price_ksh": 5_200_000,
            "asking_rent_ksh": 45_000,
            "size_sqft": 600,
            "year_built": 2020,
            "source": "synthetic_public_data",
            "extracted_at": now_utc,
        },
        {
            "listing_id": "NBI-004",
            "neighbourhood": "Runda",
            "county": "Nairobi",
            "property_type": "Townhouse",
            "bedrooms": 3,
            "listing_price_ksh": 22_000_000,
            "asking_rent_ksh": 150_000,
            "size_sqft": 2_100,
            "year_built": 2019,
            "source": "synthetic_public_data",
            "extracted_at": now_utc,
        },
        {
            "listing_id": "MSA-001",
            "neighbourhood": "Nyali",
            "county": "Mombasa",
            "property_type": "Apartment",
            "bedrooms": 2,
            "listing_price_ksh": 6_800_000,
            "asking_rent_ksh": 50_000,
            "size_sqft": 870,
            "year_built": 2017,
            "source": "synthetic_public_data",
            "extracted_at": now_utc,
        },
        {
            "listing_id": "NKR-001",
            "neighbourhood": "Milimani",
            "county": "Nakuru",
            "property_type": "Bungalow",
            "bedrooms": 3,
            "listing_price_ksh": 9_500_000,
            "asking_rent_ksh": 55_000,
            "size_sqft": 1_400,
            "year_built": 2016,
            "source": "synthetic_public_data",
            "extracted_at": now_utc,
        },
    ]

    df = pd.DataFrame(data)
    logger.info(f"EXTRACT: Successfully extracted {len(df)} records.")
    return df


# ---------------------------------------------------------------------------
# Step 2: LOAD — Write raw Parquet to Data Lake (local or S3)
# ---------------------------------------------------------------------------

def load_to_data_lake(df: pd.DataFrame, job_id: str) -> str:
    """
    Loads the raw DataFrame as an immutable Parquet partition into the Data Lake.

    Partition strategy: /raw/kenya/listings/YYYY/MM/DD/
    This allows efficient querying with Redshift Spectrum and dbt.

    Args:
        df: The extracted DataFrame.
        job_id: Unique identifier for this ingestion run.

    Returns:
        str: Path or S3 URI where the data was written.
    """
    now = datetime.now(timezone.utc)
    partition_path = f"kenya/listings/{now.year}/{now.month:02d}/{now.day:02d}"
    filename = f"{job_id}.parquet"

    if USE_S3:
        import boto3

        s3_key = f"raw/{partition_path}/{filename}"
        s3_uri = f"s3://{S3_BUCKET}/{s3_key}"
        logger.info(f"LOAD: Writing to S3 Data Lake → {s3_uri}")

        s3 = boto3.client("s3")
        buffer = df.to_parquet(index=False)
        s3.put_object(Bucket=S3_BUCKET, Key=s3_key, Body=buffer)
        logger.info(f"LOAD: Successfully written to S3: {s3_uri}")
        return s3_uri
    else:
        local_path = LOCAL_LAKE_BASE / partition_path
        local_path.mkdir(parents=True, exist_ok=True)
        output_file = local_path / filename
        df.to_parquet(output_file, index=False)
        logger.info(f"LOAD: Successfully written to local Data Lake → {output_file}")
        return str(output_file)


# ---------------------------------------------------------------------------
# Pipeline Orchestrator
# ---------------------------------------------------------------------------

def run_kenya_listings_ingestion(job_id: str) -> dict:
    """
    Orchestrates the full EL pipeline for Kenya property listings.

    Args:
        job_id: Unique identifier for this job run (provided by the API router).

    Returns:
        dict: Job result summary.
    """
    logger.info(f"=== PIPELINE START: {job_id} ===")
    try:
        df = extract_kenya_listings()
        output_path = load_to_data_lake(df, job_id)
        result = {
            "job_id": job_id,
            "status": "SUCCESS",
            "records_processed": len(df),
            "output_path": output_path,
        }
        logger.info(f"=== PIPELINE COMPLETE: {job_id} | {len(df)} records ===")
        return result
    except Exception as exc:
        logger.error(f"=== PIPELINE FAILED: {job_id} | {exc} ===")
        return {
            "job_id": job_id,
            "status": "FAILED",
            "error": str(exc),
        }


# ---------------------------------------------------------------------------
# Allow direct execution for local testing: `python -m app.ingestion.kenya_open_data`
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    result = run_kenya_listings_ingestion(job_id="local-test-run")
    print("\n--- Pipeline Result ---")
    for k, v in result.items():
        print(f"  {k}: {v}")
