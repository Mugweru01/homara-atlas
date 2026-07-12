"""
Ingestion Control Router.

These endpoints trigger and monitor Extract & Load (EL) pipeline jobs.
They do NOT serve market intelligence — that is handled by the analytics routers.
"""

import asyncio
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse

from app.ingestion.kenya_open_data import run_kenya_listings_ingestion

router = APIRouter()


@router.post("/trigger/kenya-listings", summary="Trigger Kenya Listings Ingestion")
async def trigger_kenya_listings(background_tasks: BackgroundTasks) -> JSONResponse:
    """
    Triggers the Kenya public property listings Extract & Load pipeline.
    The pipeline runs in the background and writes raw Parquet files to the Data Lake (S3/local).
    """
    job_id = f"kenya-listings-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
    background_tasks.add_task(run_kenya_listings_ingestion, job_id)
    return JSONResponse(
        {
            "job_id": job_id,
            "status": "STARTED",
            "message": "Kenya listings ingestion pipeline triggered.",
            "dataset": "kenya_public_property_listings",
        },
        status_code=202,
    )


@router.get("/jobs", summary="List Ingestion Jobs")
async def list_jobs() -> JSONResponse:
    """
    Returns a summary of recent ingestion jobs.
    In production this will query the `ingestion_jobs` table in Supabase.
    """
    return JSONResponse(
        {
            "message": "Job history will be fetched from Supabase ingestion_jobs table.",
            "docs": "See database/atlas_supabase_schema.sql for the schema.",
        }
    )
