"""Optional local demonstration API / read-only bridge to the canonical Neon API.

Production collection, auth and metrics are implemented in functions/backend.
The bridge never reads the warehouse or runs synthetic ingestion in production.
"""

import os
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse


def create_app() -> FastAPI:
    production = os.getenv("ENVIRONMENT") == "production"
    instance = FastAPI(
        title=(
            "Atlas API compatibility bridge"
            if production
            else "Atlas local demonstration API"
        ),
        version="2.0.0",
        docs_url=None if production else "/docs",
        redoc_url=None,
        openapi_url=None if production else "/openapi.json",
        debug=False,
    )
    instance.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=os.getenv(
            "ATLAS_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver"
        ).split(","),
    )
    instance.add_middleware(
        CORSMiddleware,
        allow_origins=os.getenv(
            "ATLAS_ALLOWED_ORIGINS", "http://localhost:5184,http://127.0.0.1:5184"
        ).split(","),
        allow_credentials=False,
        allow_methods=["GET", "POST"] if not production else ["GET"],
        allow_headers=["Content-Type"],
    )

    @instance.middleware("http")
    async def headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        return response

    if production:
        base = os.environ.get("NEON_FUNCTION_ATLAS_BASE_URL", "").rstrip("/")
        parsed = urlparse(base)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or not parsed.hostname.endswith(".neon.tech")
            or parsed.username
            or parsed.query
            or parsed.fragment
            or parsed.path
        ):
            raise RuntimeError(
                "A valid NEON_FUNCTION_ATLAS_BASE_URL is required for the production bridge"
            )
        allowed = {
            "system/health",
            "system/ready",
            "system/data-health",
            "analytics/overview",
            "analytics/price-index",
            "analytics/neighbourhoods",
            "analytics/market",
            "sources",
            "geography/counties",
            "context/indicators",
        }

        @instance.get("/api/v1/{path:path}")
        async def bridge(path: str, request: Request):
            if path not in allowed:
                raise HTTPException(
                    status_code=404, detail="Use the canonical authenticated Neon API"
                )
            try:
                async with httpx.AsyncClient(
                    timeout=15, follow_redirects=False
                ) as client:
                    result = await client.get(
                        f"{base}/api/v1/{path}", params=request.query_params
                    )
                return JSONResponse(result.json(), status_code=result.status_code)
            except (httpx.HTTPError, ValueError):
                raise HTTPException(
                    status_code=503, detail="Atlas backend unavailable"
                ) from None

    else:
        from app.routers import analytics, health, ingestion

        instance.include_router(health.router, prefix="/api/v1/system")
        instance.include_router(analytics.router, prefix="/api/v1/analytics")
        instance.include_router(ingestion.router, prefix="/api/v1/ingestion")
    return instance


app = create_app()
