import uuid
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.models import Reference, Fact, FiveWhys, Framework, Sequence, Insight, Concept

router = APIRouter(prefix="/api", tags=["stages"])


# ─── References ───────────────────────────────────────────────

class ReferenceCreate(BaseModel):
    stage: int = 1
    url: str = ""
    title: str = ""
    content: str = ""
    source: str = ""


@router.get("/projects/{project_id}/references")
def list_references(project_id: str, stage: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Reference).filter(Reference.project_id == project_id)
    if stage:
        q = q.filter(Reference.stage == stage)
    refs = q.order_by(Reference.crawled_at.desc()).all()
    return [_ser_ref(r) for r in refs]


@router.post("/projects/{project_id}/references")
def create_reference(project_id: str, body: ReferenceCreate, db: Session = Depends(get_db)):
    ref = Reference(id=str(uuid.uuid4()), project_id=project_id, **body.model_dump(), crawled_at=datetime.utcnow())
    db.add(ref)
    db.commit()
    db.refresh(ref)
    return _ser_ref(ref)


@router.delete("/references/{ref_id}")
def delete_reference(ref_id: str, db: Session = Depends(get_db)):
    ref = db.query(Reference).filter(Reference.id == ref_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="레퍼런스를 찾을 수 없습니다")
    db.delete(ref)
    db.commit()
    return {"ok": True}


# ─── Facts ────────────────────────────────────────────────────

class FactCreate(BaseModel):
    content: str
    reference_id: Optional[str] = None


@router.get("/projects/{project_id}/facts")
def list_facts(project_id: str, db: Session = Depends(get_db)):
    facts = db.query(Fact).filter(Fact.project_id == project_id).order_by(Fact.created_at.desc()).all()
    return [_ser_fact(f) for f in facts]


@router.post("/projects/{project_id}/facts")
def create_fact(project_id: str, body: FactCreate, db: Session = Depends(get_db)):
    fact = Fact(id=str(uuid.uuid4()), project_id=project_id, content=body.content,
                reference_id=body.reference_id, created_at=datetime.utcnow())
    db.add(fact)
    db.commit()
    db.refresh(fact)
    return _ser_fact(fact)


@router.delete("/facts/{fact_id}")
def delete_fact(fact_id: str, db: Session = Depends(get_db)):
    f = db.query(Fact).filter(Fact.id == fact_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="팩트를 찾을 수 없습니다")
    db.delete(f)
    db.commit()
    return {"ok": True}


# ─── Five Whys ────────────────────────────────────────────────

class FiveWhysCreate(BaseModel):
    fact_id: Optional[str] = None
    fact_content: str = ""
    why1: str = ""
    why2: str = ""
    why3: str = ""
    why4: str = ""
    why5: str = ""
    chain_json: Optional[str] = None
    insight: str = ""
    principle: str = ""


@router.get("/projects/{project_id}/five-whys")
def list_five_whys(project_id: str, db: Session = Depends(get_db)):
    items = db.query(FiveWhys).filter(FiveWhys.project_id == project_id).order_by(FiveWhys.created_at.desc()).all()
    return [_ser_fw(i) for i in items]


@router.post("/projects/{project_id}/five-whys")
def create_five_whys(project_id: str, body: FiveWhysCreate, db: Session = Depends(get_db)):
    fw = FiveWhys(id=str(uuid.uuid4()), project_id=project_id, created_at=datetime.utcnow(), **body.model_dump())
    db.add(fw)
    db.commit()
    db.refresh(fw)
    return _ser_fw(fw)


@router.put("/five-whys/{fw_id}")
def update_five_whys(fw_id: str, body: FiveWhysCreate, db: Session = Depends(get_db)):
    fw = db.query(FiveWhys).filter(FiveWhys.id == fw_id).first()
    if not fw:
        raise HTTPException(status_code=404, detail="5 Whys를 찾을 수 없습니다")
    for k, v in body.model_dump().items():
        setattr(fw, k, v)
    db.commit()
    db.refresh(fw)
    return _ser_fw(fw)


