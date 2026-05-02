import uuid
import re
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import httpx

from app.database import get_db
from app.models import Reference, Fact, FiveWhys

router = APIRouter(prefix="/api/analyze", tags=["analyze"])

OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "gemma3:12b"  # Stage 2: 5Why 추론 (품질 우선)
FAST_MODEL = "gemma3:4b"      # Stage 1: 팩트 추출 (속도 우선)


class AnalyzeRequest(BaseModel):
    project_id: str
    stage: int = 1
    ref_ids: Optional[list[str]] = None
    model: str = DEFAULT_MODEL
    auto_save: bool = True


def _ref_block(refs: list) -> str:
    block = ""
    for i, r in enumerate(refs, 1):
        parts = [f"[레퍼런스 {i}]", f"제목: {r.title}"]
        if r.source:
            parts.append(f"출처: {r.source}")
        if r.content and r.content.strip():
            parts.append(f"내용: {r.content[:800]}")
        block += "\n".join(parts) + "\n\n---\n\n"
    return block


# ── Stage 1: 팩트 추출 전용 프롬프트 (빠른 모델, 5Why 없음) ─────────────────
def build_extraction_prompt(refs: list) -> str:
    return f"""당신은 UX 기획 분석가입니다. 레퍼런스에서 UX 기획에 유의미한 팩트를 추출하세요.

3-Gate 판정:
- Gate1(도메인 맥락): 특정 서비스/산업의 실제 현상인가?
- Gate2(차별성): 비관행적이거나 예상치 못한 패턴인가?
- Gate3(구조적 인과성): 구조적 원인을 역추론할 수 있는 단서인가?

등급: S/A(Gate1+2+3) / B(Gate2+3) / C(Gate1만) / 노이즈(미통과 → 출력 안 함)
유형: TYPE A(행동 비관행) / TYPE B(구조 변화) / TYPE C(사용자 이상치) / TYPE D(수익/비용 이상)

[FACT]
서비스명: [서비스명]
팩트: [관찰된 구체적 사실 한 문장]
통과게이트: [Gate1, Gate2, Gate3 중 해당]
등급: [S/A/B/C]
유형: [TYPE A/B/C/D]
분류근거: [레퍼런스의 어떤 구체적 내용이 이 등급·유형 판정의 근거가 됐는지 한 문장]
[/FACT]

반드시 위 형식으로만 출력하세요. 노이즈 팩트는 제외하고 추가 설명은 쓰지 마세요.

레퍼런스:
{_ref_block(refs)}"""


# ── Stage 2: 5Why 추론 전용 프롬프트 (품질 모델, 팩트 1개씩) ────────────────
def build_why_prompt(fact: str, service: str) -> str:
    service_part = f"서비스: {service}\n" if service else ""
    return f"""UX 기획 분석가다. 아래 팩트의 구조적 맥락과 차별성을 5가지 시각으로 역추론하라.

{service_part}팩트: {fact}

각 항목에 팩트에 최적화된 구체적 통찰·판단을 1~2문장으로 작성하라.
질문 형식 금지. [WHY] 블록만 출력. 마크다운 금지.

[WHY]
Why1(서비스):
Why2(산업):
Why3(사용자):
Why4(구조):
Why5(확장):
인사이트등급:
[/WHY]"""


