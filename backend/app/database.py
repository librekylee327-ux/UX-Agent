import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "ux_planner.db")
DATABASE_URL = f"sqlite:///{os.path.abspath(DB_PATH)}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models import Project, Reference, Fact, FiveWhys, Framework, Sequence, Insight, Concept  # noqa
    Base.metadata.create_all(bind=engine)
    # Migration: add analyzed column to existing references table
    with engine.connect() as conn:
        try:
            conn.execute(text('ALTER TABLE "references" ADD COLUMN analyzed INTEGER NOT NULL DEFAULT 0'))
            conn.commit()
        except Exception:
            pass  # column already exists
