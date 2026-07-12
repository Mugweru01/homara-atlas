"""
System Router.
Provides health monitoring and Prometheus-compatible system metrics.
"""

import time
from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response

router = APIRouter()

# Global in-memory metrics store for local development.
# In production, these metrics are scraped by Prometheus or pushed to CloudWatch.
METRICS = {
    "http_requests_total": 0,
    "http_request_duration_seconds_sum": 0.0,
    "http_request_duration_seconds_count": 0,
    "ingestion_jobs_triggered_total": 0,
    "ingestion_jobs_failed_total": 0,
}

@router.get("/health", summary="Health Check")
async def health_check() -> JSONResponse:
    """
    Returns the operational status of the Atlas API.
    Used by load balancers, uptime monitors, and the frontend dashboard.
    """
    return JSONResponse(
        {
            "status": "healthy",
            "service": "homara-atlas-api",
            "version": "1.0.0",
            "timestamp": time.time(),
        }
    )

@router.get("/metrics", summary="Prometheus Metrics")
async def get_metrics() -> Response:
    """
    Exposes system metrics in a standard Prometheus text format.
    Scraped periodically by Prometheus server.
    """
    avg_latency = 0.0
    if METRICS["http_request_duration_seconds_count"] > 0:
        avg_latency = METRICS["http_request_duration_seconds_sum"] / METRICS["http_request_duration_seconds_count"]

    # Format into standard Prometheus exposition format
    prometheus_data = (
        f"# HELP http_requests_total Total number of HTTP requests processed.\n"
        f"# TYPE http_requests_total counter\n"
        f"http_requests_total {METRICS['http_requests_total']}\n\n"
        
        f"# HELP http_request_duration_seconds_sum Sum of HTTP request latencies.\n"
        f"# TYPE http_request_duration_seconds_sum counter\n"
        f"http_request_duration_seconds_sum {METRICS['http_request_duration_seconds_sum']:.4f}\n\n"
        
        f"# HELP http_request_duration_seconds_count Count of HTTP request latencies.\n"
        f"# TYPE http_request_duration_seconds_count counter\n"
        f"http_request_duration_seconds_count {METRICS['http_request_duration_seconds_count']}\n\n"

        f"# HELP http_request_duration_seconds_avg Average HTTP request latency.\n"
        f"# TYPE http_request_duration_seconds_avg gauge\n"
        f"http_request_duration_seconds_avg {avg_latency:.4f}\n\n"

        f"# HELP ingestion_jobs_triggered_total Total number of ingestion pipeline jobs triggered.\n"
        f"# TYPE ingestion_jobs_triggered_total counter\n"
        f"ingestion_jobs_triggered_total {METRICS['ingestion_jobs_triggered_total']}\n\n"

        f"# HELP ingestion_jobs_failed_total Total number of ingestion pipeline jobs that failed.\n"
        f"# TYPE ingestion_jobs_failed_total counter\n"
        f"ingestion_jobs_failed_total {METRICS['ingestion_jobs_failed_total']}\n"
    )
    
    return Response(content=prometheus_data, media_type="text/plain")