# ── Legacy: 비스트리밍 /facts 엔드포인트용 통합 프롬프트 ────────────────────
def build_prompt(refs: list) -> str:
    return f"""당신은 UX 기획 전문 분석가입니다. 아래 레퍼런스에서 UX 기획에 유의미한 팩트를 추출하고 5Why 추론을 수행합니다.

## LAYER 1: 3-Gate 팩트 판정

각 레퍼런스에서 후보 팩트를 식별하고 아래 3개의 게이트를 순서대로 검토하세요.

Gate 1 (도메인 맥락 가치): 특정 서비스/산업 도메인에서 관찰된 실제 현상인가? 일반 상식이 아닌 특정 맥락에서 의미가 있는가?
Gate 2 (차별성): 비관행적이거나 예상치 못한 패턴인가? 당연하거나 예측 가능한 결과가 아닌가?
Gate 3 (구조적 인과성): 더 깊은 구조적 원인을 역추론할 수 있는 단서를 포함하는가? 5Why 추론의 출발점이 될 수 있는가?

판정 결과:
- Gate 1+2+3 모두 통과 → S/A등급 유의미한 팩트
- Gate 2+3만 통과 → B등급 후보
- Gate 1만 통과 → C등급 보류
- 모두 미통과 → 노이즈 (출력하지 않음)

팩트 유형 분류:
- TYPE A (행동 비관행 팩트): 사용자나 서비스가 일반적 패턴에서 벗어난 행동을 보임
- TYPE B (구조 변화 팩트): 시장/산업/서비스 구조가 변화하는 신호
- TYPE C (사용자 행동 이상치 팩트): 예상치 못한 사용자 반응이나 행동 패턴
- TYPE D (수익/비용 구조 이상 팩트): 비관행적 수익화 모델이나 비용 구조 패턴

## LAYER 2: 5Why 순차 추론

유의미한 팩트(Gate 통과)에 대해 아래 순서로 순차 추론합니다.
각 Why의 답변이 다음 Why의 출발점이 됩니다.

Why1(서비스 시각): "이 서비스는 왜 이 선택을 하는가?"
Why2(산업 시각): "왜 기존 플레이어들은 Why1의 선택을 하지 않았는가(또는 못했는가)?"
Why3(사용자 시각): "왜 사용자는 이 방식(Why1/2의 결과)을 수용하거나 선택하는가?"
Why4(구조 시각): "이 선택(Why1)이 가능한 선행 조건은 무엇인가?"
Why5(확장 시각): "이 구조(Why4)는 지속 가능한가? 다른 도메인으로 이전 가능한가?"

인사이트 등급: S(Why1~5 전체) / A(Why1~3 이상) / B(맥락 보완 필요) / C(Why2 이하)

## 출력 형식

[FACT QUALIFIED]
서비스명: [서비스 또는 출처명]
팩트: [관찰 가능한 구체적 사실 한 문장]
통과게이트: [예: Gate1, Gate2, Gate3]
등급: [S/A/B/C]
유형: [TYPE A/B/C/D]
Why1(서비스): [추론 내용]
Why2(산업): [추론 내용]
Why3(사용자): [추론 내용]
Why4(구조): [추론 내용]
Why5(확장): [추론 내용]
인사이트등급: [S/A/B/C]
[/FACT QUALIFIED]

반드시 위 형식으로만 출력하세요. 서두, 설명, 요약 등 다른 텍스트를 추가하지 마세요.

레퍼런스:
{_ref_block(refs)}"""


def _parse_block(block: str, field_keys: list[str]) -> dict:
    data: dict = {}
    current_key: Optional[str] = None
    current_val: list[str] = []
    for line in block.splitlines():
        line = line.strip()
        if not line:
            continue
        matched = False
        for key in field_keys:
            if line.startswith(key + ":"):
                if current_key:
                    data[current_key] = " ".join(current_val).strip()
                current_key = key
                current_val = [line[len(key) + 1:].strip()]
                matched = True
                break
        if not matched and current_key:
            current_val.append(line)
    if current_key:
        data[current_key] = " ".join(current_val).strip()
    return data


def _make_fact_entry(data: dict) -> Optional[dict]:
    fact_text = data.get("팩트", "").strip()
    if not fact_text or len(fact_text) < 5:
        return None
    grade = data.get("등급", "")
    fact_type = data.get("유형", "")
    service = data.get("서비스명", "")
    parts = []
    if grade:
        parts.append(f"{grade}등급")
    if fact_type:
        parts.append(fact_type)
    prefix = f"[{' '.join(parts)}]" if parts else ""
    service_tag = f"[{service}] " if service else ""
    return {
        "content": f"{prefix} {service_tag}{fact_text}".strip(),
        "grade": grade,
        "fact_type": fact_type,
        "service": service,
        "raw_fact": fact_text,
        "gates": data.get("통과게이트", ""),
        "classification_reason": data.get("분류근거", ""),
    }


