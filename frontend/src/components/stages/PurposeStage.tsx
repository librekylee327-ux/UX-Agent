"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Reference, Fact, FiveWhys } from "@/lib/types";

interface Props { projectId: string; refreshKey?: number; }

const META_SEP = "\n__META__";

interface FactMeta {
  grade: string;
  fact_type: string;
  service: string;
  gates: string;
  insight_grade: string;
  whys: Record<string, string>;
  classification_reason?: string;
}

function parseFact(content: string): { display: string; meta: FactMeta | null } {
  const idx = content.indexOf(META_SEP);
  if (idx === -1) return { display: content, meta: null };
  try {
    return { display: content.slice(0, idx), meta: JSON.parse(content.slice(idx + META_SEP.length)) };
  } catch {
    return { display: content.slice(0, idx), meta: null };
  }
}

function formatTimestamp(iso: string): string {
  const utc = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  const yy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const min = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${yy}.${mm}.${dd} ${hh}:${min}`;
}

const GRADE_STYLE: Record<string, string> = {
  S: "text-amber-700 bg-amber-50 border-amber-200",
  A: "text-blue-700 bg-blue-50 border-blue-200",
  B: "text-[#474747] bg-[#f5f5f7] border-[#e8e8ed]",
  C: "text-[#707070] bg-[#f5f5f7] border-[#e8e8ed]",
};

const TYPE_STYLE: Record<string, string> = {
  "TYPE A": "text-purple-700 bg-purple-50 border-purple-200",
  "TYPE B": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "TYPE C": "text-sky-700 bg-sky-50 border-sky-200",
  "TYPE D": "text-rose-700 bg-rose-50 border-rose-200",
};

const GATE_DESC: Record<string, string> = {
  Gate1: "특정 서비스·산업 도메인의 실제 현상",
  Gate2: "비관행적이거나 예상치 못한 패턴",
  Gate3: "구조적 원인을 역추론할 수 있는 단서",
};

const TYPE_DESC: Record<string, string> = {
  "TYPE A": "행동 비관행: 사용자·서비스가 일반적 패턴에서 벗어난 행동",
  "TYPE B": "구조 변화: 시장·산업·서비스 구조가 변화하는 신호",
  "TYPE C": "사용자 이상치: 예상치 못한 사용자 반응·행동 패턴",
  "TYPE D": "수익/비용 이상: 비관행적 수익화 모델이나 비용 구조",
};



export default function PurposeStage({ projectId, refreshKey }: Props) {
  const [refs, setRefs] = useState<Reference[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [fiveWhys, setFiveWhys] = useState<FiveWhys[]>([]);
  const [newFact, setNewFact] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [editingFw, setEditingFw] = useState<Partial<FiveWhys> | null>(null);
  const [activeRefId, setActiveRefId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<{ saved: number; error?: string } | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState<
    | { stage: 1; batch: number; total: number }
    | { stage: 2; fact: number; total: number }
    | null
  >(null);
  const [ellipsis, setEllipsis] = useState("");
  const [ollamaStatus, setOllamaStatus] = useState<"unknown" | "ok" | "offline">("unknown");
  const [expandedFactId, setExpandedFactId] = useState<string | null>(null);
  const [refTab, setRefTab] = useState<"all" | "pending" | "done">("all");
  const [refPage, setRefPage] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<{ type: "fact" | "ref" | "fw"; id: string } | null>(null);

  useEffect(() => {
    load();
    checkOllama();
  }, [projectId]);

  useEffect(() => {
    if (!analyzing) { setEllipsis(""); return; }
    let count = 0;
    const id = setInterval(() => {
      count = (count + 1) % 4;
      setEllipsis(".".repeat(count));
    }, 400);
    return () => clearInterval(id);
  }, [analyzing]);

  useEffect(() => {
    if (refreshKey) load();
  }, [refreshKey]);

  async function checkOllama() {
    try {
      const res = await fetch("http://localhost:8000/api/analyze/models");
      const data = await res.json();
      setOllamaStatus(data.status === "ok" ? "ok" : "offline");
    } catch {
      setOllamaStatus("offline");
    }
  }

  async function analyzeWithOllama() {
    setAnalyzing(true);
    setAnalyzeResult(null);
    setAnalyzeProgress(null);
    let resultSet = false;
    try {
      const res = await fetch("http://localhost:8000/api/analyze/facts/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, stage: 1, auto_save: true }),
      });
      if (!res.ok || !res.body) {
        const text = await res.text();
        let d: { detail?: string };
        try { d = JSON.parse(text); } catch { throw new Error(text.slice(0, 80)); }
        throw new Error(d.detail || "분석 실패");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          let data: {
            type: string;
            batch?: number; total?: number; fact?: number; saved?: number; message?: string;
          };
          try { data = JSON.parse(line.slice(6)); } catch { continue; }

          if (data.type === "stage1") {
            setAnalyzeProgress({ stage: 1, batch: data.batch!, total: data.total! });
          } else if (data.type === "stage2") {
            setAnalyzeProgress({ stage: 2, fact: data.fact!, total: data.total! });
          } else if (data.type === "done") {
            await load();
            resultSet = true;
            setAnalyzeResult({ saved: data.saved ?? 0 });
            setAnalyzing(false);
            setAnalyzeProgress(null);
          } else if (data.type === "error") {
            resultSet = true;
            throw new Error(data.message || "분석 실패");
          }
        }
      }
    } catch (e: unknown) {
      resultSet = true;
      setAnalyzeResult({ saved: 0, error: e instanceof Error ? e.message : "오류 발생" });
    } finally {
      if (!resultSet) {
        setAnalyzeResult({ saved: 0 });
      }
      setAnalyzing(false);
      setAnalyzeProgress(null);
    }
  }

  async function load() {
    const [r, f, fw] = await Promise.all([
      api.references.list(projectId, 1) as Promise<Reference[]>,
      api.facts.list(projectId) as Promise<Fact[]>,
      api.fiveWhys.list(projectId) as Promise<FiveWhys[]>,
    ]);
    setRefs(r);
    setFacts(f);
    setFiveWhys(fw);
  }


  async function addFact(refId?: string) {
    if (!newFact.trim()) return;
    await api.facts.create(projectId, { content: newFact.trim(), reference_id: refId });
    setNewFact("");
    load();
  }

  async function addBulkFacts() {
    const lines = bulkInput
      .split("\n")
      .map((l) => l.replace(/^팩트\s*\d+[:：]\s*/i, "").trim())
      .filter(Boolean);
    if (!lines.length) return;
    await Promise.all(lines.map((content) => api.facts.create(projectId, { content })));
    setBulkInput("");
    setShowBulk(false);
    load();
  }

  async function deleteFact(id: string) {
    await api.facts.delete(id);
    setFacts((p) => p.filter((f) => f.id !== id));
  }

  async function saveFiveWhys() {
    if (!editingFw) return;
    if (editingFw.id) {
      await api.fiveWhys.update(editingFw.id, editingFw);
    } else {
      await api.fiveWhys.create(projectId, editingFw);
    }
    setEditingFw(null);
    load();
  }

  async function deleteFw(id: string) {
    await api.fiveWhys.delete(id);
    setFiveWhys((p) => p.filter((f) => f.id !== id));
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { type, id } = pendingDelete;
    if (type === "fact") await deleteFact(id);
    else if (type === "fw") await deleteFw(id);
    else { await api.references.delete(id); load(); }
    setPendingDelete(null);
  }

  const principles = fiveWhys.filter((fw) => fw.principle.trim());
  const pendingRefs = refs.filter((r) => !r.analyzed);
  const analyzedRefs = refs.filter((r) => r.analyzed);

  return (
    <div className="space-y-6">
      {/* References */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#1d1d1f] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            수집된 레퍼런스 ({refs.length})
          </h3>
          {pendingRefs.length > 0 && (
            <button
              onClick={analyzeWithOllama}
              disabled={analyzing || ollamaStatus === "offline"}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium flex items-center gap-1.5
                ${analyzing
                  ? "bg-purple-50 border-purple-200 text-purple-500 cursor-wait"
                  : ollamaStatus === "offline"
                  ? "bg-[#f5f5f7] border-[#e8e8ed] text-[#707070] cursor-not-allowed"
                  : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"}`}
            >
              {analyzing
                ? <span className="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin flex-shrink-0" />
                : <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ollamaStatus === "ok" ? "bg-emerald-500" : "bg-[#d2d2d7]"}`} />
              }
              {analyzing
                ? <span className="tabular-nums">
                    {analyzeProgress?.stage === 1
                      ? `배치 ${analyzeProgress.batch}/${analyzeProgress.total} 팩트 추출 중`
                      : analyzeProgress?.stage === 2
                      ? `5Why 추론 중 (${analyzeProgress.fact}/${analyzeProgress.total})`
                      : "분석 준비 중"
                    }{ellipsis}
                    <span className="invisible">{".".repeat(3 - ellipsis.length)}</span>
                  </span>
                : `AI 자동 추출 (${pendingRefs.length}건)`
              }
            </button>
          )}
        </div>

        {analyzeResult && (
          <div className={`mb-3 p-2.5 rounded-[10px] border text-xs flex items-center justify-between gap-2
            ${analyzeResult.error
              ? "bg-rose-50 border-rose-200 text-rose-600"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}
          >
            <span>{analyzeResult.error ? `오류: ${analyzeResult.error}` : `팩트 ${analyzeResult.saved}개 자동 추출 완료 ✓`}</span>
            <button
              onClick={() => setAnalyzeResult(null)}
              className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >×</button>
          </div>
        )}

        {refs.length === 0 ? (
          <p className="text-xs text-[#707070] px-1">우측 크롤러에서 버즈리포트를 수집하세요</p>
        ) : (
          <>
            {/* 탭 */}
            <div className="flex gap-1 mb-3">
              {(
                [
                  { key: "all",     label: "전체",    count: refs.length },
                  { key: "pending", label: "분석 전", count: pendingRefs.length },
                  { key: "done",    label: "완료",    count: analyzedRefs.length },
                ] as const
              ).map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => { setRefTab(key); setRefPage(0); }}
                  className={`text-xs px-2.5 py-1 rounded-[10px] border transition-colors flex items-center gap-1.5
                    ${refTab === key
                      ? "bg-white border-[#e8e8ed] text-[#1d1d1f]"
                      : "bg-transparent border-transparent text-[#707070] hover:text-[#1d1d1f]"}`}
                >
                  {label}
                  <span className={`text-xs rounded px-1 ${refTab === key ? "bg-[#f5f5f7] text-[#707070]" : "text-[#d2d2d7]"}`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            {/* 가로 카드 그리드 */}
            {(() => {
              const PAGE_SIZE = 4;
              const list = refTab === "all" ? refs : refTab === "pending" ? pendingRefs : analyzedRefs;
              const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
              const paged = list.slice(refPage * PAGE_SIZE, refPage * PAGE_SIZE + PAGE_SIZE);

              return (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {list.length === 0 ? (
                      <div className="col-span-4 flex items-center justify-center h-28 rounded-[10px] border border-dashed border-[#e8e8ed] bg-[#f5f5f7]">
                        <p className="text-xs text-[#707070]">
                          {refTab === "pending" ? "분석 전 레퍼런스가 없습니다" : "분석 완료된 레퍼런스가 없습니다"}
                        </p>
                      </div>
                    ) : paged.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => !r.analyzed && setActiveRefId(activeRefId === r.id ? null : r.id)}
                        className={`relative flex flex-col justify-between p-2.5 rounded-[10px] border text-xs transition-colors h-28
                          ${r.analyzed
                            ? "bg-[#f5f5f7] border-[#e8e8ed] opacity-60"
                            : activeRefId === r.id
                            ? "bg-blue-50 border-blue-200 cursor-pointer"
                            : "bg-white border-[#e8e8ed] hover:border-[#d2d2d7] cursor-pointer"}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-medium text-[#1d1d1f] leading-snug line-clamp-3 flex-1">{r.title}</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPendingDelete({ type: "ref", id: r.id }); }}
                            className="text-[#d2d2d7] hover:text-rose-500 flex-shrink-0 leading-none"
                          >×</button>
                        </div>
                        <div className="flex items-center justify-between mt-1.5 text-[#707070]">
                          <span className="truncate">{r.source}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {r.analyzed && <span className="text-emerald-600 font-medium">완료</span>}
                            {r.url && (
                              <a href={r.url} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[#0066cc] hover:underline">링크</a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 페이지네이션 */}
                  <div className="flex items-center justify-between mt-2">
                    <button
                      onClick={() => setRefPage((p) => Math.max(0, p - 1))}
                      disabled={refPage === 0}
                      className="text-xs text-[#707070] hover:text-[#1d1d1f] disabled:opacity-0 px-2 py-1 rounded transition-colors"
                    >← 이전</button>
                    <span className="text-xs text-[#707070] tabular-nums">
                      {refPage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setRefPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={refPage === totalPages - 1}
                      className="text-xs text-[#707070] hover:text-[#1d1d1f] disabled:opacity-0 px-2 py-1 rounded transition-colors"
                    >다음 →</button>
                  </div>
                </>
              );
            })()}
          </>
        )}
      </section>

      {/* Facts */}
      <section>
        <div className="flex items-center mb-3">
          <h3 className="text-sm font-semibold text-[#1d1d1f] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            유의미한 팩트 ({facts.length})
          </h3>
        </div>

        {showBulk && (
          <div className="mb-3 p-3 bg-[#f5f5f7] border border-blue-200 rounded-[10px] space-y-2">
            <p className="text-xs text-blue-600 font-medium">Claude 응답 붙여넣기</p>
            <p className="text-xs text-[#707070]">"팩트 1: ..." 형식으로 붙여넣으면 자동으로 파싱해서 저장합니다</p>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              rows={6}
              placeholder={"팩트 1: 배달 앱 주문 완료 후 사용자 84%가 실시간 위치 추적을 반복 확인한다\n팩트 2: ..."}
              className="w-full bg-white border border-[#e8e8ed] rounded-[10px] px-3 py-2.5 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-[#0071e3] resize-none font-mono"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setBulkInput(""); setShowBulk(false); }}
                className="flex-1 text-xs bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] py-2 rounded-full transition-colors"
              >취소</button>
              <button
                onClick={addBulkFacts}
                disabled={!bulkInput.trim()}
                className="flex-1 text-xs bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-40 text-white py-2 rounded-full font-medium transition-colors"
              >
                {bulkInput.trim().split("\n").filter(Boolean).length}개 팩트 저장
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newFact}
            onChange={(e) => setNewFact(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFact(activeRefId ?? undefined)}
            placeholder="팩트 직접 입력 (Enter)"
            className="flex-1 bg-white border border-[#e8e8ed] rounded-[10px] px-3 py-2 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-[#0071e3] transition-colors"
          />
          <button
            onClick={() => addFact(activeRefId ?? undefined)}
            disabled={!newFact.trim()}
            className="bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-40 text-white text-sm px-4 py-2 rounded-full transition-colors"
          >추가</button>
        </div>
        {activeRefId && <p className="text-xs text-blue-500 mb-2">선택된 레퍼런스에 연결됨</p>}

        <div className="space-y-1.5">
          {facts.map((f) => {
            const { display, meta } = parseFact(f.content);
            const isOpen = expandedFactId === f.id;
            const gradeStyle = meta?.grade ? (GRADE_STYLE[meta.grade] ?? "") : "";
            const typeStyle = meta?.fact_type ? (TYPE_STYLE[meta.fact_type] ?? "") : "";
            const gates = meta?.gates ? meta.gates.split(",").map((g) => g.trim()).filter(Boolean) : [];

            return (
              <div
                key={f.id}
                onClick={() => {
                  if (!meta) return;
                  if (isOpen) {
                    setEditingFw(null);
                    setExpandedFactId(null);
                  } else {
                    setExpandedFactId(f.id);
                    const existing = fiveWhys.find((fw) => fw.fact_id === f.id);
                    setEditingFw(existing ?? { fact_id: f.id, fact_content: display, why1: "", why2: "", why3: "", why4: "", why5: "", principle: "" });
                  }
                }}
                className={`bg-white border border-[#e8e8ed] rounded-[10px] group ${meta ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-start gap-2 p-2.5 sticky top-0 z-10 bg-white rounded-t-[10px] border-b border-transparent" style={{ borderBottomColor: isOpen ? "#f5f5f7" : "transparent" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1d1d1f] leading-snug">{display}</p>
                    <p className="text-[10px] text-[#707070] mt-1.5 tabular-nums">{formatTimestamp(f.created_at)}</p>
                  </div>
                </div>

                {isOpen && (meta || editingFw?.fact_id === f.id) && (
                  <div
                    className="border-t border-[#f5f5f7] px-3 py-3 bg-[#f5f5f7]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={meta ? "grid grid-cols-[1fr_2fr] gap-x-3" : ""}>
                      {/* 배지 */}
                      {meta && (
                        <div className="flex flex-wrap items-center gap-1.5 pb-3">
                          {meta.grade && (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${gradeStyle}`}>
                              {meta.grade}등급
                            </span>
                          )}
                          {meta.fact_type && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded border flex-shrink-0 ${typeStyle}`}>
                              {meta.fact_type}{TYPE_DESC[meta.fact_type] ? ` — ${TYPE_DESC[meta.fact_type].split(":")[0]}` : ""}
                            </span>
                          )}
                          {meta.insight_grade && meta.insight_grade !== meta.grade && (
                            <span className="text-xs text-[#707070] px-1.5 py-0.5 rounded border border-[#e8e8ed] bg-white flex-shrink-0">
                              인사이트 {meta.insight_grade}
                            </span>
                          )}
                        </div>
                      )}

                      {meta && <div />}

                      {/* 분류근거 + Gate + 유형 */}
                      {meta && (
                        <div className="space-y-3">
                          {meta.classification_reason && (
                            <p className="text-xs text-[#474747] leading-relaxed bg-white rounded px-2 py-1.5 border border-[#e8e8ed]">
                              {meta.classification_reason}
                            </p>
                          )}
                          <div className="space-y-1.5">
                            {["Gate1", "Gate2", "Gate3"].map((g) => {
                              const passed = gates.some((p) => p.replace(/\s/g, "") === g.replace(/\s/g, ""));
                              return (
                                <div key={g} className="flex items-center gap-1.5">
                                  <span className={`text-xs font-bold flex-shrink-0 w-3 ${passed ? "text-emerald-600" : "text-[#d2d2d7]"}`}>
                                    {passed ? "✓" : "✗"}
                                  </span>
                                  <span className={`text-xs font-semibold mr-0.5 flex-shrink-0 ${passed ? "text-emerald-700" : "text-[#707070]"}`}>{g}</span>
                                  <span className={`text-xs ${passed ? "text-[#707070]" : "text-[#d2d2d7]"}`}>{GATE_DESC[g]}</span>
                                </div>
                              );
                            })}
                          </div>

                          <button
                            onClick={() => setPendingDelete({ type: "fact", id: f.id })}
                            className="text-xs text-[#d2d2d7] hover:text-rose-400 px-4 py-1 rounded-full border border-[#e8e8ed] hover:border-rose-200 bg-white transition-colors"
                          >삭제</button>
                        </div>
                      )}

                      {/* 5 Whys 컨테이너 */}
                      <div>
                        {editingFw?.fact_id === f.id ? (
                          <div className="bg-blue-50 border border-blue-200 rounded-[10px] px-3 py-3 space-y-2">
                            <p className="text-xs font-semibold text-blue-700 mb-1">5 Whys 역추론</p>
                            {(
                              [
                                { key: "why1" as const, label: "서비스 시각", desc: "이 서비스는 왜 이 선택을 하는가?" },
                                { key: "why2" as const, label: "산업 시각",   desc: "왜 기존 플레이어들은 이 선택을 하지 않았는가(못했는가)?" },
                                { key: "why3" as const, label: "사용자 시각", desc: "왜 사용자는 이 방식을 수용하거나 선택하는가?" },
                                { key: "why4" as const, label: "구조 시각",   desc: "이 선택이 가능한 선행 조건은 무엇인가?" },
                                { key: "why5" as const, label: "확장 시각",   desc: "이 구조는 지속 가능한가? 다른 도메인으로 이전 가능한가?" },
                              ]
                            ).map(({ key, label, desc }) => (
                              <div key={key}>
                                <label className="text-xs mb-0.5 block">
                                  <span className="font-medium text-[#1d1d1f]">{label}</span>
                                  <span className="text-[#707070]"> — {desc}</span>
                                </label>
                                <textarea
                                  value={editingFw[key] ?? ""}
                                  onChange={(e) => {
                                    setEditingFw({ ...editingFw, [key]: e.target.value });
                                    e.target.style.height = "auto";
                                    e.target.style.height = e.target.scrollHeight + "px";
                                  }}
                                  rows={2}
                                  placeholder={desc}
                                  className="w-full bg-white border border-[#e8e8ed] rounded-[10px] px-2 py-1.5 text-xs text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-[#0071e3] resize-none overflow-hidden transition-colors"
                                  style={{ height: "auto" }}
                                  ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                                />
                              </div>
                            ))}
                            <div>
                              <label className="text-xs mb-0.5 block">
                                <span className="font-semibold text-amber-600">보편 원리</span>
                                <span className="text-[#707070]"> — 5개 시각의 추론에서 도달한 본질적 원리</span>
                              </label>
                              <textarea
                                value={editingFw.principle ?? ""}
                                onChange={(e) => {
                                  setEditingFw({ ...editingFw, principle: e.target.value });
                                  e.target.style.height = "auto";
                                  e.target.style.height = e.target.scrollHeight + "px";
                                }}
                                rows={2}
                                placeholder="5개 시각에서 도달한 본질 원리를 정리하세요"
                                className="w-full bg-white border border-amber-200 rounded-[10px] px-2 py-1.5 text-xs text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-amber-400 resize-none overflow-hidden transition-colors"
                                style={{ height: "auto" }}
                                ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                              />
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => setEditingFw(null)}
                                className="flex-1 text-xs bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] py-1.5 rounded-full transition-colors"
                              >취소</button>
                              <button
                                onClick={saveFiveWhys}
                                className="flex-1 text-xs bg-[#0071e3] hover:bg-[#0077ed] text-white py-1.5 rounded-full font-medium transition-colors"
                              >저장</button>
                            </div>
                          </div>
                        ) : (() => {
                          const existing = fiveWhys.find((fw) => fw.fact_id === f.id);
                          if (!existing) return null;
                          return (
                            <div className="bg-blue-50 border border-blue-200 rounded-[10px] px-3 py-3 space-y-2">
                              <p className="text-xs font-semibold text-blue-700 mb-1">5 Whys 역추론</p>
                              {(
                                [
                                  { key: "why1" as const, label: "서비스 시각" },
                                  { key: "why2" as const, label: "산업 시각" },
                                  { key: "why3" as const, label: "사용자 시각" },
                                  { key: "why4" as const, label: "구조 시각" },
                                  { key: "why5" as const, label: "확장 시각" },
                                ]
                              ).map(({ key, label }) => existing[key] ? (
                                <div key={key}>
                                  <p className="text-xs text-[#707070] mb-0.5">{label}</p>
                                  <p className="text-xs text-[#1d1d1f] leading-relaxed">{existing[key]}</p>
                                </div>
                              ) : null)}
                              {existing.principle && (
                                <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-[10px]">
                                  <p className="text-xs font-semibold text-amber-600 mb-0.5">보편 원리</p>
                                  <p className="text-xs text-amber-800 leading-relaxed">{existing.principle}</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {facts.length === 0 && (
            <p className="text-xs text-[#707070] px-1">팩트가 없습니다. 레퍼런스를 분석하거나 직접 입력하세요.</p>
          )}
        </div>
      </section>


      {/* Principles */}
      {principles.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            추출된 혁신 원리 ({principles.length})
          </h3>
          <div className="space-y-2">
            {principles.map((fw) => (
              <div key={fw.id} className="p-3 bg-amber-50 border border-amber-200 rounded-[10px]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-amber-800">{fw.principle}</p>
                  <button onClick={() => setPendingDelete({ type: "fw", id: fw.id })} className="text-[#d2d2d7] hover:text-rose-500 text-xs flex-shrink-0">×</button>
                </div>
                {fw.fact_content && <p className="text-xs text-[#707070] mt-1.5">팩트: {fw.fact_content}</p>}
                <button
                  onClick={() => setEditingFw(fw)}
                  className="text-xs text-[#707070] hover:text-[#0066cc] mt-1 transition-colors"
                >5 Whys 보기</button>
              </div>
            ))}
          </div>
        </section>
      )}
      {pendingDelete && (
        <div
          className="fixed inset-0 bg-[#1d1d1f]/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="bg-white rounded-[28px] p-6 w-full max-w-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-[#1d1d1f] mb-1">삭제하시겠어요?</p>
            <p className="text-xs text-[#707070] mb-4">삭제된 항목은 복구할 수 없습니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="flex-1 text-sm bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] py-2 rounded-full transition-colors"
              >취소</button>
              <button
                onClick={confirmDelete}
                className="flex-1 text-sm bg-rose-500 hover:bg-rose-600 text-white py-2 rounded-full font-medium transition-colors"
              >삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
