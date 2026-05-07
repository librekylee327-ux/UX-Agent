"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";
import { STAGES } from "@/lib/types";

const STAGE_COLORS: Record<string, string> = {
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

const STAGE_TEXT: Record<string, string> = {
  blue: "text-blue-600",
  purple: "text-purple-600",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  rose: "text-rose-600",
};

const STAGE_SUBTITLES: Record<number, string> = {
  1: "버즈리포트 수집 → 유의미한 팩트 추출 → 5 Whys 역추론 → 보편 원리 도출 → 기회 파악",
  2: "MECE 원칙 기반 도메인 프레임워크 설계 — 차원 · 세부 차원 · 요소로 구조화",
  3: "전 · 중 · 후 단위로 물리적 · 사고적 행위 시퀀스 매핑, 외부 요소 포괄",
  4: "휴리스틱 가설 수립 → 인터뷰 · 쉐도잉 Raw data 수집 → 본질 추론 → 컨셉 구상",
  5: "플로우 설계 · 인터페이스 터치포인트 · 리텐션 핸들링 · 가치 제공 전방위 딜리버리",
};

const LS_PINNED = "uxer_pinned_projects";
const LS_ACCESSED = "uxer_last_accessed";

function loadPinned(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_PINNED) ?? "[]")); }
  catch { return new Set(); }
}

