import os
import re
import httpx
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}

# ── Stage별 검색 목적 프롬프트 ─────────────────────────────────────────────────
STAGE_CONFIG = {
    1: {
        "label": "목적 탐지",
        "purpose": "신규 서비스 론칭, 혁신 기술, 서비스 확장 사례 발견",
        "exa_category": "news",
    },
    2: {
        "label": "맥락 파악",
        "purpose": "도메인 구조, 시장 플레이어, 기술 스택 분석",
        "exa_category": "research paper",
    },
    3: {
        "label": "사람 이해",
        "purpose": "실사용자 행동 패턴, 사용 시퀀스 사례",
        "exa_category": "tweet",
    },
    4: {
        "label": "추상 진입",
        "purpose": "사용자 피드백, 불만, 감정 반응 원자료",
        "exa_category": "tweet",
    },
    5: {
        "label": "솔루션 도출",
        "purpose": "솔루션 사례, 디자인 패턴, 서비스 개선 레퍼런스",
        "exa_category": "company",
    },
}


# ── Exa 시맨틱 검색 ────────────────────────────────────────────────────────────

def _get_exa_client():
    from exa_py import Exa
    api_key = os.getenv("EXA_API_KEY")
    if not api_key:
        raise RuntimeError("EXA_API_KEY가 설정되지 않았습니다.")
    return Exa(api_key=api_key)


