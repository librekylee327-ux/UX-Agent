import uuid
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.crawler import search_news, scrape_url, search_ddg
from app.models import Reference

router = APIRouter(prefix="/api/crawl", tags=["crawl"])


class SearchRequest(BaseModel):
    keyword: str
    stage: int = 1
    project_id: str
    save: bool = True  # 자동으로 DB에 저장할지 여부


class UrlRequest(BaseModel):
    url: str
    project_id: str
    stage: int = 1
    save: bool = True


@router.post("/news")
async def crawl_news(body: SearchRequest, db: Session = Depends(get_db)):
    results = await search_news(body.keyword, body.stage, limit=10)
    if body.save:
        for r in results:
            if r.get("error"):
                continue
            ref = Reference(
                id=str(uuid.uuid4()),
                project_id=body.project_id,
                stage=body.stage,
                url=r.get("url", ""),
                title=r.get("title", ""),
                content=r.get("summary", ""),
                source=r.get("source", "Google News"),
                crawled_at=datetime.utcnow(),
            )
            db.add(ref)
        db.commit()
    return {"results": results, "count": len(results)}


@router.post("/search")
async def crawl_search(body: SearchRequest, db: Session = Depends(get_db)):
    results = await search_ddg(body.keyword, body.stage, limit=8)
    if body.save:
        for r in results:
            if r.get("error"):
                continue
            ref = Reference(
                id=str(uuid.uuid4()),
                project_id=body.project_id,
                stage=body.stage,
                url=r.get("url", ""),
                title=r.get("title", ""),
                content=r.get("summary", ""),
                source=r.get("source", "검색"),
                crawled_at=datetime.utcnow(),
            )
            db.add(ref)
        db.commit()
    return {"results": results, "count": len(results)}


@router.post("/url")
async def crawl_url(body: UrlRequest, db: Session = Depends(get_db)):
    result = await scrape_url(body.url)
    if body.save and not result.get("error"):
        ref = Reference(
            id=str(uuid.uuid4()),
            project_id=body.project_id,
            stage=body.stage,
            url=result.get("url", body.url),
            title=result.get("title", ""),
            content=result.get("content", ""),
            source=result.get("source", ""),
            crawled_at=datetime.utcnow(),
        )
        db.add(ref)
        db.commit()
    return result
