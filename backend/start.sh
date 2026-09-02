#!/bin/sh
set -e

# Run Prisma database migrations in production when DATABASE_URL is provided
if [ -n "$DATABASE_URL" ]; then
  echo "Deploying production database migrations with Prisma..."
  if command -v npx >/dev/null 2>&1; then
    npx prisma migrate deploy || true
  elif command -v prisma >/dev/null 2>&1; then
    prisma migrate deploy || true
  fi
fi

# Run database schema initialization & migrations fallback
python -c "from database import init_db; init_db()" || true

PORT="${PORT:-10000}"
exec uvicorn main:app --host 0.0.0.0 --port "$PORT" --workers 2 --limit-max-requests 10000
