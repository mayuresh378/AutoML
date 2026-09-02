# Installation Guide

## Prerequisites

- Python 3.11+
- Node.js 20+
- npm 10+
- Git

## Development Setup

### 1. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your settings (JWT_SECRET, etc.)

# Initialize database (SQLite)
python -c "from database import init_db; init_db()"

# Start server
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

### 3. Docker (full stack)

```bash
# Edit backend/.env with your configuration
cd backend
cp .env.example .env
cd ..

# Start all services
docker compose up -d

# View logs
docker compose logs -f
```

## Production Setup

### Environment Variables

Key variables in `backend/.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| JWT_SECRET | JWT signing key (change in production) | (required) |
| DATABASE_URL | PostgreSQL connection string | sqlite:///automl.db |
| REDIS_URL | Redis connection string | (optional) |
| CORS_ORIGINS | Allowed origins | http://localhost:5173 |
| ENVIRONMENT | production/development | development |
| PORT | Backend port | 8000 |
| MAX_UPLOAD_MB | Max upload size (MB) | 500 |
| SMTP_HOST | SMTP server for emails | (optional) |

### PostgreSQL Setup

For production, use PostgreSQL instead of SQLite:

```bash
# Create database
createdb automl

# Set DATABASE_URL
export DATABASE_URL=postgresql://user:password@host:5432/automl

# Run Prisma migrations
npx prisma migrate deploy
```

## Verification

```bash
# Test backend
curl http://localhost:8000/api/v1/health

# Test frontend
curl http://localhost:5173

# API docs
open http://localhost:8000/docs
```
