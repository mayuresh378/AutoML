# Full Production Audit — 42 Phases

**Targets:** Frontend `https://auto-ml-black.vercel.app`, Backend `https://automl-rihy.onrender.com`.
**Constraints:** Read-only audit + targeted fixes. No architecture rewrite, no mock data, no destructive DB ops, no fabricated verification.

---

## ALREADY VERIFIED (this session + prior)

| Item | Finding |
|---|---|
| Dataset module | 15 endpoints missing auth/ownership; upload cross-user overwrite; preview full-scan; status wrong. (22 fixes planned) |
| Login gate + auth nav | Committed (`31578df`). RequireAuth + all auth pages navigate via react-router. |
| Perf (polling + dataset meta cache) | Committed (`7550921`). |
| Build | `npm run build` passes. `npm test` 56/56 pass (7 frontend test files). |
| Backend tests | **NONE** — `pytest.ini` points to `tests/` but 0 `test_*.py` files exist. |
| Live rihy health | `GET /health` → 404 (stale code; fix deploys to rihy). |
| Live Vercel `/app/dashboard` | → 404 NOT_FOUND (old vercel.json w/o SPA fallback; redeploy fixes). |
| **CRITICAL env bug** | `frontend/.env.production` = `VITE_API_URL=https://automl-api.onrender.com/api/v1` (SUSPENDED). `vercel.json` rewrite → `automl-api.onrender.com`. Live bundle uses rihy, but **fresh Vercel rebuild breaks** → must point to `automl-rihy.onrender.com`. |

---

## STRUCTURAL MAP (read-only)

- **Frontend routes (~47):** `/` + auth pages + `/app/*` (dashboard, datasets, projects, ML, deployment, monitoring, settings, SQL, explain, evaluation, AI) + `/app/projects/:id/*` + `/app/projects/:id/data/*` + `/app/projects/:id/ml/*` + `/app/projects/:id/production/*` + standalone `/app/explorer`, `/app/profiling`, `/app/cleaning`, `/app/feature-engineering`, `/app/pipelines`, `/app/model-comparison`, `/app/prediction`, `/*`.
- **Backend endpoints (~100+):** grouped Health, Auth, Security/CSRF, Search, Notifications, Datasets (17), Experiments, Training, Models, Tuning/HPO, Engine, Deployments.
- **DB models:** User, Project, Dataset (+DatasetShare), Experiment, Model (+ModelRegistry), Deployment, PredictionLog, Notification, ApiKey, Team, TeamMember, AuditLog, Webhook, Session, Subscription, Credit, Feature. PostgreSQL + SQLite dev.
- **Auth:** Firebase Google (ID token → `get_current_user` 3-path verify) + own JWT + API keys. `get_optional_user` for reads.
- **Security middleware:** CORS (`*.vercel.app|*.onrender.com`), RateLimit (60/min), CSRF, TrustedHost, SecurityHeaders.
- **Storage:** `DATASET_DIR` (`dataset/`), `MODELS_DIR` (`models/`).
- **Env:** `.env` (actual, secrets — must NOT be exposed), `.env.example`, `backend/.env.example`, `frontend/.env.production`.
- **Render:** `Dockerfile`, `backend/start.sh`, `render.yaml`.
- **Frontend build:** Vite, Tailwind, Framer Motion, Recharts, Zustand, TanStack Query, Lucide. `vercel.json` (SPA rewrite + API rewrite).

---

## PLAN (read-only audit → targeted fixes)

### PHASE 1 — BUILD & STARTUP
- Read `package.json`, `tsconfig`, `vite.config`, `pytest.ini`; verify build scripts.
- **Verification (if mode lifted):** `npm install && npm run build`, `pytest`.
- Known: build passes, 56 frontend tests pass, 0 backend tests.

### PHASE 2 — ROUTE AUDIT
- Map all ~47 routes from `routes/index.tsx`.
- Check direct nav / refresh / auth-guard behavior (RequireAuth.tsx).
- **Known bug:** `/app/datasets/:name` missing → Open → NotFound (fix planned).
- **Known bug:** Vercel SPA fallback in deployed project is old → `/app/dashboard` 404 (redeploy fixes).

### PHASE 3 — DASHBOARD
- Read DashboardPage + widgets (DatasetHealthWidget). Check Query keys, polling, no hardcoded values.
- **Known:** Dashboard calls `useDashboardData()` (11 queries). Check for duplicate/stale issues.

