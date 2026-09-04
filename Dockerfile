FROM python:3.11-slim AS builder

WORKDIR /build
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt && \
    pip install --no-cache-dir --prefix=/install psycopg2-binary

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

# The app runs as a non-root system user (uid 1001) whose default HOME is
# /nonexistent. HOME=/tmp gives the runtime a writable home (needed by pip,
# joblib, etc.) without ever running as root.
ENV HOME=/tmp \
    PYTHONUNBUFFERED=1

COPY --from=builder /install /usr/local

COPY backend/ /app/backend/
COPY prisma/ /app/prisma/
COPY package.json /app/package.json

RUN mkdir -p /app/dataset /app/models /app/reports && \
    chmod +x /app/backend/start.sh && \
    addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --gid 1001 app && \
    chown -R app:app /app

WORKDIR /app/backend

USER app

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -sf "http://127.0.0.1:${PORT:-10000}/health" || exit 1

EXPOSE 10000

CMD ["/bin/sh", "/app/backend/start.sh"]
