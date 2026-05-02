#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "▶ 백엔드 시작 (FastAPI :8000)"
cd "$ROOT/backend"
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo "▶ 프론트엔드 시작 (Next.js :3000)"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  UX 기획 플래너 실행 중"
echo "  대시보드: http://localhost:3000"
echo "  API:      http://localhost:8000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "(Ctrl+C 로 종료)"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
