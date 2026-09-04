#!/bin/sh
set -e

# Prisma migration step. The repository currently ships NO prisma/migrations and the
# backend runtime is SQLAlchemy-based, so there is nothing for `prisma migrate deploy`
# to apply. If Prisma migrations are ever added, this step runs them here and any
# failure aborts the boot (no `|| true`, no silent continue).
if [ -d "/app/prisma/migrations" ] && command -v prisma >/dev/null 2>&1; then
  echo "Deploying production database migrations with Prisma..."
  prisma migrate deploy
else
  echo "No Prisma migrations present; schema is managed by SQLAlchemy init_db()"
fi

# Create missing tables/columns. Idempotent: creates only what is absent,
# never drops or resets production data. Fails loudly if the DB is unreachable.
python -c "from database import init_db; init_db()"

PORT="${PORT:-10000}"
exec uvicorn main:app --host 0.0.0.0 --port "$PORT"
