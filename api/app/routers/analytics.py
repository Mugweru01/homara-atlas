"""
Homara Atlas — Analytics API Router.

Serves pre-aggregated intelligence products to the frontend dashboard.
All data originates from public, open datasets transformed by dbt.

In production:
  - Reads from atlas_intelligence schema in Redshift Serverless.
  - Caches expensive queries in Redis (ElastiCache) with a 1-hour TTL.

For local development (no Redshift):
  - Reads from the local Parquet file produced by the EL pipeline.
  - Aggregates on-the-fly using Pandas to simulate what dbt would produce.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

logger = logging.getLogger("atlas.api.analytics")
router = APIRouter()

# Local Data Lake path (mock for dev — in prod this hits Redshift via SQLAlchemy)
_RAW_BASE = Path(__file__).resolve().parents[3] / "data-platform" / "raw"


def _load_latest_parquet() -> pd.DataFrame:
    """Load the most recent Parquet partition from the local Data Lake."""
    parquet_files = sorted(_RAW_BASE.rglob("*.parquet"))
    if not parquet_files:
        raise FileNotFoundError(
            "No Parquet files found. Run the ingestion pipeline first: "
            "POST /api/v1/ingestion/trigger/kenya-listings"
        )
    # Load all partitions and concatenate (Redshift Spectrum does this automatically)
    dfs = [pd.read_parquet(f) for f in parquet_files]
    return pd.concat(dfs, ignore_index=True)


# ---------------------------------------------------------------------------
# GET /api/v1/analytics/overview  — Dashboard summary KPIs
# ---------------------------------------------------------------------------

@router.get("/overview", summary="Market Overview KPIs")
async def get_overview() -> JSONResponse:
    """
    Returns top-level market intelligence KPIs for the dashboard Overview page.
    Powered by: stg_kenya_listings → fct_property_price_index (dbt)
    """
    try:
        df = _load_latest_parquet()

        total_listings   = int(len(df))
        avg_price        = round(float(df["listing_price_ksh"].mean()), 2)
        avg_rent         = round(float(df["asking_rent_ksh"].mean()), 2)
        counties_covered = int(df["county"].nunique())

        # Price per sqft average
        df["price_per_sqft"] = df["listing_price_ksh"] / df["size_sqft"].replace(0, pd.NA)
        avg_price_per_sqft   = round(float(df["price_per_sqft"].mean()), 2)

        return JSONResponse({
            "status":               "ok",
            "total_listings":       total_listings,
            "avg_listing_price_ksh": avg_price,
            "avg_rent_ksh":         avg_rent,
            "avg_price_per_sqft_ksh": avg_price_per_sqft,
            "counties_covered":     counties_covered,
            "currency":             "KES",
        })

    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))


# ---------------------------------------------------------------------------
# GET /api/v1/analytics/price-index — Property Price Index by county
# ---------------------------------------------------------------------------

@router.get("/price-index", summary="Property Price Index by County")
async def get_price_index(
    county: str | None = Query(None, description="Filter by county name"),
) -> JSONResponse:
    """
    Returns the Property Price Index aggregated by county and property type.
    In production: queries atlas_intelligence.fct_property_price_index (dbt mart).
    """
    try:
        df = _load_latest_parquet()

        if county:
            df = df[df["county"].str.lower() == county.lower()]
            if df.empty:
                raise HTTPException(
                    status_code=404,
                    detail=f"No data found for county: {county}",
                )

        # Simulate PPI: group by county + property type and compute avg price
        ppi = (
            df.groupby(["county", "property_type"])
            .agg(
                listing_count=("listing_id", "count"),
                avg_price_ksh=("listing_price_ksh", "mean"),
                avg_rent_ksh=("asking_rent_ksh", "mean"),
            )
            .round(2)
            .reset_index()
            .to_dict(orient="records")
        )

        return JSONResponse({
            "status":   "ok",
            "filter":   {"county": county or "all"},
            "results":  ppi,
        })

    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))


# ---------------------------------------------------------------------------
# GET /api/v1/analytics/neighbourhoods — Neighbourhood intelligence
# ---------------------------------------------------------------------------

@router.get("/neighbourhoods", summary="Neighbourhood Intelligence")
async def get_neighbourhoods(
    county: str | None = Query(None, description="Filter by county"),
) -> JSONResponse:
    """
    Returns aggregated intelligence per neighbourhood.
    In production: queries atlas_core.dim_neighbourhood (dbt model).
    """
    try:
        df = _load_latest_parquet()

        if county:
            df = df[df["county"].str.lower() == county.lower()]

        neighbourhoods = (
            df.groupby(["county", "neighbourhood"])
            .agg(
                listing_count=("listing_id", "count"),
                avg_price_ksh=("listing_price_ksh", "mean"),
                avg_rent_ksh=("asking_rent_ksh", "mean"),
                avg_bedrooms=("bedrooms", "mean"),
            )
            .round(2)
            .reset_index()
            .sort_values("avg_price_ksh", ascending=False)
            .to_dict(orient="records")
        )

        return JSONResponse({
            "status":       "ok",
            "total":        len(neighbourhoods),
            "results":      neighbourhoods,
        })

    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
