# Deployment Guide

## Docker Deployment

### Build Images

```bash
# Backend
docker build -t automl-backend .

# Frontend
cd frontend && docker build -t automl-frontend .
```

### Docker Compose (recommended)

```bash
# Set environment
cp backend/.env.example backend/.env
# Edit backend/.env for production settings

# Deploy
docker compose up -d

# Check status
docker compose ps
docker compose logs -f
```

Services: postgres (16-alpine), redis (7-alpine), backend (FastAPI), frontend (Nginx).

### Health Checks

```bash
# Liveness probe
curl http://localhost:8000/api/v1/health/live

# Readiness probe
curl http://localhost:8000/api/v1/health/ready

# Full health check
curl http://localhost:8000/api/v1/health
```

## CI/CD Pipeline

GitHub Actions workflow at `.github/workflows/ci.yml`:

| Stage | Steps |
|-------|-------|
| backend-lint-test | ruff lint, mypy type check, pytest |
| frontend-lint-build | tsc type check, npm run build |
| docker-build | Multi-arch build, push to ghcr.io |
| deploy | Triggered on release |

### Secrets Required

| Secret | Description |
|--------|-------------|
| GITHUB_TOKEN | Auto-provided by GitHub Actions |
| (Add) DEPLOY_KEY | SSH key for production server |

## Production Checklist

- [ ] Change all secrets (JWT_SECRET, CSRF_SECRET, database passwords)
- [ ] Set ENVIRONMENT=production
- [ ] Use PostgreSQL (not SQLite)
- [ ] Configure SMTP for email notifications
- [ ] Enable rate limiting (already on by default)
- [ ] Set CORS_ORIGINS to your domain
- [ ] Configure TRUSTED_HOSTS
- [ ] Run Prisma migrations
- [ ] Set up log aggregation (use JSON log format)
- [ ] Configure Prometheus metrics scraping (/metrics endpoint)

## Monitoring

```bash
# System metrics
curl http://localhost:8000/api/v1/monitoring/metrics

# Prometheus metrics
curl http://localhost:8000/metrics
```

## Database Migrations

If schema changes are needed:

```bash
# Prisma (new migrations)
npx prisma migrate dev --name <name>

# Apply in production
npx prisma migrate deploy
```
