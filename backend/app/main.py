import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import projects, stages, crawl, analyze

app = FastAPI(title="UX Planner API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(stages.router)
app.include_router(crawl.router)
app.include_router(analyze.router)


@app.on_event("startup")
def startup():
    init_db()
    _migrate_db()


def _migrate_db():
    from app.database import engine
    from sqlalchemy import text
    migrations = [
        "ALTER TABLE five_whys ADD COLUMN chain_json TEXT",
        "ALTER TABLE five_whys ADD COLUMN insight TEXT DEFAULT ''",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists


@app.get("/api/health")
def health():
    return {"status": "ok"}
