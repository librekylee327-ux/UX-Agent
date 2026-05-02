"use client";

import { STAGES } from "@/lib/types";

interface Props {
  currentStage: number;
  onStageClick: (stage: number) => void;
}

const STAGE_ICONS = [
  <svg key="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>,
  <svg key="2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>,
  <svg key="3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>,
  <svg key="4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>,
  <svg key="5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" /><path d="M10 22h4" />
  </svg>,
];

const ICON_COLOR: Record<string, string> = {
  blue:    "text-blue-600",
  purple:  "text-purple-600",
  emerald: "text-emerald-600",
  amber:   "text-amber-600",
  rose:    "text-rose-600",
};

export default function WorkflowPipeline({ currentStage, onStageClick }: Props) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-full px-1.5 py-1.5">
        {STAGES.map((stage) => {
          const isActive = stage.id === currentStage;
          return isActive ? (
            <div
              key={stage.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-sm ${ICON_COLOR[stage.color]}`}
            >
              {STAGE_ICONS[stage.id - 1]}
              <span className="text-sm font-medium text-slate-800 whitespace-nowrap">{stage.label}</span>
            </div>
          ) : (
            <button
              key={stage.id}
              onClick={() => onStageClick(stage.id)}
              title={stage.label}
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors flex-shrink-0"
            >
              {STAGE_ICONS[stage.id - 1]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
