# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### 전체 실행 (권장)
```bash
./start.sh
# 백엔드 :8000, 프론트엔드 :3000 동시 실행
```

### 백엔드 (FastAPI)
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 프론트엔드 (Next.js)
```bash
cd frontend
npm run dev       # 개발 서버 :3000
npm run build     # 프로덕션 빌드
```

### 환경 변수
`backend/.env`에 Exa API 키 필요 (뉴스 크롤링용).

## 아키텍처

### 전체 구조
Next.js 프론트엔드 → FastAPI 백엔드 → SQLite DB + Ollama(로컬 LLM) + Exa API

프론트엔드는 `/api/*` 경로를 `next.config.js`에서 `localhost:8000`으로 프록시.

### 5단계 UX 기획 워크플로우
`frontend/src/lib/types.ts`의 `STAGES` 배열이 중심:
1. **목적 탐지** — 버즈 수집·팩트 추출·5Why 추론 (`PurposeStage`)
2. **맥락 파악** — MECE 도메인 프레임워크 (`ContextStage`)
3. **사람 이해** — 행위 시퀀스 매핑 (`PeopleStage`)
4. **추상 진입** — 가설·Raw data 수립 (`AbstractStage`)
5. **솔루션 도출** — 컨셉·플로우·인터페이스 (`SolutionStage`)

각 스테이지 컴포넌트는 `frontend/src/components/stages/`에 위치. `project/[id]/page.tsx`에서 `activeStage` 인덱스로 동적 렌더링.

### AI 분석 파이프라인 (2단계 스트리밍)
`backend/app/routers/analyze.py`의 `POST /api/analyze/facts/stream`:

1. **Phase 1 — 팩트 추출**: `gemma3:4b` (빠름) → 3-Gate 판정(도메인 맥락·차별성·구조적 인과성) → `[FACT]...[/FACT]` 파싱
2. **Phase 2 — 5Why 추론**: `gemma3:12b` (품질 우선) → Q1~Q5/A1~A5 체인 → 핵심인사이트 생성
3. 모든 처리 완료 후 DB에 한 번에 커밋 (Facts + FiveWhys 테이블)

SSE(Server-Sent Events)로 진행 상황 스트리밍. 프론트에서 `EventSource` 또는 `fetch`+`ReadableStream`으로 수신.

### 백엔드 라우터 구조
- `routers/projects.py` — 프로젝트 CRUD + 하위 리소스(Facts, FiveWhys, Framework, Sequences, Insights, Concepts)
- `routers/stages.py` — 스테이지별 데이터 조회
- `routers/crawl.py` — 뉴스(`/crawl/news`, Exa API) · 검색(`/crawl/search`, DuckDuckGo) · URL 스크래핑(`/crawl/url`)
- `routers/analyze.py` — Ollama LLM 분석 (스트리밍/비스트리밍)

### DB 스키마
`backend/app/models.py`. SQLite(`backend/ux_planner.db`). 앱 시작 시 `_migrate_db()`로 ALTER TABLE 자동 적용 (이미 존재하는 컬럼은 무시).

`Fact.content`에 `\n__META__{json}` 형식으로 메타데이터 인라인 저장 — 파싱 시 `META_SEP = "\n__META__"` 기준으로 분리.

`FiveWhys.chain_json`은 `[{q, a}, ...]` × 5 JSON 문자열. `why1`~`why5` 컬럼은 하위 호환용.

### 프론트엔드 API 클라이언트
`frontend/src/lib/api.ts`의 `api` 객체가 모든 백엔드 호출을 담당. 새 엔드포인트 추가 시 여기에 메서드 추가.
