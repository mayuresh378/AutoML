# DATASETS Module — Audit, Fixes & Acceptance Report

**Backend target:** `https://automl-rihy.onrender.com` (user directive).
**Frontend target:** `https://auto-ml-black.vercel.app`.
**Repo state:** `backend/main.py`, `crud.py`, `models.py`, `auth.py`, `database.py`; `frontend/src/...`.
**Constraint:** no architecture rewrite, no second dataset system, no UI redesign, no removing endpoints/features, no mock data, no destructive DB ops, keep React Query + Zustand + Firebase auth + PostgreSQL + existing design system.

---

## 1. Audit Findings (read-only, verified by reading source)

### 1.1 Backend endpoint auth/ownership (`backend/main.py`)

| # | Endpoint (line) | Method | Auth state | Ownership | Finding |
|---|---|---|---|---|---|
| D1 | `/api/v1/datasets/{name}` | GET | none | none | ❌ no auth; full pandas read to return rows/cols/dtypes |
| D2 | `/api/v1/datasets/{name}/download` | GET | none | none | ❌ file disclosure to anyone who knows name |
| D3 | `/api/v1/datasets/{name}/delete` | DELETE | `get_optional_user` | none | ❌ anon allowed; any user can delete any file |
| D4 | `/api/v1/datasets/{name}/preview` | GET | none | none | ❌ no auth; reads full file then slices (full table scan) |
| D5 | `/api/v1/datasets/{name}/profile` | GET | none | none | ❌ no auth |
| D6 | `/api/v1/datasets/{name}/analyze` | GET | none | none | ❌ no auth |
| D7 | `/api/v1/datasets/{name}/features/suggest` | GET | none | none | ❌ no auth |
| D8 | `/api/v1/datasets/{name}/shares` | GET | none | none | ❌ no auth |
| D9 | `/api/v1/datasets/{name}/share` | POST | `get_optional_user` | none | ❌ anon can share; no ownership |
| D10 | `/api/v1/datasets/{name}/shares/{shareId}` | DELETE | `get_optional_user` | none | ❌ anon allowed |
| D11 | `/api/v1/datasets/{name}/clean` | POST | `get_optional_user` | none | ❌ anon can clean |
| D12 | `/api/v1/datasets/{name}/auto-clean` | POST | `get_optional_user` | none | ❌ anon |
| D13 | `/api/v1/datasets/{name}/features/generate` | POST | `get_optional_user` | none | ❌ anon |
| D14 | `/api/v1/datasets/{name}/tags` | PUT | `get_optional_user` | none | ❌ anon |
| D15 | `/api/v1/datasets/{name}/description` | PUT | `get_optional_user` | none | ❌ anon |
| OK | `/api/v1/datasets` | GET | `get_optional_user` | uid guard | ✅ returns empty for anon; scoping ok |
| OK | `/api/v1/datasets/sample/{name}` | POST | `get_current_user` | — | ✅ |
| OK | `/api/v1/datasets/import-url` | POST | `get_current_user` | — | ✅ |
| OK | `/api/v1/datasets/import-database` | POST | `get_current_user` | — | ✅ |

### 1.2 Upload (`POST /api/v1/datasets`, line 523)

