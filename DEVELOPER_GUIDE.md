# Developer Guide

## Development Environment Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- npm 10+
- Git
- Docker (optional, for containerized dev)

### Initial Setup

```bash
# Clone repository
git clone <repo-url>
cd automl-platform

# Backend setup
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Initialize database
python -c "from database import init_db; init_db()"

# Frontend setup
cd ../frontend
npm install
```

### Running in Development

```bash
# Terminal 1: Backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev -- --port 5173
```

The frontend dev server proxies /api requests to the backend.

## Codebase Conventions

### Backend (Python)

**Structure**: Each domain has its own module (auth.py, train.py, etc.). Route definitions are centralized in main.py.

**Naming**:
- Functions: snake_case
- Classes: PascalCase
- Constants: UPPER_SNAKE_CASE
- Routes: /api/v1/resource-name
- Database tables: snake_case (plural)

**API Response Format**:
All endpoints return the standard envelope via api_responses.py:
- `ok(data, message)` for success (200)
- `created(data, message)` for creation (201)
- `deleted(message)` for deletion (200)
- `error(detail, status_code)` for errors
- `paginated(items, total, offset, limit)` for lists

**Middleware order** (applied top to bottom):
1. TrustedHostMiddleware
2. RequestLogMiddleware (adds X-Request-ID)
3. SecurityHeadersMiddleware (Helmet headers)
4. RateLimitMiddleware (60 req/min)
5. CSRFMiddleware (state-changing methods)
6. CORSMiddleware
7. Exception handlers (global + validation)

### Frontend (React/TypeScript)

**Component structure**:
- Pages in `src/pages/` (one file per page)
- Reusable components in `src/components/`
- Hooks in `src/hooks/`
- State stores in `src/store/`
- Utilities in `src/lib/`

**Naming**:
- Components: PascalCase (Dashboard.tsx)
- Files: PascalCase for components, camelCase for utilities
- Hooks: useCamelCase
- CSS classes: Tailwind utility classes only

**State management**:
- zustand stores for UI state (activePage, theme)
- TanStack React Query for server state (data fetching, caching)
- Local useState for component-specific state

**Data fetching pattern**:
```tsx
// Define hook in hooks/useApi.ts
export function useExperiments() {
  return useQuery({
    queryKey: ['experiments'],
    queryFn: () => api.get('/api/v1/experiments'),
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

// Use in page component
function MyPage() {
  const { data, isLoading } = useExperiments();
  if (isLoading) return <LoadingSpinner />;
  return <div>...</div>;
}
```

## Adding a New Feature

### 1. Database Model (if needed)
Add model in `backend/models.py` and Prisma model in `prisma/schema.prisma`.

```python
class MyModel(Base):
    __tablename__ = "my_models"
    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    user_id = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=_now)
```

### 2. CRUD Functions
Add create/read/update/delete functions in `backend/crud.py`.

### 3. API Endpoints
Add routes in `backend/main.py` with tags, summary, and description.

```python
@app.get("/api/v1/my-models", tags=["My Models"],
         summary="List my models",
         description="Returns paginated list of my models.")
def list_my_models(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), ...):
    items = crud.list_models(db)
    return paginated(items, len(items), offset, limit, key="models")
```

### 4. Frontend Page
Create page in `frontend/src/pages/`, add to `PAGE_MAP` in `App.tsx`.

### 5. React Query Hooks
Add hooks in `frontend/src/hooks/useApi.ts` for data fetching.

## Testing

### Backend Tests
```bash
cd backend
pytest tests/ -v
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Type Checking
```bash
# Backend
mypy backend/

# Frontend
cd frontend && npx tsc --noEmit
```

## Build & Deploy

### Docker Build
```bash
# Backend
docker build -t automl-backend .

# Frontend
cd frontend && docker build -t automl-frontend .

# Full stack
docker compose up -d
```

### Database Migrations
```bash
# Prisma: create migration after schema changes
npx prisma migrate dev --name description_of_change

# Apply in production
npx prisma migrate deploy
```

## Troubleshooting Common Issues

| Problem | Solution |
|---------|----------|
| pip install fails | Upgrade pip: python -m pip install --upgrade pip |
| Module not found | Check PYTHONPATH or run from project root |
| Database locked (SQLite) | Stop other processes, delete automl.db and re-init |
| CORS errors | Check CORS_ORIGINS in .env includes your frontend URL |
| CSRF token errors | GET /api/v1/csrf-token first, include x-csrf-token header |
| TypeScript errors | Run tsc --noEmit to check, fix type mismatches |
| Tailwind styles missing | Check postcss.config.js and tailwind.config.js |
