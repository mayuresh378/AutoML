# Running AutoML Platform for preview

Full-stack app: FastAPI backend (`backend/`) + Vite/React frontend (`frontend/`).
The frontend dev server proxies `/api` to the backend, so both must be running.

## Reproduce the artifacts a fresh checkout needs

- **Backend env**: copy `backend/.env.example` → `backend/.env` (contains DB URL,
  JWT secret, Firebase keys). The checked-in `backend/.env` is already present in
  this checkout; `backend/automl.db` (SQLite) is committed so the DB is ready.
- **Backend deps**: `backend/.venv` is pre-created with `requirements.txt`
  installed (Windows venv: `backend/.venv/Scripts/python.exe`).
- **Frontend env**: copy `frontend/.env.example` → `frontend/.env` if missing
  (Firebase config; optional for dev).
- **Frontend deps**: `frontend/node_modules` via `npm install` (run inside
  `frontend/` — the root package.json is only a thin scaffold).

## Run the servers

Backend (port 8000, from `backend/`):

```
.venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Frontend (port 3000, from `frontend/`):

```
node_modules/.bin/vite --host 127.0.0.1 --port 3000
```

- `frontend/vite.config.ts` is authoritative: port **3000**, proxy `/api` →
  `http://127.0.0.1:8000`. Do NOT use the root `vite.config.ts` (no proxy).
- Detach on Windows with Start-Process using the real executable, e.g.:

```
powershell -NoProfile -Command "(Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList '<abs path>\frontend\node_modules\vite\bin\vite.js','--host','127.0.0.1','--port','3000' -WorkingDirectory '<abs path>\frontend' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
```

`npm.cmd` may not resolve inside Start-Process — use `node.exe` directly.
stdout and stderr must go to different files.

URLs: app at http://127.0.0.1:3000, API docs at http://127.0.0.1:8000/docs.