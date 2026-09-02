FROM python:3.11-slim AS builder

WORKDIR /build
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt && \
    pip install --no-cache-dir --prefix=/install psycopg2-binary

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl nodejs npm && \
    rm -rf /var/lib/apt/lists/*

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
    CMD curl -sf http://localhost:8000/api/v1/health || exit 1

EXPOSE 10000

CMD ["/bin/sh", "/app/backend/start.sh"]
