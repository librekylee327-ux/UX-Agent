import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.crawler import search_news, scrape_url, search_ddg, search_natural
from app.models import Reference

router = APIRouter(prefix="/api/crawl", tags=["crawl"])


class SearchRequest(BaseModel):
    keyword: str
    domain: str = ""
    stage: int = 1
    project_id: str
    save: bool = True


class UrlRequest(BaseModel):
    url: str
    project_id: str
    stage: int = 1
    save: bool = True


@router.post("/news")
async def crawl_news(body: SearchRequest, db: Session = Depends(get_db)):
    combined = f"{body.keyword} {body.domain}".strip() if body.domain else body.keyword
    results = await search_news(combined, body.stage, limit=4)
    if body.save:
        existing_urls = {
            row.url for row in
            db.query(Reference.url).filter(Reference.project_id == body.project_id).all()
        }
        for r in results:
            if r.get("error"):
                continue
            url = r.get("url", "")
            if url in existing_urls:
                r["_skipped"] = True
                continue
            existing_urls.add(url)
            db.add(Reference(
                id=str(uuid.uuid4()),
                project_id=body.project_id,
                stage=body.stage,
                url=url,
                title=r.get("title", ""),
                content=r.get("summary", ""),
                source=r.get("source", ""),
                crawled_at=datetime.utcnow(),
            ))
        db.commit()
    return {"results": results, "count": len(results)}


@router.post("/search")
async def crawl_search(body: SearchRequest, db: Session = Depends(get_db)):
    results = await search_ddg(body.keyword, body.stage, limit=8)
    if body.save:
        existing_urls = {
            row.url for row in
            db.query(Reference.url).filter(Reference.project_id == body.project_id).all()
        }
        for r in results:
            if r.get("error"):
                continue
            url = r.get("url", "")
            if url in existing_urls:
                r["_skipped"] = True
                continue
            existing_urls.add(url)
            db.add(Reference(
                id=str(uuid.uuid4()),
                project_id=body.project_id,
                stage=body.stage,
                url=url,
                title=r.get("title", ""),
                content=r.get("summary", ""),
                source=r.get("source", "검색"),
                crawled_at=datetime.utcnow(),
            ))
        db.commit()
    return {"results": results, "count": len(results)}


class NLSearchRequest(BaseModel):
    natural_query: str
    project_id: str
    stage: int = 1
    save: bool = True


@router.post("/smart")
async def crawl_smart(body: NLSearchRequest, db: Session = Depends(get_db)):
    try:
        results = await search_natural(body.natural_query, body.stage, limit=8)
        if body.save:
            existing_urls = {
                row.url for row in
                db.query(Reference.url).filter(Reference.project_id == body.project_id).all()
            }
            for r in results:
                if r.get("error"):
                    continue
                url = r.get("url", "")
                if url in existing_urls:
                    r["_skipped"] = True
                    continue
                existing_urls.add(url)
                db.add(Reference(
                    id=str(uuid.uuid4()),
                    project_id=body.project_id,
                    stage=body.stage,
                    url=url,
                    title=r.get("title", ""),
                    content=r.get("summary", ""),
                    source=r.get("source", ""),
                    crawled_at=datetime.utcnow(),
                ))
            db.commit()
        return {"results": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/url")
async def crawl_url(body: UrlRequest, db: Session = Depends(get_db)):
    result = await scrape_url(body.url)
    if body.save and not result.get("error"):
        url = result.get("url", body.url)
        already = db.query(Reference).filter(
            Reference.project_id == body.project_id,
            Reference.url == url,
        ).first()
        if already:
            result["_skipped"] = True
        else:
            db.add(Reference(
                id=str(uuid.uuid4()),
                project_id=body.project_id,
                stage=body.stage,
                url=url,
                title=result.get("title", ""),
                content=result.get("content", ""),
                source=result.get("source", ""),
                crawled_at=datetime.utcnow(),
            ))
            db.commit()
    return result
