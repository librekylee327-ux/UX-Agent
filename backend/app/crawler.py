import httpx
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from urllib.parse import quote_plus
from typing import List, Dict

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}

# ── Stage별 채널 구성 ─────────────────────────────────────────────────────────
# 각 stage의 수집 목적에 맞게 채널 조합을 다르게 가져감
STAGE_CONFIG = {
    1: {
        "label": "목적 탐지",
        "purpose": "신규 서비스 론칭, 혁신 기술, 서비스 확장 사례 발견",
        "channels": ["hackernews_show", "techcrunch", "platum", "github_trending"],
        "reddit_subs": [],
    },
    2: {
        "label": "맥락 파악",
        "purpose": "도메인 구조, 시장 플레이어, 기술 스택 분석",
        "channels": ["hackernews", "techcrunch", "reddit"],
        "reddit_subs": ["technology", "startups", "business"],
    },
    3: {
        "label": "사람 이해",
        "purpose": "실사용자 행동 패턴, 사용 시퀀스 사례",
        "channels": ["hackernews", "reddit"],
        "reddit_subs": ["apps", "LifeProTips", "software"],
    },
    4: {
        "label": "추상 진입",
        "purpose": "사용자 피드백, 불만, 감정 반응 원자료",
        "channels": ["reddit"],
        "reddit_subs": ["complaints", "mildlyinfuriating", "CasualConversation"],
    },
    5: {
        "label": "솔루션 도출",
        "purpose": "솔루션 사례, 디자인 패턴, 서비스 개선 레퍼런스",
        "channels": ["hackernews_show", "github_trending", "techcrunch"],
        "reddit_subs": [],
    },
}


# ── Hacker News (Algolia API) ─────────────────────────────────────────────────

async def search_hackernews_show(keyword: str, limit: int = 8) -> List[Dict]:
    """Show HN 필터 — 새 서비스·프로덕트 론칭 전용"""
    url = (
        f"https://hn.algolia.com/api/v1/search"
        f"?query={quote_plus(keyword)}&tags=show_hn&hitsPerPage={limit}"
    )
    return await _fetch_hn(url, tag="Show HN")


async def search_hackernews(keyword: str, limit: int = 8) -> List[Dict]:
    """HN 일반 검색 — 기술 트렌드·도메인 토론"""
    url = (
        f"https://hn.algolia.com/api/v1/search"
        f"?query={quote_plus(keyword)}&tags=story&hitsPerPage={limit}"
    )
    return await _fetch_hn(url, tag="Hacker News")


async def _fetch_hn(url: str, tag: str) -> List[Dict]:
    results = []
    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS, verify=False) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            hits = resp.json().get("hits", [])
            for h in hits:
                title = h.get("title", "")
                story_url = h.get("url") or f"https://news.ycombinator.com/item?id={h.get('objectID','')}"
                points = h.get("points", 0)
                comments = h.get("num_comments", 0)
                results.append({
                    "title": title,
                    "url": story_url,
                    "summary": f"[{tag}] 포인트: {points} | 댓글: {comments}",
                    "content": h.get("story_text") or "",
                    "source": tag,
                    "published_at": h.get("created_at", ""),
                })
    except Exception as e:
        results.append(_error("HN 수집 실패", str(e)))
    return results


# ── Reddit (JSON API, 인증 불필요) ────────────────────────────────────────────

async def search_reddit(keyword: str, subreddits: List[str], limit: int = 6) -> List[Dict]:
    """Reddit 멀티 서브레딧 검색 — 실사용자 반응·피드백"""
    results = []
    subs = "+".join(subreddits) if subreddits else "all"
    url = (
        f"https://www.reddit.com/r/{subs}/search.json"
        f"?q={quote_plus(keyword)}&sort=relevance&limit={limit}&restrict_sr=1"
    )
    try:
        headers = {**HEADERS, "Accept": "application/json"}
        async with httpx.AsyncClient(timeout=10, headers=headers, follow_redirects=True, verify=False) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            posts = resp.json().get("data", {}).get("children", [])
            for p in posts:
                d = p.get("data", {})
                results.append({
                    "title": d.get("title", ""),
                    "url": f"https://reddit.com{d.get('permalink', '')}",
                    "summary": (d.get("selftext") or "")[:300],
                    "content": (d.get("selftext") or "")[:1500],
                    "source": f"Reddit r/{d.get('subreddit', '')}",
                    "published_at": "",
                })
    except Exception as e:
        results.append(_error("Reddit 수집 실패", str(e)))
    return results


# ── RSS 피드 (TechCrunch, Platum) ─────────────────────────────────────────────

