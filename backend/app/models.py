import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from app.database import Base


def gen_id():
    return str(uuid.uuid4())


class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    domain = Column(String, default="")
    current_stage = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Reference(Base):
    __tablename__ = "references"
    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    stage = Column(Integer, default=1)
    url = Column(Text, default="")
    title = Column(Text, default="")
    content = Column(Text, default="")
    source = Column(String, default="")
    crawled_at = Column(DateTime, default=datetime.utcnow)
    analyzed = Column(Integer, default=0)  # 0=미분석, 1=분석완료


class Fact(Base):
    __tablename__ = "facts"
    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    reference_id = Column(String, ForeignKey("references.id", ondelete="SET NULL"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class FiveWhys(Base):
    __tablename__ = "five_whys"
    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    fact_id = Column(String, ForeignKey("facts.id", ondelete="CASCADE"), nullable=True)
    fact_content = Column(Text, default="")
    why1 = Column(Text, default="")  # A1 (backward compat)
    why2 = Column(Text, default="")  # A2
    why3 = Column(Text, default="")  # A3
    why4 = Column(Text, default="")  # A4
    why5 = Column(Text, default="")  # A5
    chain_json = Column(Text, nullable=True)   # JSON: [{q, a}, ...] × 5
    insight = Column(Text, default="")         # 핵심 인사이트 (AI 생성)
    principle = Column(Text, default="")       # 보편 원리 (사용자 작성)
    created_at = Column(DateTime, default=datetime.utcnow)


class Framework(Base):
    __tablename__ = "frameworks"
    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    structure = Column(Text, default="[]")  # JSON: [{dimension, sub_dimensions: [{name, elements: []}]}]
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Sequence(Base):
    __tablename__ = "sequences"
    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    persona = Column(String, default="")
    phase = Column(String, default="during")  # pre / during / post
    action_type = Column(String, default="physical")  # physical / cognitive
    action = Column(Text, nullable=False)
    target = Column(Text, default="")  # 대상/외부요소
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Insight(Base):
    __tablename__ = "insights"
    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    type = Column(String, default="hypothesis")  # hypothesis / raw_data / interview
    content = Column(Text, nullable=False)
    cluster_tag = Column(String, default="")
    source = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Concept(Base):
    __tablename__ = "concepts"
    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    flow = Column(Text, default="[]")  # JSON: [{step, description}]
    interface_notes = Column(Text, default="")
    retention_notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
