"""
Homara Atlas — FastAPI Application Entry Point.

Versioning strategy:
  - All API routes live under /api/v{N}/...
  - Breaking changes increment the major version
  - Current stable: v1
  - A v_router (APIRouter) aggregates all v1 routers so a future v2
    is added by duplicating v_router with a new prefix — no route changes needed.

Route map (v1):
  /api/v1/system/health          → system health check
  /api/v1/ingestion/trigger/*    → EL pipeline triggers
  /api/v1/ingestion/jobs         → job history
  /api/v1/analytics/overview     → dashboard KPI summary
  /api/v1/analytics/price-index  → Property Price Index
  /api/v1/analytics/neighbourhoods → Neighbourhood intelligence
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter

from app.routers import analytics, health, ingestion

# ---------------------------------------------------------------------------
# Application Factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Homara Atlas Intelligence API",
    description=(
        "The official API for the Homara Atlas Property Intelligence Platform. "
        "Provides market analytics, price indices, and neighbourhood intelligence "
        "derived exclusively from public and open datasets. "
        "No PII, operational, or Homara-internal data is ever processed here."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:8081",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        # Allow any local network IP (development only)
        "http://192.168.100.8:8080",
        "http://192.168.100.8:5173",
        "https://atlas.homara.co.ke",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# HTTP Request Metrics Middleware
# ---------------------------------------------------------------------------
import time
from fastapi import Request
from app.routers.health import METRICS

@app.middleware("http")
async def http_metrics_middleware(request: Request, call_next):
    # Skip metrics path to avoid noise
    if "/system/metrics" in request.url.path:
        return await call_next(request)

    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time

    METRICS["http_requests_total"] += 1
    METRICS["http_request_duration_seconds_sum"] += process_time
    METRICS["http_request_duration_seconds_count"] += 1

    return response

# ---------------------------------------------------------------------------
# v1 Router — aggregates all v1 sub-routers under /api/v1
# To introduce v2 in the future: duplicate this block with prefix="/api/v2"
# ---------------------------------------------------------------------------

v1_router = APIRouter(prefix="/api/v1")

v1_router.include_router(
    health.router,
    prefix="/system",
    tags=["v1 · System"],
)
v1_router.include_router(
    ingestion.router,
    prefix="/ingestion",
    tags=["v1 · Data Ingestion"],
)
v1_router.include_router(
    analytics.router,
    prefix="/analytics",
    tags=["v1 · Market Intelligence"],
)

app.include_router(v1_router)

# ---------------------------------------------------------------------------
# Root — API discovery endpoint
# ---------------------------------------------------------------------------

@app.get("/", include_in_schema=False)
async def root() -> JSONResponse:
    return JSONResponse(
        {
            "platform":    "Homara Atlas Intelligence API",
            "version":     "1.0.0",
            "status":      "operational",
            "stable_api":  "/api/v1",
            "docs":        "/docs",
            "redoc":       "/redoc",
            "endpoints": {
                "health":         "/api/v1/system/health",
                "overview":       "/api/v1/analytics/overview",
                "price_index":    "/api/v1/analytics/price-index",
                "neighbourhoods": "/api/v1/analytics/neighbourhoods",
                "ingest_trigger": "/api/v1/ingestion/trigger/kenya-listings",
            },
        }
    )