### PHASE 4 — DATASETS *(largest block)*
- Full lifecycle: upload/validation/processing/metadata/storage/listing/preview/detail/rename/delete.
- **All 22 fixes** (auth/ownership, upload collision, status, preview slicing) planned.
- Test CSV/Excel/Parquet paths in `_get_dataset_df`, `_preview_df`, `_dataset_total_rows`.
- User isolation: `require_dataset_access`.

### PHASE 5–8 — EXPLORER / PROFILING / CLEANING / FEATURE ENGINEERING
- Read ExplorerPage, DatasetAnalysisPage, CleaningPage, FeatureEngineeringPage.
- Trace → `datasetsService.preview/profile/analyze/clean/generate/suggest`.
- Verify data originates from selected dataset (no demo/random).
- Check division-by-zero, NaN, empty/constant columns in profile/analyze.
- **Known:** Explorer/Cleaning/FeatureEng download uses `window.open(downloadUrl(...))` → auth-token bug (fix: `datasetsService.downloadFile`).

### PHASE 9–12 — AUTOML / TRAINING / HYPERPARAM / EXPERIMENTS
- Read `train.py`, `engine.py`, `hpo.py`, `pipeline_engine.py`.
- Verify algorithms (RF, XGBoost, LightGBM, CatBoost, SVR, SVC, Logistic) — check imports/availability.
- Verify training job lifecycle (QUEUED/RUNNING/COMPLETED/FAILED/CANCELLED), SSE progress, artifacts.
- Verify experiments belong to user/project.
- Check data leakage (train/test split, preprocessing fit on train only).

### PHASE 13–18 — MODEL REGISTRY / EVALUATION / EXPLAIN / COMPARISON / DEPLOYMENT / BATCH PREDICTION
- Read `models.py` (ModelRegistry), `evaluation.py`, `explain.py`, `features.py`, `prediction.py`, `batch_prediction.py`.
- Verify artifacts exist vs "registered" display.
- Verify metrics match model type (classification: accuracy/precision/recall/F1/AUC; regression: MAE/MSE/RMSE/R²).
- Verify SHAP integration; unsupported model error.
- Verify deployment → endpoint → real prediction (not fake).
- Verify batch input columns match model.

### PHASE 19–27 — MONITORING / PIPELINES / AI COPILOT / PROJECTS / TEAMS / API KEYS / WEBHOOKS / ACTIVITY / SEARCH
- Read `monitoring.py`, `activity.py`, `search.py`, `webhooks.py`, `teams.py`, `api_keys.py`, `ai_assistant.py`, `notifications.py`, `pipeline_engine.py`.
- Verify real data (no random metrics).
- Verify user/project/team isolation.
- Verify AI copilot: auth, dataset/model context, timeout, error handling, no exposed API keys.
- Verify webhook delivery/retry without exposing secrets.

