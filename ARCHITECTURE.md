# System Architecture

## High-Level Architecture

```
                   +-------------------+
                   |   React SPA       |
                   |   (Port 5173)     |
                   +--------+----------+
                            |
                     HTTP/REST JSON
                            |
                   +--------+----------+
                   |   FastAPI App     |
                   |   (Port 8000)     |
                   +--------+----------+
                            |
              +-------------+-------------+
              |             |             |
         +----+----+  +----+----+  +-----+-----+
         | SQLAlch |  | Prisma  |  |   Redis   |
         |   ORM   |  |   ORM   |  | (Cache)   |
         +----+----+  +----+----+  +-----------+
              |             |
         +----+----+  +----+----+
         | SQLite  |  | Postgres|
         | (dev)   |  | (prod)  |
         +---------+  +---------+
```

## Component Breakdown

### Backend (Python/FastAPI)

| Module | Responsibility |
|--------|---------------|
| main.py | Route definitions, middleware, app lifecycle (80+ endpoints) |
| models.py | SQLAlchemy ORM models (18 tables) |
| crud.py | Database CRUD operations (46+ functions) |
| auth.py | JWT auth, registration, password management, Google OAuth |
| train.py | AutoML training engine (scikit-learn, XGBoost, LightGBM, CatBoost) |
| predict.py | Model inference (single + batch) |
| cleaning.py | Dataset profiling and cleaning |
| features.py | Feature engineering and suggestion |
| explain.py | SHAP-based prediction explanations |
| pipeline_engine.py | Multi-step ML pipeline execution |
| middleware.py | Security headers, rate limiting, CSRF protection |
| security_utils.py | XSS sanitization, SQL injection prevention, CSRF tokens |
| schemas.py | Pydantic request/response models |
| config.py | Centralized environment configuration |
| logging_config.py | Structured JSON logging, request ID middleware |
| monitoring.py | System metrics collection (CPU, memory, disk) |
| api_responses.py | Standardized response envelope helpers |
| analytics.py | Dashboard analytics queries |
| ai_assistant.py | Natural language Q&A over data/models |
| email_utils.py | SMTP email sending |

### Frontend (React/TypeScript)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Pages | React components | 35 route-able page components |
| Components | Reusable UI | 21 shared components (Sidebar, TopNav, Cards, Tables, etc.) |
| State | Zustand | UI state (active page, theme, notifications) |
| Data Fetching | TanStack React Query | Server state management, caching, background refresh |
| Routing | Custom (Zustand) | SPA page switching via activePage state |
| Styling | Tailwind CSS | Utility-first CSS with dark theme |
| Animations | Framer Motion | Page transitions, micro-interactions |
| Charts | Recharts | Analytics dashboards |
| Icons | Lucide React | SVG icon library |
| Forms | react-hook-form + zod | Form validation |

### Database (SQLAlchemy + Prisma)

18 tables with full foreign key relationships:

- users, teams, team_members
- projects, experiments, model_registry, deployments
- pipelines, pipeline_runs
- datasets, prediction_logs
- notifications, webhooks, api_keys, user_sessions
- audit_logs, activity_logs
- marketplace_items

## Data Flow

### Training Flow
1. User uploads dataset via POST /api/v1/datasets
2. Dataset is validated, profiled, and stored
3. User selects target column and task type
4. POST /api/v1/training triggers auto_preprocess -> run_automl_training
5. Multiple models are trained with cross-validation
6. Results stored in experiments table, best model in model_registry
7. Notification sent to user

### Prediction Flow
1. User selects deployed model
2. POST /api/v1/predict with input features
3. Model loaded from disk, prediction computed
4. Result returned with optional SHAP explanation
5. Prediction logged to prediction_logs table

## Security Architecture

- JWT tokens with configurable expiry
- CSRF token validation on state-changing requests
- Rate limiting (60 req/min per client)
- XSS sanitization on all user inputs
- SQL injection keyword blocking
- HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
- Trusted host validation
- CORS restricted to configured origins
