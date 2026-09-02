# Admin Manual

## Admin Panel Access

Navigate to Admin (requires admin role). The panel has 6 tabs:

## 1. Overview
System-wide statistics:
- Total users, projects, datasets, experiments, models, deployments
- Active users this week
- Storage usage breakdown
- Recent audit log entries

## 2. Users
User management:
- View all registered users (paginated)
- Search by name or email
- View user details: created date, last active, project count
- User roles: member, admin

## 3. Projects
View all projects across the platform:
- Project name, owner, status, created date
- Filter by status (development, production, archived)
- Delete inappropriate projects

## 4. Datasets
Global dataset view:
- Filename, uploader, size, rows, columns
- Status indicators
- Storage consumption per dataset
- Remove orphaned datasets

## 5. Logs
Audit log viewer:
- Search by actor, action, resource type
- Filter by severity (info, warning, error)
- Filter by status (success, failure)
- Timestamp-based sorting
- JSON detail expansion

## 6. Storage
Storage analytics:
- Total used space
- Breakdown by category (datasets, models, exports)
- Dataset size distribution
- Cleanup recommendations

## Monitoring

### Health Check
```bash
# Full health status
curl http://localhost:8000/api/v1/health

# Liveness probe (is app running?)
curl http://localhost:8000/api/v1/health/live

# Readiness probe (is app ready for traffic?)
curl http://localhost:8000/api/v1/health/ready
```

### System Metrics
```bash
curl http://localhost:8000/api/v1/monitoring/metrics
```

Returns: CPU percent/cores/load, memory total/available/used, disk usage, network I/O.

### Prometheus Metrics
```bash
curl http://localhost:8000/metrics
```

Returns: automl_build_info, automl_cpu_percent, automl_memory_percent, automl_memory_available_bytes, automl_disk_percent, automl_disk_free_bytes

### Platform Stats
```bash
curl http://localhost:8000/api/v1/monitoring/stats
```

Returns: models trained, active deployments, today's inferences, average latency.

## Logging

Structured JSON logging (production):
```json
{"timestamp": "2026-07-14T15:30:00Z", "level": "INFO", "logger": "access", "message": "GET /api/v1/health 200 5ms"}
```

Log levels: LOG_LEVEL env var (default INFO), SQL_LOG_LEVEL (default WARN).

Each request gets a unique X-Request-ID header for tracing.

## Rate Limiting

Default: 60 requests/minute per client.
Headers: X-RateLimit-Remaining, X-RateLimit-Reset.
Configure via RATE_LIMIT_MAX and RATE_LIMIT_WINDOW_SEC env vars.

## Security

- CSRF tokens required for state-changing operations (exempted for auth endpoints)
- Security headers set on all responses (CSP, HSTS, XFO, etc.)
- Input sanitization (XSS, SQL injection)
- JWT tokens expire after configurable duration
- Refresh token rotation
- Rate limiting per IP + API key

## Troubleshooting

| Issue | Check |
|-------|-------|
| App won't start | Check DATABASE_URL, port availability, Python version |
| Database errors | Run prisma migrate deploy, check DB connection |
| 401 Unauthorized | Verify JWT_SECRET, token expiry |
| 403 Forbidden | Check CSRF token header (x-csrf-token) |
| 429 Too Many Requests | Check rate limit headers, increase RATE_LIMIT_MAX |
| 503 Service Unavailable | Check health/live and health/ready endpoints |
| Slow queries | Check SQL_LOG_LEVEL, add DB indexes |
| Upload fails | Check MAX_UPLOAD_MB, disk space, file extension |
