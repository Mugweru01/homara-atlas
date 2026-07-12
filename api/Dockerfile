# Multi-stage production Dockerfile for Homara Atlas FastAPI backend
# Base: Python 3.11-slim (not root, minimal attack surface)

FROM python:3.11-slim AS base
WORKDIR /app

# Install system dependencies needed for Pandas/PyArrow
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ---- deps ----
FROM base AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ---- runner ----
FROM base AS runner

# Security: run as a non-root user
RUN groupadd --system atlasapp && useradd --system --gid atlasapp atlasapp

# Copy installed packages from deps stage
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Copy source code
COPY --chown=atlasapp:atlasapp ./app ./app

USER atlasapp

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
