# AutoML Platform

A full-stack automated machine learning platform with drag-and-drop dataset management, AutoML training, model registry, deployment, monitoring, and AI-powered assistance.

## Features

- **Automated ML Pipeline**: Upload CSV/Excel/Parquet, auto-preprocess, train with multiple algorithms (Random Forest, XGBoost, LightGBM, CatBoost, SVR, SVC, Logistic Regression)
- **Hyperparameter Tuning**: Grid search with cross-validation
- **Model Registry**: Version, tag, stage, download trained models
- **Deployment**: One-click deployment with REST endpoint generation
- **Monitoring**: Track latency, request count, system metrics
- **Explainable AI**: SHAP-based prediction explanations
- **Pipeline Engine**: Multi-step ML pipelines with scheduling
- **Data Tools**: Profiling, cleaning, feature engineering, SQL querying
- **AI Assistant**: Natural language queries about your data and models
- **Team Collaboration**: Projects, teams, API keys, role-based access
- **Security**: CSRF protection, rate limiting, XSS sanitization, SQL injection prevention, security headers (Helmet-equivalent)
- **Notifications**: Real-time alerts for training completion, deployments, errors

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS, Framer Motion, Recharts, Zustand, TanStack React Query, Lucide Icons |
| Backend | Python 3.11+, FastAPI, SQLAlchemy, Prisma ORM, Pydantic v2 |
| Database | SQLite (dev), PostgreSQL 16 (prod), Redis 7 (caching) |
| ML/AI | scikit-learn, XGBoost, LightGBM, CatBoost, SHAP, pandas, NumPy |
| DevOps | Docker, Docker Compose, GitHub Actions CI/CD, Prometheus metrics |
| Auth | JWT (python-jose), bcrypt, Google OAuth, MFA-ready |

## Quick Start

```bash
# Clone
git clone https://github.com/your-org/automl-platform.git
cd automl-platform

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python -c "from database import init_db; init_db()"
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (frontend) and http://localhost:8000/docs (API).

## Project Structure

```
automl-platform/
  backend/          # FastAPI REST API
    main.py         # Router with 80+ endpoints
    models.py       # SQLAlchemy ORM models
    crud.py         # Database CRUD operations
    auth.py         # Authentication & authorization
    train.py        # Model training engine
    predict.py      # Inference engine
    middleware.py    # Security middleware
    config.py       # Centralized configuration
  frontend/         # React SPA
    src/
      pages/        # 35 page components
      components/   # 21 reusable components
      hooks/        # React Query hooks
      store/        # Zustand stores
  prisma/           # Prisma schema & migrations
  dataset/          # Uploaded datasets
  models/           # Trained model artifacts
  docker-compose.yml
  Dockerfile
```

## API Overview

80+ REST endpoints at `/api/v1/*`. Full docs at `/docs` (Swagger) and `/redoc` (ReDoc).

Core groups: Auth, Datasets, Training, Experiments, Models, Deployments, Predictions, Pipelines, Projects, Teams, Webhooks, Search, Notifications, Activity, Analytics, Admin, Monitoring, Health.

## License

MIT
