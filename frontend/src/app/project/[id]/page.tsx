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

  const load = useCallback(async () => {
    try {
      const p = await api.projects.get(projectId) as Project;
      setProject(p);
      setActiveStage(p.current_stage);
      setNameInput(p.name);
    } finally {
      setLoading(false);
    }
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
      <div className="h-screen flex overflow-hidden">
        <nav className="w-14 bg-white border-r border-[#e8e8ed] flex-shrink-0 h-screen" />
        <div className="flex-1 flex items-center justify-center text-[#707070]">로딩 중...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#707070] mb-4">프로젝트를 찾을 수 없습니다</p>
          <button onClick={() => router.push("/")} className="text-[#0066cc] hover:underline text-sm">← 돌아가기</button>
        </div>
      </div>
    );
  }

  const StageComponent = STAGE_COMPONENTS[activeStage - 1];
  const stageInfo = STAGES.find((s) => s.id === activeStage)!;

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left nav */}
      <nav className="w-14 bg-white border-r border-[#e8e8ed] flex flex-col items-center justify-between py-5 h-screen flex-shrink-0">
        <div className="flex flex-col items-center gap-1">
          {STAGES.map((stage) => (
            <button
              key={stage.id}
              onClick={() => changeStage(stage.id)}
              title={stage.label}
              className={`p-2.5 rounded-[10px] transition-colors ${
                activeStage === stage.id
                  ? ICON_ACTIVE[stage.color]
                  : "text-[#707070] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]"
              }`}
            >
              {STAGE_ICONS[stage.id - 1]}
            </button>
          ))}
        </div>

        <button
          onClick={() => router.push("/")}
          title="목록으로"
          className="p-2.5 rounded-[10px] text-[#707070] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto [scrollbar-gutter:stable]">
        {/* Stage header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1d1d1f] tracking-tight">
              {activeStage}. {stageInfo.label}
            </h2>
            <p className="text-sm text-[#707070] mt-0.5">{stageInfo.desc}</p>
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
                className="bg-transparent text-base font-semibold text-[#1d1d1f] focus:outline-none border-b border-[#0071e3] pb-0.5 text-right"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-base font-semibold text-[#707070] hover:text-[#1d1d1f] truncate text-right transition-colors"
              >
                {project.name}
              </button>
            )}
            {project.domain && (
              <p className="text-xs text-[#707070]">{project.domain}</p>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 px-6 pb-6">
          {activeStage === 1 ? (
            <PurposeStage
              projectId={projectId}
              refreshKey={crawlerRefresh}
              key={`${projectId}-1`}
              crawlerSlot={
                <CrawlerPanel
                  projectId={projectId}
                  stage={activeStage}
                  onSaved={() => setCrawlerRefresh((n) => n + 1)}
                />
              }
            />
          ) : (
            <div className="grid grid-cols-[1fr_280px] gap-5 items-start">
              <div className="bg-white rounded-[28px] p-7 min-h-[500px]">
                <StageComponent projectId={projectId} key={`${projectId}-${activeStage}`} />
              </div>
              <div className="space-y-4">
                <CrawlerPanel
                  projectId={projectId}
                  stage={activeStage}
                  onSaved={() => setCrawlerRefresh((n) => n + 1)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