### PHASE 28–30 — SEARCH / SETTINGS / SECURITY AUDIT
- Read global search; verify permissions (User A cannot discover User B's private resources).
- Read settings pages; verify persistence after refresh.
- **Security audit:** CORS, CSRF, rate limit, trusted host, upload validation, path traversal (`validate_path`), SQL injection (parameterized SQLAlchemy), XSS (React escaping), secret exposure (search frontend bundle for keys/urls/passwords — do NOT read `.env` actual).
- **Known:** `validate_path` exists (path-traversal guard); CSRF middleware exists; rate limit exists; CORS scoped to vercel/onrender.

### PHASE 31–33 — API AUDIT / FRONTEND API AUDIT / PERFORMANCE
- Enumerate all ~100+ endpoints; build matrix (Endpoint | Method | Auth | Purpose | Result).
- Frontend audit: `localhost`/`127.0.0.1`/hardcoded URLs, dead endpoints, incorrect paths/methods.
- **Known bug:** `frontend/.env.production` + `vercel.json` rewrite → `automl-api.onrender.com` (SUSPENDED). Must → `automl-rihy.onrender.com`.
- Performance: duplicate API calls (Dashboard 11 queries), polling intervals, large responses, React Query cache keys.
- **Known fixes:** polling reduced (perf commit `7550921`), dataset meta cache added.

### PHASE 34 — RENDER PRODUCTION
- Read `Dockerfile`, `backend/start.sh`, `render.yaml`, `config.py`.
- Verify: `0.0.0.0:$PORT`, no `--reload`, `/health` lightweight, idempotent `init_db()`.
- **Known:** Dockerfile/start.sh/render.yaml verified good. `GET /health` → 404 on rihy = stale code (redeploy fixes).

### PHASE 35 — FIREBASE AUTH
- Read `auth.py` (`get_current_user` 3-path), `firebase` config.
- Verify Google login → ID token → user lookup/creation → PostgreSQL → authenticated API.
- Test expired/invalid token → 401, refresh, logout.

### PHASE 36 — DATABASE
- Read `database.py`, `models.py` relationships, `crud.py`.
- Check indexes, FKs, connection pooling, `init_db()` idempotency, `_migrate_*` non-destructive.
- Look for N+1 (selectinload usage), missing indexes, race conditions.
- **Constraint:** NEVER DROP/TRUNCATE production.

### PHASE 37–38 — ERROR HANDLING / REAL DATA ACCURACY
- Every feature: Loading/Success/Empty/Error/Retry.
- Compare UI numbers vs backend/database calculations (dataset rows/cols, model accuracy, prediction counts, API counts, latency).
- Fix discrepancies at source.

### PHASE 39–42 — WORKFLOW / FAILURE / FIX STRATEGY / REGRESSION
- Full workflow (login → project → upload → profile → clean → features → AutoML → train → compare → evaluate → explain → register → deploy → predict → batch → monitoring → activity → notifications → refresh → logout → re-login → persist).
- Failure injection (backend down, expired/invalid token, invalid/oversized/malformed dataset, nonexistent/unauthorized resource, failed training/deployment, invalid prediction, DB timeout).
- Fix strategy: reproduce → root cause → fix → test → regression.
- **Regression:** `npm test`, `npm run build`, `pytest`, `npm run lint`, production API checks.

---

## FINAL REPORT (to fill after verification)

Table (Feature | Status | Bugs Found | Fixed | Tested):
Dashboard | ⏳ | | | ; Projects | ⏳ | | | ; Datasets | ⏳ | | | ; Data Explorer | ⏳ | | | ; Data Profiling | ⏳ | | | ; Data Cleaning | ⏳ | | | ; Feature Engineering | ⏳ | | | ; AutoML | ⏳ | | | ; Training | ⏳ | | | ; Hyperparameter Tuning | ⏳ | | | ; Experiments | ⏳ | | | ; Evaluation | ⏳ | | | ; Explain AI | ⏳ | | | ; Model Registry | ⏳ | | | ; Model Comparison | ⏳ | | | ; Deployment | ⏳ | | | ; Batch Prediction | ⏳ | | | ; Monitoring | ⏳ | | | ; Pipeline Builder | ⏳ | | | ; AI Copilot | ⏳ | | | ; Teams | ⏳ | | | ; API Keys | ⏳ | | | ; Webhooks | ⏳ | | | ; Notifications | ⏳ | | | ; Activity | ⏳ | | | ; Search | ⏳ | | | ; Settings | ⏳ | | | ; Authentication | ⏳ | | | ; Security | ⏳ | | | .

### Sections to fill after verification:
1. Critical Bugs
2. Root Causes
3. Fixes Applied
4. Files Changed
5. Database Changes
6. Environment Variables (names only, no secrets)
7. API Audit (total/tested/pass/fail)
8. Frontend Audit (routes/tested/pass/fail)
9. Security Audit
10. Performance Audit
11. Test Results (pytest/frontend tests/TypeScript/build/production/e2e)
12. Remaining Issues

---

## OPEN QUESTIONS FOR THE USER

1. **Scope priority:** The 42-phase audit is enormous. Given I'm currently read-only (plan mode), should I prioritize a subset (e.g., Phases 1–4, 30–34, 37–38 = build/routes/dashboard/datasets/security/performance/error-accuracy) and defer the rest, or proceed through all phases?
2. **Execution access:** To actually run fixes + tests + verify production, plan mode must be lifted and the edit-permission policy (`"edit" → deny`) must be adjusted. Can that be arranged?
3. **Shared-dataset deletion:** Owner-only after fix — acceptable, or should first-uploader be able to delete `user_id IS NULL` datasets?
4. **Env fix confirmation:** Fix `.env.production` + `vercel.json` to point to `automl-rihy.onrender.com`? (Confirmed the live bundle already uses rihy; the repo files are stale.)
5. **Backend tests:** There are ZERO `test_*.py` files. Should I add backend tests, or is frontend-only testing sufficient for the regression gate?
6. **Rename endpoint:** No backend endpoint exists; left as NOT TESTED. Want me to add `PUT /datasets/{name}/rename`?