def parse_extracted_facts(text: str) -> list[dict]:
    """Stage 1 출력 파싱: [FACT]...[/FACT] — 닫힘 태그 없어도 허용"""
    facts = []
    field_keys = ["서비스명", "팩트", "통과게이트", "등급", "유형", "분류근거"]
    # [FACT] 기준으로 분리 → 각 청크를 [/FACT] 또는 다음 [FACT] 전까지 파싱
    parts = re.split(r"\[FACT\]", text)
    for part in parts[1:]:
        block = re.split(r"\[/FACT\]|\[FACT\]", part)[0]
        entry = _make_fact_entry(_parse_block(block.strip(), field_keys))
        if entry:
            facts.append(entry)
    return facts


def _clean_why_value(v: str) -> str:
    """Why 필드 값에서 파싱 잔재 제거"""
    v = re.sub(r'\[인사이트등급\s*:\s*[SABC]\]', '', v)  # 임베드된 등급 태그 제거
    v = re.sub(r'^<|>$', '', v.strip())                   # 앞뒤 꺾쇠 제거
    v = re.sub(r'\[/?WHY\]', '', v)                       # 잔여 태그 제거
    return v.strip()


def parse_whys(text: str) -> dict:
    """Stage 2 출력 파싱 — [WHY]...[/WHY] 또는 닫힘 태그 없음, 복수 블록 모두 허용"""
    field_keys = ["Why1(서비스)", "Why2(산업)", "Why3(사용자)", "Why4(구조)", "Why5(확장)", "인사이트등급"]
    merged: dict = {}
    parts = re.split(r"\[WHY\]", text)
    for part in parts[1:]:
        chunk = re.split(r"\[/WHY\]|\[WHY\]", part)[0]
        data = _parse_block(chunk.strip(), field_keys)
        for k, v in data.items():
            cleaned = _clean_why_value(v)
            if cleaned and k not in merged:
                merged[k] = cleaned

    whys = {wk: merged[wk] for wk in field_keys[:-1] if merged.get(wk, "").strip()}

    # 인사이트등급: 필드로 못 잡히면 텍스트에서 직접 추출
    insight_grade = merged.get("인사이트등급", "").strip()
    if not insight_grade:
        m = re.search(r'\[인사이트등급\s*:\s*([SABC])\]', text)
        if m:
            insight_grade = m.group(1)
    # S/A/B/C 한 글자만 남기기
    insight_grade = re.sub(r'[^SABC]', '', insight_grade.upper())[:1]

    return {"whys": whys, "insight_grade": insight_grade}


def parse_facts(text: str) -> list[dict]:
    """Legacy: [FACT QUALIFIED]...[/FACT QUALIFIED] 파싱"""
    facts = []
    field_keys = [
        "서비스명", "팩트", "통과게이트", "등급", "유형",
        "Why1(서비스)", "Why2(산업)", "Why3(사용자)", "Why4(구조)", "Why5(확장)", "인사이트등급",
    ]
    for block in re.findall(r"\[FACT QUALIFIED\](.*?)\[/FACT QUALIFIED\]", text, re.DOTALL):
        data = _parse_block(block, field_keys)
        entry = _make_fact_entry(data)
        if not entry:
            continue
        whys = {wk: data[wk] for wk in field_keys[5:10] if data.get(wk, "").strip()}
        entry["whys"] = whys
        entry["insight_grade"] = data.get("인사이트등급", "")
        facts.append(entry)

    if not facts:
        for line in text.splitlines():
            line = line.strip()
            m = re.match(r"^(?:팩트\s*\d+[:：]|-|\d+[.):])\s*(.+)", line)
            if m:
                c = m.group(1).strip()
                if c and len(c) > 5:
                    facts.append({"content": c, "grade": "", "fact_type": "", "service": "",
                                  "raw_fact": c, "whys": {}, "insight_grade": "", "gates": ""})
    return facts


async def _call_ollama(model: str, prompt: str, num_predict: int, num_ctx: int, timeout: int) -> str:
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(OLLAMA_URL, json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": num_predict, "num_ctx": num_ctx},
        })
        resp.raise_for_status()
        return resp.json().get("response", "")