@router.delete("/five-whys/{fw_id}")
def delete_five_whys(fw_id: str, db: Session = Depends(get_db)):
    fw = db.query(FiveWhys).filter(FiveWhys.id == fw_id).first()
    if not fw:
        raise HTTPException(status_code=404, detail="5 Whys를 찾을 수 없습니다")
    db.delete(fw)
    db.commit()
    return {"ok": True}


# ─── Framework ────────────────────────────────────────────────

class FrameworkUpsert(BaseModel):
    structure: str = "[]"  # JSON string
    notes: str = ""


@router.get("/projects/{project_id}/framework")
def get_framework(project_id: str, db: Session = Depends(get_db)):
    fw = db.query(Framework).filter(Framework.project_id == project_id).first()
    return _ser_framework(fw) if fw else None


@router.post("/projects/{project_id}/framework")
def upsert_framework(project_id: str, body: FrameworkUpsert, db: Session = Depends(get_db)):
    fw = db.query(Framework).filter(Framework.project_id == project_id).first()
    if fw:
        fw.structure = body.structure
        fw.notes = body.notes
        fw.updated_at = datetime.utcnow()
    else:
        fw = Framework(id=str(uuid.uuid4()), project_id=project_id,
                       structure=body.structure, notes=body.notes,
                       created_at=datetime.utcnow(), updated_at=datetime.utcnow())
        db.add(fw)
    db.commit()
    db.refresh(fw)
    return _ser_framework(fw)


# ─── Sequences ────────────────────────────────────────────────

class SequenceCreate(BaseModel):
    persona: str = ""
    phase: str = "during"
    action_type: str = "physical"
    action: str
    target: str = ""
    order_index: int = 0


@router.get("/projects/{project_id}/sequences")
def list_sequences(project_id: str, db: Session = Depends(get_db)):
    items = db.query(Sequence).filter(Sequence.project_id == project_id).order_by(Sequence.order_index).all()
    return [_ser_seq(s) for s in items]


