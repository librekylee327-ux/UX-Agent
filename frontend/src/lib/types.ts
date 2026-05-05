export interface Project {
  id: string;
  name: string;
  description: string;
  domain: string;
  current_stage: number;
  created_at: string;
  updated_at: string;
}

export interface Reference {
  id: string;
  project_id: string;
  stage: number;
  url: string;
  title: string;
  content: string;
  source: string;
  crawled_at: string;
  analyzed: number; // 0=미분석, 1=분석완료
}

export interface Fact {
  id: string;
  project_id: string;
  reference_id: string | null;
  content: string;
  created_at: string;
}

export interface WhyChainStep {
  q: string;
  a: string;
}

export interface FiveWhys {
  id: string;
  project_id: string;
  fact_id: string | null;
  fact_content: string;
  why1: string;
  why2: string;
  why3: string;
  why4: string;
  why5: string;
  chain_json: string | null;  // JSON: WhyChainStep[]
  insight: string;
  principle: string;
  created_at: string;
}

export interface Framework {
  id: string;
  project_id: string;
  structure: string; // JSON string
  notes: string;
  updated_at: string;
}

export interface FrameworkDimension {
  id: string;
  name: string;
  sub_dimensions: FrameworkSubDimension[];
}

export interface FrameworkSubDimension {
  id: string;
  name: string;
  elements: string[];
}

export interface Sequence {
  id: string;
  project_id: string;
  persona: string;
  phase: "pre" | "during" | "post";
  action_type: "physical" | "cognitive";
  action: string;
  target: string;
  order_index: number;
  created_at: string;
}

export interface Insight {
  id: string;
  project_id: string;
  type: "hypothesis" | "raw_data" | "interview";
  content: string;
  cluster_tag: string;
  source: string;
  created_at: string;
}

export interface Concept {
  id: string;
  project_id: string;
  title: string;
  description: string;
  flow: string; // JSON string: [{step, description}]
  interface_notes: string;
  retention_notes: string;
  created_at: string;
  updated_at: string;
}

export interface CrawlResult {
  title: string;
  url: string;
  summary: string;
  source: string;
  published_at: string;
  content: string;
  error?: string;
}

export const STAGES = [
  { id: 1, label: "목적 탐지", desc: "버즈 수집 · 혁신 원리 추출", color: "blue" },
  { id: 2, label: "맥락 파악", desc: "MECE 도메인 프레임워크", color: "purple" },
  { id: 3, label: "사람 이해", desc: "행위 시퀀스 매핑", color: "emerald" },
  { id: 4, label: "추상 진입", desc: "가설 수립 · Raw data", color: "amber" },
  { id: 5, label: "솔루션 도출", desc: "컨셉 · 플로우 · 인터페이스", color: "rose" },
] as const;

export type StageColor = "blue" | "purple" | "emerald" | "amber" | "rose";