RSS_SOURCES = {
    "techcrunch": ("https://techcrunch.com/feed/", "TechCrunch"),
    "platum":     ("https://platum.kr/feed", "Platum"),
}

async def search_rss(source_key: str, keyword: str, limit: int = 6) -> List[Dict]:
    feed_url, source_name = RSS_SOURCES[source_key]
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
            matched = 0
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
                    "source": source_name,
                    "published_at": (item.findtext("pubDate") or "").strip(),
                })
                matched += 1
                if matched >= limit:
                    break
            # 키워드 매칭 없으면 최신순으로 fallback
            if not results:
                for item in channel.findall("item")[:limit]:
                    title = (item.findtext("title") or "").strip()
                    link  = (item.findtext("link") or "").strip()
                    desc  = BeautifulSoup(item.findtext("description") or "", "lxml").get_text(" ", strip=True)
                    results.append({
                        "title": title, "url": link, "summary": desc[:300],
                        "content": desc[:1500], "source": source_name,
                        "published_at": (item.findtext("pubDate") or "").strip(),
                    })
    except Exception as e:
        results.append(_error(f"{source_name} 수집 실패", str(e)))
    return results


# ── GitHub Trending ────────────────────────────────────────────────────────────

async def search_github_trending(keyword: str, limit: int = 6) -> List[Dict]:
    """GitHub Trending — 신기술·오픈소스 서비스"""
    url = f"https://github.com/trending?q={quote_plus(keyword)}&since=weekly"
    results = []
    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS, follow_redirects=True, verify=False) as client:
            resp = await client.get(url)
            soup = BeautifulSoup(resp.text, "lxml")
            for repo in soup.select("article.Box-row")[:limit]:
                name_el = repo.select_one("h2 a")
                desc_el = repo.select_one("p")
                lang_el = repo.select_one("[itemprop='programmingLanguage']")
                stars_el = repo.select_one("a[href*='stargazers']")
                if not name_el:
                    continue
                name = name_el.get_text(" ", strip=True).replace("\n", "").replace(" ", "")
                href = name_el.get("href", "")
                results.append({
                    "title": name,
                    "url": f"https://github.com{href}",
                    "summary": desc_el.get_text(strip=True) if desc_el else "",
                    "content": f"언어: {lang_el.get_text(strip=True) if lang_el else 'N/A'} | 스타: {stars_el.get_text(strip=True) if stars_el else 'N/A'}",
                    "source": "GitHub Trending",
                    "published_at": "",
                })
    except Exception as e:
        results.append(_error("GitHub Trending 수집 실패", str(e)))
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


# ── 통합 검색 (stage 기반) ─────────────────────────────────────────────────────

async def search_by_stage(keyword: str, stage: int, limit_per_channel: int = 5) -> List[Dict]:
    """stage 목적에 맞는 채널 조합으로 수집"""
    cfg = STAGE_CONFIG.get(stage, STAGE_CONFIG[1])
    all_results: List[Dict] = []

    channel_fns = {
        "hackernews_show": lambda: search_hackernews_show(keyword, limit_per_channel),
        "hackernews":      lambda: search_hackernews(keyword, limit_per_channel),
        "techcrunch":      lambda: search_rss("techcrunch", keyword, limit_per_channel),
        "platum":          lambda: search_rss("platum", keyword, limit_per_channel),
        "github_trending": lambda: search_github_trending(keyword, limit_per_channel),
        "reddit":          lambda: search_reddit(keyword, cfg["reddit_subs"], limit_per_channel),
    }

    import asyncio
    tasks = [channel_fns[ch]() for ch in cfg["channels"] if ch in channel_fns]
    results_per_channel = await asyncio.gather(*tasks, return_exceptions=True)

    for r in results_per_channel:
        if isinstance(r, list):
            all_results.extend(r)

    return all_results


# ── 유틸 ──────────────────────────────────────────────────────────────────────

def _error(title: str, detail: str, url: str = "") -> Dict:
    return {
        "error": detail, "title": title, "url": url,
        "summary": "", "content": "", "source": "", "published_at": "",
    }


# ── 하위 호환 (기존 라우터에서 호출하는 함수명 유지) ──────────────────────────

async def search_news(keyword: str, stage: int = 1, limit: int = 10) -> List[Dict]:
    return await search_by_stage(keyword, stage, limit_per_channel=limit // 2 or 5)


async def search_ddg(keyword: str, stage: int = 1, limit: int = 8) -> List[Dict]:
    return await search_by_stage(keyword, stage, limit_per_channel=limit // 2 or 4)