| Issue | Detail |
|---|---|
| Cross-user file overwrite | `filename = sanitize_filename(file.filename)`. If User A uploaded `data.csv` and User B uploads `data.csv`, the physical file is silently overwritten and two DB records point to one file (User A now sees User B's content). |
| Duplicate record on re-upload | Same-user re-upload of same name creates a **new** `Dataset` record for the same physical file (no version bump on the existing record). |
| Status wrong after parse | `create_dataset_record` defaults `status='uploaded'`; after successful parse the record should be `ready`. |
| Response missing `status` | Upload response has no `status` field. |
| Validation leaks `str(e)` | `detail=f"Failed to parse: {str(e)}"` can expose internal messages/paths. |
| Blocks event loop | `upload_dataset` is `async def` but calls sync `_get_dataset_df` directly. |

### 1.3 `crud.py` (`crud.py:505-577`)

| Function | Issue |
|---|---|
| `create_dataset_record` | No `status` param; no duplicate/filename-collision handling. |
| `get_dataset_record` | Matches by filename only; no user scoping. |
| `delete_dataset_record` | Accepts `user_id` param but callers pass default `"system"` — ownership never enforced. |

### 1.4 Frontend

| File | Issue |
|---|---|
| `DatasetsPage.tsx:212,258` | `navigate(\`/datasets/${dataset.id || dataset.name}\`)` → **no such route** → NotFound. "Open/View" broken. |
| `DatasetsPage.tsx:99-108` | `handleDelete` wired but **no delete button rendered** in card (only "View →") → dead code. |
| `ExplorerPage.tsx:94`, `CleaningPage.tsx:180`, `FeatureEngineeringPage.tsx:183` | Download via `window.open(downloadUrl(...))` → **won't send auth token** once download endpoint requires auth. |
| `DatasetAnalysisPage.tsx:199-207` | `DataProfiling` (`/app/profiling`) uses internal `useState('')`; not URL-keyed, so navigating to a dataset name doesn't preselect it. |
| `routes/index.tsx` | `/app/datasets` list exists; **no `/app/datasets/:name` detail route**. |
| `useApi.ts:153-182` | `useDatasetPreview`/`useDatasetProfile` `refetchInterval: 120_000`, `useDatasets` 30s — already reduced ✅. |

### 1.5 Routes (`frontend/src/routes/index.tsx`)
- `/app/datasets` → `Datasets`. `/app/explorer`, `/app/profiling`, `/app/cleaning`, `/app/feature-engineering` exist. No `/app/datasets/:name`.

---

## 2. Fix Plan

### 2.1 Backend (`backend/main.py`)

**A. Add `require_dataset_access(db, name, current_user, owner_only=False)` helper** (insert before `@app.get("/api/v1/datasets", ...)` line 452):
```python
def require_dataset_access(db, name, current_user, owner_only=False):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    if uid is None: raise HTTPException(401, "Authentication required")
    record = get_dataset_record(db, name)
    if not record or record.deleted_at is not None: raise HTTPException(404, f"Dataset '{name}' not found")
    if record.user_id is not None and record.user_id != uid: raise HTTPException(403, "Access denied")
    if owner_only and record.user_id != uid: raise HTTPException(403, "Access denied")
    return record
```
Logic: signed-in user required; shared datasets (`user_id IS NULL`) readable by any signed-in user; mutating endpoints are owner-only.

**B. Add `_preview_df(name, rows, offset)` and `_dataset_total_rows(name, fpath)` helpers** (same insertion):
- CSV: `pd.read_csv(fpath, skiprows=lambda i: i!=0 and i<=offset, nrows=rows)` — slice, no full scan.
- Excel/xls: `pd.read_excel(fpath, nrows=offset+rows).iloc[offset:offset+rows]`.
- JSON lines: `pd.read_json(fpath, lines=True, skiprows=offset, nrows=rows)`.
- Parquet: `pd.read_parquet(fpath).iloc[offset:offset+rows]` (note partial) or pyarrow slice.
- `_dataset_total_rows`: CSV line-count, pyarrow metadata `num_rows`, openpyxl `max_row-1`, JSON lines count. Returns `-1` if unknown.

**C. Upload** (replace lines 523–570):
1. Add `if len(content) == 0: raise 400 "File is empty"`. Friendly msgs (empty / no-valid-columns / size-limit).
2. Same-user re-upload (record exists, `user_id==uid`, `deleted_at is None`, file exists on disk) → **reuse filename**, bump `version`, update `rows/columns/size_kb/updated_at/status="ready"`.
3. Otherwise → unique physical filename `{stem}_{uid[:8]}_{i}{ext}` (counter) to avoid cross-user overwrite.
4. Wrap `_get_dataset_df` in `await asyncio.get_running_loop().run_in_executor(None, _get_dataset_df, filename)` (add `import asyncio`).
5. Set `record.status = "ready"` after create; include `"status": "ready"` in response.

**D. `GET /datasets/{name}`** (571–595): add `get_current_user` + `require_dataset_access`; replace `len(df)`/dtypes (full read) with cheap `_get_dataset_meta(name)`.

**E. `download`** (597–604): `get_current_user` + `require_dataset_access`.

**F. `delete`** (606–614): `get_current_user` + `require_dataset_access(owner_only=True)`.

**G. `preview`** (616–631): `get_current_user` + `require_dataset_access`; use `_preview_df`/`_dataset_total_rows`; `rows: Query(50, ge=1, le=500)`, `offset: Query(0, ge=0, le=100000)`.

**H. `profile`, `analyze`** (633–644): `get_current_user` + `require_dataset_access`; validate_path + existence.

**I. `clean`, `auto-clean`, `generate`** (646–677): `get_current_user` + `require_dataset_access(owner_only=True)`.

**J. `suggest`** (679–681): `get_current_user` + `require_dataset_access`.

**K. `tags`, `description`** (684–699): `get_current_user` + `require_dataset_access(owner_only=True)`.

**L. `share`, `list_shares`, `remove_share`** (770–792): `get_current_user` + `require_dataset_access(owner_only=True)`.

### 2.2 Frontend

**M. `http.ts`**: add `responseType: 'blob'` support in `request` (`if ((init as any)?.responseType === 'blob') return (await res.blob()) as unknown as T`); export `getToken`.

**N. `datasets.service.ts`**: add `downloadFile(name: string) => http.get<Blob>(\`/datasets/${encodeURIComponent(name)}/download\`, undefined, { responseType: 'blob' })`.

**O. `routes/index.tsx`**: under `/app` children add `{ path: 'datasets/:name', element: <DataProfiling /> }` (after `path: 'datasets'`).

**P. `DatasetAnalysisPage.tsx`**: add `import { useParams, useEffect } from 'react-router-dom'`; `const { name } = useParams<{name: string}>()`; `const [selectedDataset, setSelectedDataset] = useState(name || '')`; `useEffect(() => { if (name) setSelectedDataset(name); }, [name])`. This preselects & auto-loads profile/analyze on navigate.

**Q. `DatasetsPage.tsx`**:
- Navigate calls (212, 258) → `/app/datasets/${encodeURIComponent(dataset.name || dataset.id)}`.
- Render a **Delete** button in `cardActions` next to "View →" (calls existing `handleDelete`).

**R. `ExplorerPage.tsx:94`, `CleaningPage.tsx:180`, `FeatureEngineeringPage.tsx:183`**: replace `window.open(downloadUrl(...))` with `await datasetsService.downloadFile(name)` (all three already import `datasetsService`). Wrap in try/catch with console error.

### 2.3 Verification
- `python -c "import ast; ast.parse(open('backend/main.py').read())"` ✅
- `npm run build` (tsc -b + vite build) ✅
- `npm test` (expect 56+ pass) ✅
- Commit + push (deploys to rihy; Vercel redeploy separately for SPA fallback).

---

## 3. Acceptance Report (to be filled after verification)

| Area | Status | Notes |
|---|---|---|
| Auth on `GET /datasets/{name}` | ⏳ NOT TESTED | After fix |
| Auth on `DELETE /datasets/{name}` | ⏳ NOT TESTED | After fix |
| Auth on `download` | ⏳ NOT TESTED | After fix |
| Auth on `preview` (no full scan) | ⏳ NOT TESTED | After fix |
| Auth on `profile/analyze/suggest` | ⏳ NOT TESTED | After fix |
| Auth on `share/shares/clean/generate/tags/desc` | ⏳ NOT TESTED | After fix |
| Upload: re-upload collision | ⏳ NOT TESTED | After fix |
| Upload: status/response | ⏳ NOT TESTED | After fix |
| Upload: validation errors | ⏳ NOT TESTED | After fix |
| Preview chunking | ⏳ NOT TESTED | CSV/JSON/Excel slice; parquet partial |
| Frontend detail route | ⏳ NOT TESTED | After fix |
| Frontend delete button | ⏳ NOT TESTED | After fix |
| Frontend downloads | ⏳ NOT TESTED | After fix |
| Frontend polling | ✅ PASS | 30s/pollWhenVisible |
| Frontend search/filter | ✅ PASS | client-side over real list |
| Loading/error/empty states | ✅ PASS | |
| Rename | ⏳ NOT TESTED | no backend endpoint |
| Download (feature exists) | ⏳ PARTIAL | exists, unauthenticated→fixed |

---

## 4. Open questions for the user

1. **Shared-dataset deletion** — currently owner-only after fix. Is it acceptable that no single user can delete a `user_id IS NULL` (shared) dataset, or should the owner-of-record (first uploader) be able to delete it? (The record with `user_id IS NULL` has no single owner.)
2. **Preview parquet** — kept as full read (columnar, noted partial). Acceptable, or should I add pyarrow row-group pruning?
3. **Deployment** — after push, you'll redeploy rihy (from `main`) and Vercel (for SPA fallback + new bundle). Can I assume you'll do that, or should I note exact steps?
4. **Rename** — no backend endpoint exists; left as NOT TESTED. If you want rename, add `PUT /datasets/{name}/rename` (+ `rename_dataset` crud + `renamed_at` column) — separate scope.
