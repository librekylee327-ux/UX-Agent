import os
import signal
import subprocess
from typing import Optional

from fastapi import APIRouter

router = APIRouter(prefix="/api/system", tags=["system"])

_ollama_pid: Optional[int] = None


def _is_ollama_running() -> bool:
    try:
        result = subprocess.run(
            ["pgrep", "-f", "ollama serve"],
            capture_output=True,
        )
        return result.returncode == 0
    except Exception:
        return False


@router.get("/ollama/status")
def ollama_status():
    return {"status": "ok" if _is_ollama_running() else "offline"}


@router.post("/ollama/start")
def ollama_start():
    global _ollama_pid
    if _is_ollama_running():
        return {"status": "ok", "message": "already running"}
    try:
        proc = subprocess.Popen(
            ["ollama", "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        _ollama_pid = proc.pid
        return {"status": "ok", "pid": _ollama_pid}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/ollama/stop")
def ollama_stop():
    global _ollama_pid
    if not _is_ollama_running():
        _ollama_pid = None
        return {"status": "ok", "message": "already stopped"}
    try:
        if _ollama_pid:
            os.kill(_ollama_pid, signal.SIGTERM)
            _ollama_pid = None
        else:
            subprocess.run(["pkill", "-f", "ollama serve"], check=False)
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
