# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Improvement & Feature Implementation Process

Before implementing any improvement or new feature, always follow these steps.

### Step 1 — Analyze Side Effects & Trade-offs
Before writing any code, analyze and present the following to the user:

- **Impact scope**: Components, routers, DB schema, or API contracts affected by the change
- **Side effects**: Existing behaviors that may change or break
- **Trade-offs**: Balance between performance, complexity, maintainability, and consistency
- **Alternatives**: Other approaches that achieve the same goal, with pros and cons of each

### Step 2 — User Approval
After presenting the analysis, propose an implementation direction and **only start writing code after receiving explicit approval**.
Never implement first without approval.

### Exceptions
- Changes with no impact on code behavior (typos, docs)
- When the user explicitly requests to skip analysis (e.g., "just implement it")

---

## Regression Safety Rules

These rules apply to every backend or frontend change, with no exceptions.

### Rule 1 — Backend-first, verify before frontend
When adding a new backend router or endpoint:
1. Implement and register the router in `main.py`
2. **Verify the backend starts cleanly** (`uvicorn` import check or quick startup) before touching frontend code
3. Only integrate on the frontend after the backend endpoints are confirmed working

Never write backend + frontend integration in a single step without a verification gate in between.
ㅛ7 
### Rule 2 — New routers must not crash the server
A bug inside a new router (import error, unhandled exception, missing dependency) will take down the entire FastAPI app and break all existing features.

Checklist before registering a new router:
- All imports in the new router file resolve without error
- All endpoint functions have top-level `try/except` and return proper HTTP responses on failure — they must never raise unhandled exceptions
- Run a quick import check: `python -c "from app.routers import <new_module>"` to catch import-time errors before startup

### Rule 3 — Preserve existing API contracts when refactoring
When replacing an existing frontend call (e.g., swapping a direct `fetch(...)` for a new `api.*` method):
- The new endpoint must be verified working **before** removing the old call
- Keep the old call in place as a fallback until the new endpoint is confirmed

### Rule 4 — Scope changes narrowly
A feature addition should touch only the files it needs. Do not modify existing endpoint behavior as a side effect of adding a new feature. If a refactor of an existing call is needed, treat it as a separate step and flag it explicitly.

---

## Commands

### Run all (recommended)
```bash
./start.sh
# Backend :8000, Frontend :3000 concurrently
```

### Backend (FastAPI)
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (Next.js)
```bash
cd frontend
npm run dev       # dev server :3000
npm run build     # production build
```

### Environment variables
Exa API key required in `backend/.env` (for news crawling).

## Architecture

### Overview
Next.js frontend → FastAPI backend → SQLite DB + Ollama (local LLM) + Exa API

Frontend proxies `/api/*` routes to `localhost:8000` via `next.config.js`.

### 5-Stage UX Planning Workflow
Centered on the `STAGES` array in `frontend/src/lib/types.ts`:
1. **Purpose Detection** — Buzz collection, fact extraction, 5 Whys reasoning (`PurposeStage`)
2. **Context Mapping** — MECE domain framework (`ContextStage`)
3. **People Understanding** — Behavioral sequence mapping (`PeopleStage`)
4. **Abstraction Entry** — Hypothesis and raw data formulation (`AbstractStage`)
5. **Solution Derivation** — Concept, flow, and interface design (`SolutionStage`)

Stage components live in `frontend/src/components/stages/`. Rendered dynamically by `activeStage` index in `project/[id]/page.tsx`.

### AI Analysis Pipeline (2-phase streaming)
`POST /api/analyze/facts/stream` in `backend/app/routers/analyze.py`:

1. **Phase 1 — Fact Extraction**: `gemma3:4b` (speed) → 3-gate judgment (domain context, differentiation, structural causality) → `[FACT]...[/FACT]` parsing
2. **Phase 2 — 5 Whys Reasoning**: `gemma3:12b` (quality) → Q1~Q5/A1~A5 chain → core insight generation
3. Single DB commit after all processing (Facts + FiveWhys tables)

Progress streamed via SSE. Frontend receives via `EventSource` or `fetch`+`ReadableStream`.

### Backend Router Structure
- `routers/projects.py` — Project CRUD + sub-resources (Facts, FiveWhys, Framework, Sequences, Insights, Concepts)
- `routers/stages.py` — Stage-specific data retrieval
- `routers/crawl.py` — News (`/crawl/news`, Exa API), search (`/crawl/search`, DuckDuckGo), URL scraping (`/crawl/url`)
- `routers/analyze.py` — Ollama LLM analysis (streaming/non-streaming)

### DB Schema
`backend/app/models.py`. SQLite (`backend/ux_planner.db`). `_migrate_db()` applies ALTER TABLE on startup (ignores existing columns).

`Fact.content` stores metadata inline as `\n__META__{json}` — parse by splitting on `META_SEP = "\n__META__"`.

`FiveWhys.chain_json` is a `[{q, a}, ...]` × 5 JSON string. `why1`~`why5` columns kept for backward compatibility.

### Frontend API Client
The `api` object in `frontend/src/lib/api.ts` handles all backend calls. Add methods here when introducing new endpoints.