function loadAccessed(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_ACCESSED) ?? "{}"); }
  catch { return {}; }
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", domain: "" });
  const [showForm, setShowForm] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [lastAccessed, setLastAccessed] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    setPinnedIds(loadPinned());
    setLastAccessed(loadAccessed());
    load();
  }, []);

  async function load() {
    try {
      const data = await api.projects.list() as Project[];
      setProjects(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const p = await api.projects.create(form) as Project;
      recordAccess(p.id);
      router.push(`/project/${p.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("프로젝트를 삭제하시겠습니까?")) return;
    await api.projects.delete(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  function handlePin(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setPinnedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(LS_PINNED, JSON.stringify(Array.from(next)));
      return next;
    });
  }

  function recordAccess(id: string) {
    const now = new Date().toISOString();
    setLastAccessed((prev) => {
      const next = { ...prev, [id]: now };
      localStorage.setItem(LS_ACCESSED, JSON.stringify(next));
      return next;
    });
  }

  function handleCardClick(id: string) {
    recordAccess(id);
    router.push(`/project/${id}`);
  }

  const sorted = [...projects]
    .filter((p) =>
      search.trim() === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.domain ?? "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const pa = pinnedIds.has(a.id) ? 1 : 0;
      const pb = pinnedIds.has(b.id) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const ta = lastAccessed[a.id] ?? a.updated_at ?? "";
      const tb = lastAccessed[b.id] ?? b.updated_at ?? "";
      return tb.localeCompare(ta);
    });

  const stageInfo = (n: number) => STAGES.find((s) => s.id === n) ?? STAGES[0];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-[#e8e8ed]">
        <div className="max-w-[1200px] mx-auto px-6 py-4">
          <p className="text-[11px] text-[#a0a0a5] mb-0.5">Agentic Service</p>
          <h1 className="text-[17px] font-semibold text-[#1d1d1f]">UXER Kyle's Design Workflow Agent</h1>
        </div>
      </header>

      {/* Workflow Card — full width, dark */}
      <div className="max-w-[1200px] mx-auto px-6 pt-8 pb-8">
        <div className="bg-[#1d2433] rounded-2xl overflow-hidden">
          <div className="grid grid-cols-5 divide-x divide-white/10">
            {STAGES.map((stage) => (
              <div key={stage.id} className="relative px-5 py-5">
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${STAGE_COLORS[stage.color]}`} />
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[11px] font-bold tabular-nums ${STAGE_TEXT[stage.color]}`}>0{stage.id}</span>
                  <span className="text-[13px] font-semibold text-white">{stage.label}</span>
                </div>
                <p className="text-[11px] text-white/45 leading-relaxed">{STAGE_SUBTITLES[stage.id]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-[1200px] mx-auto px-6 pb-10">
        {/* Section Bar */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">My Project</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-[#e8e8ed] rounded-full px-3 py-1.5 text-[#a0a0a5]">
              <SearchIcon />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="text-[13px] text-[#1d1d1f] placeholder-[#a0a0a5] bg-transparent outline-none w-36"
              />
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="bg-[#0071e3] hover:bg-[#0077ed] text-white text-[13px] font-medium px-4 py-1.5 rounded-full transition-colors whitespace-nowrap"
            >
              + 새 프로젝트
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#707070]">불러오는 중...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-[#e8e8ed] text-5xl mb-4">◎</div>
            <p className="text-[#1d1d1f] text-lg mb-2">아직 프로젝트가 없습니다</p>
            <p className="text-[#707070] text-sm mb-6">새 UX 기획 프로젝트를 시작해보세요</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-[#0071e3] hover:bg-[#0077ed] text-white text-[13px] font-normal px-5 py-2 rounded-full transition-colors"
            >
              첫 프로젝트 만들기
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-[#707070] text-sm">검색 결과가 없습니다</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sorted.map((p) => {
              const stage = stageInfo(p.current_stage);
              const pinned = pinnedIds.has(p.id);
              const accessed = lastAccessed[p.id];
              return (
                <div
                  key={p.id}
                  onClick={() => handleCardClick(p.id)}
                  className={`group relative bg-white rounded-2xl p-5 cursor-pointer transition-all border hover:shadow-md ${
                    pinned ? "border-[#0071e3]/20" : "border-[#e8e8ed] hover:border-[#d2d2d7]"
                  }`}
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_TEXT[stage.color]} bg-[#f5f5f7]`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STAGE_COLORS[stage.color]}`} />
                        {stage.label}
                      </div>
                      <button
                        onClick={(e) => handlePin(p.id, e)}
                        className={`p-1 rounded transition-all ${
                          pinned
                            ? "text-amber-400 opacity-100"
                            : "text-[#c7c7cc] opacity-0 group-hover:opacity-100 hover:text-amber-400"
                        }`}
                        title={pinned ? "핀 해제" : "핀 고정"}
                      >
                        <StarIcon filled={pinned} />
                      </button>
                    </div>
                    <button
                      onClick={(e) => handleDelete(p.id, e)}
                      className="text-[#d2d2d7] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all text-xs px-1 leading-none"
                    >
                      ✕
                    </button>
                  </div>

                  <h2 className="text-[15px] font-semibold text-[#1d1d1f] mb-1 leading-snug">{p.name}</h2>
                  {p.description && (
                    <p className="text-xs text-[#707070] line-clamp-2 mb-2">{p.description}</p>
                  )}

                  {/* Progress bars */}
                  <div className="flex gap-1 my-3">
                    {STAGES.map((s) => (
                      <div
                        key={s.id}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          s.id <= p.current_stage ? STAGE_COLORS[s.color] : "bg-[#e8e8ed]"
                        }`}
                      />
                    ))}
                  </div>

                  {accessed && (
                    <p className="text-[11px] text-[#a0a0a5]">최근 접속일: {fmtDateTime(accessed)}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-[#1d1d1f]/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[28px] p-7 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-[#1d1d1f] mb-5">새 프로젝트 만들기</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-[#707070] mb-1.5">프로젝트명 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예: 배달앱 UX 리디자인"
                  className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2.5 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-[#0071e3] transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-[#707070] mb-1.5">도메인</label>
                <input
                  type="text"
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="예: 음식 배달, 헬스케어, 금융"
                  className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2.5 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-[#0071e3] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-[#707070] mb-1.5">설명</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="프로젝트 배경 및 목표"
                  rows={3}
                  className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2.5 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-[#0071e3] resize-none transition-colors"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] text-sm font-medium py-2.5 rounded-full transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating || !form.name.trim()}
                  className="flex-1 bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-full transition-colors"
                >
                  {creating ? "생성 중..." : "시작하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