# ── 비스트리밍 엔드포인트 (레거시 유지) ─────────────────────────────────────
@router.post("/facts")
async def analyze_facts(body: AnalyzeRequest, db: Session = Depends(get_db)):
    q = db.query(Reference).filter(Reference.project_id == body.project_id)
    if body.ref_ids:
        q = q.filter(Reference.id.in_(body.ref_ids))
    else:
        q = q.filter(Reference.stage == body.stage, Reference.analyzed == 0)
    refs = q.all()

    if not refs:
        raise HTTPException(status_code=404, detail="분석할 레퍼런스가 없습니다")

    valid_refs = [r for r in refs if r.title and not any(
        kw in (r.content or "") for kw in ["서비스 접속이 원활하지 않", "잠시 후에 다시"]
    )]
    if not valid_refs:
        raise HTTPException(status_code=422, detail="유효한 내용이 있는 레퍼런스가 없습니다")

    try:
        raw_text = await _call_ollama(body.model, build_prompt(valid_refs), 1500, 8192, 600)
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama 서버에 연결할 수 없습니다.")
    except httpx.ReadTimeout:
        raise HTTPException(status_code=504, detail="Ollama 응답 시간 초과")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Ollama HTTP {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ollama 오류 ({type(e).__name__}): {str(e) or repr(e)}")

    facts = parse_facts(raw_text)
    if not facts:
        return {"facts": [], "raw": raw_text, "saved": 0}

    saved = []
    if body.auto_save:
        for f_data in facts:
            fact_id = str(uuid.uuid4())
            meta = json.dumps({
                "grade": f_data["grade"], "fact_type": f_data["fact_type"],
                "service": f_data["service"], "gates": f_data["gates"],
                "insight_grade": f_data.get("insight_grade", ""), "whys": f_data.get("whys", {}),
                "classification_reason": f_data.get("classification_reason", ""),
            }, ensure_ascii=False)
            stored_content = f"{f_data['content']}\n__META__{meta}"
            db.add(Fact(id=fact_id, project_id=body.project_id, content=stored_content, created_at=datetime.utcnow()))
            whys = f_data.get("whys", {})
            db.add(FiveWhys(
                id=str(uuid.uuid4()), project_id=body.project_id, fact_id=fact_id,
                fact_content=f_data["raw_fact"],
                why1=whys.get("Why1(서비스)", ""), why2=whys.get("Why2(산업)", ""),
                why3=whys.get("Why3(사용자)", ""), why4=whys.get("Why4(구조)", ""),
                why5=whys.get("Why5(확장)", ""), principle="", created_at=datetime.utcnow(),
            ))
            saved.append({"id": fact_id, "content": stored_content})
        for ref in valid_refs:
            ref.analyzed = 1
        db.commit()
    else:
        saved = facts

    return {"facts": saved, "raw": raw_text, "saved": len(saved), "analyzed_refs": len(valid_refs)}


# ── 2단계 스트리밍 엔드포인트 ────────────────────────────────────────────────
@router.post("/facts/stream")
async def analyze_facts_stream(body: AnalyzeRequest, db: Session = Depends(get_db)):
    q = db.query(Reference).filter(Reference.project_id == body.project_id)
    if body.ref_ids:
        q = q.filter(Reference.id.in_(body.ref_ids))
    else:
        q = q.filter(Reference.stage == body.stage, Reference.analyzed == 0)
    refs = q.all()

    valid_refs = [r for r in refs if r.title and not any(
        kw in (r.content or "") for kw in ["서비스 접속이 원활하지 않", "잠시 후에 다시"]
    )]

    BATCH_SIZE = 4
    batches = [valid_refs[i:i + BATCH_SIZE] for i in range(0, len(valid_refs), BATCH_SIZE)]

    def sse(obj: dict) -> str:
        return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"

    async def generate():
        if not valid_refs:
            yield sse({"type": "error", "message": "분석할 유효한 레퍼런스가 없습니다"})
            return

        # ── Phase 1: 팩트 추출 (메모리에만 누적, DB 저장 없음) ───────────────
        all_items: list[dict] = []   # {"f_data": ..., "why_data": ...}
        analyzed_ref_ids: list[str] = []   # Ollama 성공한 배치의 ref id

        for batch_idx, batch in enumerate(batches):
            batch_num = batch_idx + 1
            yield sse({"type": "stage1", "batch": batch_num, "total": len(batches)})

            try:
                raw1 = await _call_ollama(FAST_MODEL, build_extraction_prompt(batch),
                                          num_predict=600, num_ctx=4096, timeout=120)
                batch_facts = parse_extracted_facts(raw1)
                print(f"[extract batch={batch_num}] {len(batch_facts)}facts / {len(raw1)}chars", flush=True)
                if not batch_facts:
                    print(f"[extract batch={batch_num}] preview: {raw1[:400]}", flush=True)
                for f in batch_facts:
                    all_items.append({"f_data": f, "why_data": None})
                # Ollama 성공한 batch의 ref만 analyzed 처리 대상으로 등록
                analyzed_ref_ids.extend([r.id for r in batch])
            except Exception as e:
                print(f"[extract batch={batch_num}] error: {str(e) or repr(e)}", flush=True)
                yield sse({"type": "batch_error", "batch": batch_num,
                           "message": f"배치 {batch_num} 추출 실패: {str(e)}"})

        if not all_items:
            yield sse({"type": "done", "saved": 0})
            return

        # ── Phase 2: 5Why 추론 (메모리에만 저장, DB 저장 없음) ────────────────
        for i, item in enumerate(all_items):
            yield sse({"type": "stage2", "fact": i + 1, "total": len(all_items)})
            try:
                raw2 = await _call_ollama(DEFAULT_MODEL,
                                          build_why_prompt(item["f_data"]["raw_fact"],
                                                           item["f_data"]["service"]),
                                          num_predict=600, num_ctx=3072, timeout=120)
                item["why_data"] = parse_whys(raw2)
                print(f"[reason fact={i+1}] whys={list(item['why_data']['whys'].keys())}", flush=True)
                if not item["why_data"]["whys"]:
                    print(f"[reason fact={i+1}] empty. preview: {raw2[:400]}", flush=True)
            except Exception as e:
                print(f"[reason fact={i+1}] error: {str(e) or repr(e)}", flush=True)
                item["why_data"] = {"whys": {}, "insight_grade": ""}

        # ── 최종 저장: 추출+추론 완료 후 한 번에 DB 커밋 ───────────────────────
        saved = 0
        if body.auto_save:
            try:
                now = datetime.utcnow()
                for item in all_items:
                    f_data = item["f_data"]
                    why_data = item["why_data"] or {"whys": {}, "insight_grade": ""}
                    whys = why_data["whys"]

                    fact_id = str(uuid.uuid4())
                    meta = json.dumps({
                        "grade": f_data["grade"], "fact_type": f_data["fact_type"],
                        "service": f_data["service"], "gates": f_data["gates"],
                        "insight_grade": why_data["insight_grade"], "whys": whys,
                        "classification_reason": f_data.get("classification_reason", ""),
                    }, ensure_ascii=False)
                    content = f"{f_data['content']}\n__META__{meta}"
                    db.add(Fact(id=fact_id, project_id=body.project_id,
                                content=content, created_at=now))
                    if whys:
                        db.add(FiveWhys(
                            id=str(uuid.uuid4()), project_id=body.project_id, fact_id=fact_id,
                            fact_content=f_data["raw_fact"],
                            why1=whys.get("Why1(서비스)", ""), why2=whys.get("Why2(산업)", ""),
                            why3=whys.get("Why3(사용자)", ""), why4=whys.get("Why4(구조)", ""),
                            why5=whys.get("Why5(확장)", ""), principle="", created_at=now,
                        ))
                    saved += 1

                if analyzed_ref_ids:
                    db.query(Reference).filter(Reference.id.in_(analyzed_ref_ids)).update(
                        {"analyzed": 1}, synchronize_session=False
                    )
                db.commit()
                print(f"[save] {saved}facts committed", flush=True)
            except Exception as e:
                db.rollback()
                saved = 0
                print(f"[save] error: {str(e) or repr(e)}", flush=True)
                yield sse({"type": "error", "message": f"저장 실패: {str(e)}"})
                return

        yield sse({"type": "done", "saved": saved})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/models")
async def list_models():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            resp.raise_for_status()
            models = [m["name"] for m in resp.json().get("models", [])]
            return {"models": models, "status": "ok"}
    except Exception:
        return {"models": [], "status": "offline"}