@router.post("/projects/{project_id}/sequences")
def create_sequence(project_id: str, body: SequenceCreate, db: Session = Depends(get_db)):
    s = Sequence(id=str(uuid.uuid4()), project_id=project_id, created_at=datetime.utcnow(), **body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return _ser_seq(s)


@router.put("/sequences/{seq_id}")
def update_sequence(seq_id: str, body: SequenceCreate, db: Session = Depends(get_db)):
    s = db.query(Sequence).filter(Sequence.id == seq_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="시퀀스를 찾을 수 없습니다")
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return _ser_seq(s)


@router.delete("/sequences/{seq_id}")
def delete_sequence(seq_id: str, db: Session = Depends(get_db)):
    s = db.query(Sequence).filter(Sequence.id == seq_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="시퀀스를 찾을 수 없습니다")
    db.delete(s)
    db.commit()
    return {"ok": True}


# ─── Insights ─────────────────────────────────────────────────

class InsightCreate(BaseModel):
    type: str = "hypothesis"
    content: str
    cluster_tag: str = ""
    source: str = ""


class InsightUpdate(BaseModel):
    content: Optional[str] = None
    cluster_tag: Optional[str] = None
    type: Optional[str] = None


@router.get("/projects/{project_id}/insights")
def list_insights(project_id: str, db: Session = Depends(get_db)):
    items = db.query(Insight).filter(Insight.project_id == project_id).order_by(Insight.created_at.desc()).all()
    return [_ser_insight(i) for i in items]


@router.post("/projects/{project_id}/insights")
def create_insight(project_id: str, body: InsightCreate, db: Session = Depends(get_db)):
    i = Insight(id=str(uuid.uuid4()), project_id=project_id, created_at=datetime.utcnow(), **body.model_dump())
    db.add(i)
    db.commit()
    db.refresh(i)
    return _ser_insight(i)


@router.put("/insights/{insight_id}")
def update_insight(insight_id: str, body: InsightUpdate, db: Session = Depends(get_db)):
    i = db.query(Insight).filter(Insight.id == insight_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="인사이트를 찾을 수 없습니다")
    if body.content is not None:
        i.content = body.content
    if body.cluster_tag is not None:
        i.cluster_tag = body.cluster_tag
    if body.type is not None:
        i.type = body.type
    db.commit()
    db.refresh(i)
    return _ser_insight(i)


@router.delete("/insights/{insight_id}")
def delete_insight(insight_id: str, db: Session = Depends(get_db)):
    i = db.query(Insight).filter(Insight.id == insight_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="인사이트를 찾을 수 없습니다")
    db.delete(i)
    db.commit()
    return {"ok": True}


# ─── Concepts ─────────────────────────────────────────────────

class ConceptCreate(BaseModel):
    title: str
    description: str = ""
    flow: str = "[]"
    interface_notes: str = ""
    retention_notes: str = ""


@router.get("/projects/{project_id}/concepts")
def list_concepts(project_id: str, db: Session = Depends(get_db)):
    items = db.query(Concept).filter(Concept.project_id == project_id).order_by(Concept.created_at.desc()).all()
    return [_ser_concept(c) for c in items]


@router.post("/projects/{project_id}/concepts")
def create_concept(project_id: str, body: ConceptCreate, db: Session = Depends(get_db)):
    c = Concept(id=str(uuid.uuid4()), project_id=project_id,
                created_at=datetime.utcnow(), updated_at=datetime.utcnow(), **body.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return _ser_concept(c)


@router.put("/concepts/{concept_id}")
def update_concept(concept_id: str, body: ConceptCreate, db: Session = Depends(get_db)):
    c = db.query(Concept).filter(Concept.id == concept_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="컨셉을 찾을 수 없습니다")
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    c.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(c)
    return _ser_concept(c)


@router.delete("/concepts/{concept_id}")
def delete_concept(concept_id: str, db: Session = Depends(get_db)):
    c = db.query(Concept).filter(Concept.id == concept_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="컨셉을 찾을 수 없습니다")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ─── Serializers ──────────────────────────────────────────────

def _ser_ref(r: Reference):
    return {"id": r.id, "project_id": r.project_id, "stage": r.stage, "url": r.url,
            "title": r.title, "content": r.content, "source": r.source,
            "crawled_at": r.crawled_at.isoformat() if r.crawled_at else None,
            "analyzed": r.analyzed or 0}


def _ser_fact(f: Fact):
    return {"id": f.id, "project_id": f.project_id, "reference_id": f.reference_id,
            "content": f.content, "created_at": f.created_at.isoformat() if f.created_at else None}


def _ser_fw(fw: FiveWhys):
    return {"id": fw.id, "project_id": fw.project_id, "fact_id": fw.fact_id,
            "fact_content": fw.fact_content, "why1": fw.why1, "why2": fw.why2,
            "why3": fw.why3, "why4": fw.why4, "why5": fw.why5,
            "chain_json": fw.chain_json, "insight": fw.insight or "",
            "principle": fw.principle,
            "created_at": fw.created_at.isoformat() if fw.created_at else None}


def _ser_framework(fw: Framework):
    return {"id": fw.id, "project_id": fw.project_id, "structure": fw.structure,
            "notes": fw.notes, "updated_at": fw.updated_at.isoformat() if fw.updated_at else None}


def _ser_seq(s: Sequence):
    return {"id": s.id, "project_id": s.project_id, "persona": s.persona, "phase": s.phase,
            "action_type": s.action_type, "action": s.action, "target": s.target,
            "order_index": s.order_index, "created_at": s.created_at.isoformat() if s.created_at else None}


def _ser_insight(i: Insight):
    return {"id": i.id, "project_id": i.project_id, "type": i.type, "content": i.content,
            "cluster_tag": i.cluster_tag, "source": i.source,
            "created_at": i.created_at.isoformat() if i.created_at else None}


def _ser_concept(c: Concept):
    return {"id": c.id, "project_id": c.project_id, "title": c.title, "description": c.description,
            "flow": c.flow, "interface_notes": c.interface_notes, "retention_notes": c.retention_notes,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None}