async def search_exa(keyword: str, stage: int, limit: int = 8) -> List[Dict]:
    """Exa 시맨틱 검색 — 목적 기반 쿼리로 관련 레퍼런스 수집"""
    import asyncio
    cfg = STAGE_CONFIG.get(stage, STAGE_CONFIG[1])

    # 한국어 + 영어 쿼리 병렬 실행
    query_ko = f"{keyword} {cfg['purpose']}"
    query_en = _translate_query(keyword, cfg["purpose"])

    results = await asyncio.gather(
        _exa_search(query_ko, cfg["exa_category"], limit // 2 + 1),
        _exa_search(query_en, cfg["exa_category"], limit // 2 + 1),
        return_exceptions=True,
    )

    merged: List[Dict] = []
    seen_urls: set = set()
    for batch in results:
        if isinstance(batch, list):
            for r in batch:
                if r.get("url") and r["url"] not in seen_urls:
                    seen_urls.add(r["url"])
                    merged.append(r)

    return merged[:limit]


async def _exa_search(query: str, category: str, limit: int) -> List[Dict]:
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        exa = _get_exa_client()

        def _sync_search():
            return exa.search_and_contents(
                query,
                num_results=limit,
                type="neural",
                category=category,
                text={"max_characters": 1500},
                summary={"query": query},
            )

        response = await loop.run_in_executor(None, _sync_search)
        results = []
        for r in response.results:
            results.append({
                "title": r.title or "",
                "url": r.url or "",
                "summary": r.summary or (r.text or "")[:300],
                "content": r.text or "",
                "source": "Exa",
                "published_at": r.published_date or "",
            })
        return results
    except Exception as e:
        return [_error("Exa 검색 실패", str(e))]


def _translate_query(keyword: str, purpose: str) -> str:
    """목적별 영문 쿼리 생성 — LLM 없이 키워드 기반 변환"""
    purpose_en_map = {
        "신규 서비스 론칭, 혁신 기술, 서비스 확장 사례 발견": "new service launch innovation case study",
        "도메인 구조, 시장 플레이어, 기술 스택 분석": "market analysis domain structure technology stack",
        "실사용자 행동 패턴, 사용 시퀀스 사례": "user behavior pattern usage research",
        "사용자 피드백, 불만, 감정 반응 원자료": "user feedback complaints pain points",
        "솔루션 사례, 디자인 패턴, 서비스 개선 레퍼런스": "UX design pattern solution case study",
    }
    purpose_en = purpose_en_map.get(purpose, "")
    return f"{keyword} {purpose_en}".strip()


# ── Platum RSS (한국 스타트업 전용, 유지) ──────────────────────────────────────

async def search_platum(keyword: str, limit: int = 4) -> List[Dict]:
    feed_url = "https://platum.kr/feed"
    results = []
    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS, follow_redirects=True, verify=False) as client:
            resp = await client.get(feed_url)
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
            channel = root.find("channel")
            if not channel:
                return results
            kw_lower = keyword.lower()
            for item in channel.findall("item"):
                title = (item.findtext("title") or "").strip()
                link  = (item.findtext("link") or "").strip()
                desc  = BeautifulSoup(item.findtext("description") or "", "lxml").get_text(" ", strip=True)
                if kw_lower and kw_lower not in title.lower() and kw_lower not in desc.lower():
                    continue
                results.append({
                    "title": title,
                    "url": link,
                    "summary": desc[:300],
                    "content": desc[:1500],
                    "source": "Platum",
                    "published_at": (item.findtext("pubDate") or "").strip(),
                })
                if len(results) >= limit:
                    break
    except Exception as e:
        results.append(_error("Platum 수집 실패", str(e)))
    return results


# ── URL 직접 스크래핑 ──────────────────────────────────────────────────────────

async def scrape_url(url: str) -> Dict:
    try:
        async with httpx.AsyncClient(timeout=20, headers=HEADERS, follow_redirects=True, verify=False) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")

            title = (soup.title.string if soup.title else "") or ""
            if not title:
                og = soup.find("meta", property="og:title")
                title = og["content"] if og and og.get("content") else url

            for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
                tag.decompose()

            meta = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", property="og:description")
            meta_desc = meta["content"] if meta and meta.get("content") else ""

            main = (soup.find("article") or soup.find("main")
                    or soup.find("div", class_=lambda c: c and "content" in c.lower()))
            body = main or (soup.body if soup.body else None)
            content_text = " ".join(body.get_text(" ", strip=True).split())[:3000] if body else ""

            return {
                "title": title.strip(), "url": url,
                "summary": meta_desc[:300] if meta_desc else content_text[:300],
                "content": content_text,
                "source": url.split("/")[2] if "/" in url else url,
                "published_at": "",
            }
    except Exception as e:
        return _error("스크래핑 실패", str(e), url=url)


# ── 통합 검색 ──────────────────────────────────────────────────────────────────

async def search_by_stage(keyword: str, stage: int, limit: int = 8) -> List[Dict]:
    import asyncio
    exa_results, platum_results = await asyncio.gather(
        search_exa(keyword, stage, limit=limit),
        search_platum(keyword, limit=2),
        return_exceptions=True,
    )

    combined: List[Dict] = []
    if isinstance(exa_results, list):
        combined.extend(exa_results)
    if isinstance(platum_results, list):
        combined.extend(platum_results)

    return combined


# ── 자연어 검색 ────────────────────────────────────────────────────────────────

_VOC_KEYWORDS = {"불편", "voc", "피드백", "후기", "리뷰", "불만", "민원", "complaint", "feedback", "pain"}
_PAPER_KEYWORDS = {"논문", "연구", "학술", "academic", "research", "paper", "study"}
_COMPANY_KEYWORDS = {"기업", "회사", "스타트업", "saas", "b2b"}
_TIME_RE = re.compile(r"최근|최신|올해|요즘|이번\s*년")


def _detect_category(query: str) -> str:
    q = query.lower()
    if any(kw in q for kw in _VOC_KEYWORDS):
        return "tweet"
    if any(kw in q for kw in _PAPER_KEYWORDS):
        return "research paper"
    if any(kw in q for kw in _COMPANY_KEYWORDS):
        return "company"
    return "news"


def _detect_start_date(query: str) -> Optional[str]:
    if _TIME_RE.search(query):
        return (datetime.utcnow() - timedelta(days=180)).strftime("%Y-%m-%d")
    return None


async def _exa_search_nl(query: str, category: str, limit: int, start_date: Optional[str]) -> List[Dict]:
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        exa = _get_exa_client()

        def _sync():
            kwargs: Dict = dict(
                num_results=limit,
                type="neural",
                category=category,
                text={"max_characters": 1500},
                summary={"query": query},
            )
            if start_date:
                kwargs["start_published_date"] = start_date
            return exa.search_and_contents(query, **kwargs)

        response = await loop.run_in_executor(None, _sync)
        return [
            {
                "title": r.title or "",
                "url": r.url or "",
                "summary": r.summary or (r.text or "")[:300],
                "content": r.text or "",
                "source": "Exa",
                "published_at": r.published_date or "",
            }
            for r in response.results
        ]
    except Exception as e:
        return [_error("Exa 검색 실패", str(e))]


async def search_natural(query: str, stage: int = 1, limit: int = 8) -> List[Dict]:
    """Natural language query → auto-detect category & time filter → Exa neural search."""
    cfg = STAGE_CONFIG.get(stage, STAGE_CONFIG[1])
    category = _detect_category(query)
    start_date = _detect_start_date(query)
    enriched = f"{query} {cfg['purpose']}"
    return await _exa_search_nl(enriched, category, limit, start_date)


# ── 하위 호환 ──────────────────────────────────────────────────────────────────

async def search_news(keyword: str, stage: int = 1, limit: int = 8) -> List[Dict]:
    return await search_by_stage(keyword, stage, limit=limit)


async def search_ddg(keyword: str, stage: int = 1, limit: int = 8) -> List[Dict]:
    return await search_by_stage(keyword, stage, limit=limit)


# ── 유틸 ──────────────────────────────────────────────────────────────────────

def _error(title: str, detail: str, url: str = "") -> Dict:
    return {
        "error": detail, "title": title, "url": url,
        "summary": "", "content": "", "source": "", "published_at": "",
    }
