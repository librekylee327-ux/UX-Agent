"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";
import { STAGES } from "@/lib/types";
import CrawlerPanel from "@/components/CrawlerPanel";
import PurposeStage from "@/components/stages/PurposeStage";
import ContextStage from "@/components/stages/ContextStage";
import PeopleStage from "@/components/stages/PeopleStage";
import AbstractStage from "@/components/stages/AbstractStage";
import SolutionStage from "@/components/stages/SolutionStage";

const STAGE_COMPONENTS = [PurposeStage, ContextStage, PeopleStage, AbstractStage, SolutionStage];


const STAGE_ICONS = [
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>,
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>,
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>,
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>,
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" /><path d="M10 22h4" />
  </svg>,
];

const ICON_ACTIVE: Record<string, string> = {
  blue:    "text-blue-600 bg-blue-50",
  purple:  "text-purple-600 bg-purple-50",
  emerald: "text-emerald-600 bg-emerald-50",
  amber:   "text-amber-600 bg-amber-50",
  rose:    "text-rose-600 bg-rose-50",
};

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [activeStage, setActiveStage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [crawlerRefresh, setCrawlerRefresh] = useState(0);
  const [openGuides, setOpenGuides] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const p = await api.projects.get(projectId) as Project;
    setProject(p);
    setActiveStage(p.current_stage);
    setNameInput(p.name);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function changeStage(stage: number) {
    setActiveStage(stage);
    await api.projects.update(projectId, { current_stage: stage });
    setProject((p) => p ? { ...p, current_stage: stage } : p);
  }

  async function saveName() {
    if (!nameInput.trim()) return;
    await api.projects.update(projectId, { name: nameInput.trim() });
    setProject((p) => p ? { ...p, name: nameInput.trim() } : p);
    setEditingName(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center text-slate-400">
        로딩 중...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">프로젝트를 찾을 수 없습니다</p>
          <button onClick={() => router.push("/")} className="text-blue-500 hover:underline text-sm">← 돌아가기</button>
        </div>
      </div>
    );
  }

  const StageComponent = STAGE_COMPONENTS[activeStage - 1];
  const stageInfo = STAGES.find((s) => s.id === activeStage)!;

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex">
      {/* Left nav */}
      <nav className="w-14 bg-white border-r border-slate-200 flex flex-col items-center justify-between py-5 sticky top-0 h-screen flex-shrink-0">
        {/* Stage icons */}
        <div className="flex flex-col items-center gap-1">
          {STAGES.map((stage) => (
            <button
              key={stage.id}
              onClick={() => changeStage(stage.id)}
              title={stage.label}
              className={`p-2.5 rounded-xl transition-colors ${
                activeStage === stage.id
                  ? ICON_ACTIVE[stage.color]
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              }`}
            >
              {STAGE_ICONS[stage.id - 1]}
            </button>
          ))}
        </div>

        {/* Exit icon */}
        <button
          onClick={() => router.push("/")}
          title="목록으로"
          className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Stage header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {activeStage}. {stageInfo.label}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{stageInfo.desc}</p>
          </div>
          <div className="flex flex-col items-end gap-1 min-w-0">
            {editingName ? (
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                autoFocus
                className="bg-transparent text-base font-semibold text-slate-900 focus:outline-none border-b border-blue-400 pb-0.5 text-right"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-base font-semibold text-slate-400 hover:text-slate-600 truncate text-right"
              >
                {project.name}
              </button>
            )}
            {project.domain && (
              <p className="text-xs text-slate-400">{project.domain}</p>
            )}
          </div>
        </div>

        {/* Main grid */}
        <div className="flex-1 px-6 pb-6 grid grid-cols-[1fr_280px] gap-5 items-start">
          {/* Stage workspace */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 min-h-[500px]">
            {activeStage === 1 ? (
              <PurposeStage projectId={projectId} refreshKey={crawlerRefresh} key={`${projectId}-1`} />
            ) : (
              <StageComponent projectId={projectId} key={`${projectId}-${activeStage}`} />
            )}
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            <CrawlerPanel
              projectId={projectId}
              stage={activeStage}
              onSaved={() => setCrawlerRefresh((n) => n + 1)}
            />

            {/* 팩트 분류 기준 — Stage 1 전용 */}
            {activeStage === 1 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 pt-4 pb-3">팩트 분류 기준</p>

                {/* 인사이트 등급 */}
                {(() => {
                  const key = "grade";
                  const open = openGuides.has(key);
                  return (
                    <div className="border-t border-slate-100">
                      <button
                        onClick={() => setOpenGuides((prev) => { const n = new Set(prev); open ? n.delete(key) : n.add(key); return n; })}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <span className="font-medium">인사이트 등급</span>
                        <span className="text-slate-300 text-[10px]">{open ? "▲" : "▼"}</span>
                      </button>
                      {open && (
                        <div className="px-4 pb-3 space-y-1.5">
                          {[
                            { grade: "S", color: "text-amber-700 bg-amber-50 border-amber-200", desc: "5개 Why 레이어 모두 도출" },
                            { grade: "A", color: "text-blue-700 bg-blue-50 border-blue-200", desc: "3개 이상 레이어 도출" },
                            { grade: "B", color: "text-slate-600 bg-slate-100 border-slate-200", desc: "추가 맥락이 필요한 후보" },
                            { grade: "C", color: "text-slate-400 bg-slate-50 border-slate-200", desc: "맥락은 있으나 구조 추론 어려움" },
                          ].map(({ grade, color, desc }) => (
                            <div key={grade} className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded border flex-shrink-0 w-6 text-center ${color}`}>{grade}</span>
                              <p className="text-xs text-slate-500">{desc}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 팩트 유형 */}
                {(() => {
                  const key = "type";
                  const open = openGuides.has(key);
                  return (
                    <div className="border-t border-slate-100">
                      <button
                        onClick={() => setOpenGuides((prev) => { const n = new Set(prev); open ? n.delete(key) : n.add(key); return n; })}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <span className="font-medium">팩트 유형</span>
                        <span className="text-slate-300 text-[10px]">{open ? "▲" : "▼"}</span>
                      </button>
                      {open && (
                        <div className="px-4 pb-3 space-y-2">
                          {[
                            { type: "A", label: "행동 비관행", color: "text-purple-700 bg-purple-50 border-purple-200", desc: "일반 패턴에서 벗어난 서비스/사용자 행동" },
                            { type: "B", label: "구조 변화", color: "text-emerald-700 bg-emerald-50 border-emerald-200", desc: "시장·산업·서비스 구조 변화 신호" },
                            { type: "C", label: "사용자 이상치", color: "text-sky-700 bg-sky-50 border-sky-200", desc: "예상치 못한 사용자 반응·행동 패턴" },
                            { type: "D", label: "수익/비용 이상", color: "text-rose-700 bg-rose-50 border-rose-200", desc: "비관행적 수익화·비용 구조 패턴" },
                          ].map(({ type, label, color, desc }) => (
                            <div key={type} className="flex items-start gap-2">
                              <div className="flex-shrink-0 text-center">
                                <span className={`text-xs font-bold px-1 py-0.5 rounded border block leading-tight ${color}`}>TYPE {type}</span>
                                <span className={`text-xs mt-0.5 block ${color} opacity-80`}>{label}</span>
                              </div>
                              <p className="text-xs text-slate-500 leading-snug mt-0.5">{desc}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 3-Gate */}
                {(() => {
                  const key = "gate";
                  const open = openGuides.has(key);
                  return (
                    <div className="border-t border-slate-100">
                      <button
                        onClick={() => setOpenGuides((prev) => { const n = new Set(prev); open ? n.delete(key) : n.add(key); return n; })}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <span className="font-medium">3-Gate 판정</span>
                        <span className="text-slate-300 text-[10px]">{open ? "▲" : "▼"}</span>
                      </button>
                      {open && (
                        <div className="px-4 pb-3 space-y-1.5">
                          {[
                            { gate: "Gate 1", desc: "도메인 맥락 가치" },
                            { gate: "Gate 2", desc: "차별성" },
                            { gate: "Gate 3", desc: "구조적 인과성" },
                          ].map(({ gate, desc }) => (
                            <div key={gate} className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 flex-shrink-0 w-14">{gate}</span>
                              <p className="text-xs text-slate-500">{desc}</p>
                            </div>
                          ))}
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            1+2+3 → <span className="text-amber-600">S/A</span> &nbsp;
                            2+3 → <span className="text-slate-500">B</span> &nbsp;
                            1 → <span className="text-slate-400">C</span> &nbsp;
                            미통과 → 노이즈
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
