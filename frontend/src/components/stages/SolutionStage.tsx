"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Concept } from "@/lib/types";

interface Props { projectId: string; }
interface FlowStep { step: string; description: string; }

export default function SolutionStage({ projectId }: Props) {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selected, setSelected] = useState<Concept | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    const data = await api.concepts.list(projectId) as Concept[];
    setConcepts(data);
    if (data.length && !selected) setSelected(data[0]);
  }

  async function createConcept(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    const c = await api.concepts.create(projectId, { title: newTitle.trim() }) as Concept;
    setConcepts((p) => [c, ...p]);
    setSelected(c);
    setNewTitle("");
    setCreating(false);
  }

  async function updateConcept(updates: Partial<Concept>) {
    if (!selected) return;
    const updated = await api.concepts.update(selected.id, { ...selected, ...updates }) as Concept;
    setSelected(updated);
    setConcepts((p) => p.map((c) => c.id === updated.id ? updated : c));
  }

  async function deleteConcept(id: string) {
    if (!confirm("컨셉을 삭제하시겠습니까?")) return;
    await api.concepts.delete(id);
    setConcepts((p) => p.filter((c) => c.id !== id));
    setSelected(concepts.find((c) => c.id !== id) ?? null);
  }

  function parseFlow(flow: string): FlowStep[] {
    try { return JSON.parse(flow) ?? []; } catch { return []; }
  }

  function updateFlow(steps: FlowStep[]) {
    updateConcept({ flow: JSON.stringify(steps) });
  }

  function addStep(steps: FlowStep[]) {
    updateFlow([...steps, { step: `Step ${steps.length + 1}`, description: "" }]);
  }

  function updateStep(steps: FlowStep[], idx: number, field: keyof FlowStep, val: string) {
    const next = steps.map((s, i) => i === idx ? { ...s, [field]: val } : s);
    updateFlow(next);
  }

  function removeStep(steps: FlowStep[], idx: number) {
    updateFlow(steps.filter((_, i) => i !== idx));
  }

  const flowSteps = selected ? parseFlow(selected.flow) : [];

  return (
    <div className="space-y-5">
      {/* Guide */}
      <div className="p-3 bg-rose-50 border border-rose-200 rounded-[10px] text-xs text-[#474747]">
        <p className="font-semibold text-rose-700 mb-1">솔루션 도출</p>
        <p>컨셉 구상 → 유저 플로우 → 인터페이스 터치포인트 → 리텐션 & 가치 설계 → 딜리버리</p>
      </div>

      <div className="flex gap-4">
        {/* Concept List */}
        <div className="w-48 flex-shrink-0 space-y-2">
          <form onSubmit={createConcept} className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="컨셉 이름"
              className="flex-1 bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-2 py-1.5 text-xs text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-rose-400 min-w-0 transition-colors"
            />
            <button
              type="submit"
              disabled={creating || !newTitle.trim()}
              className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs px-2.5 py-1.5 rounded-full transition-colors"
            >+</button>
          </form>

          <div className="space-y-1">
            {concepts.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                className={`group flex items-center justify-between gap-1 px-3 py-2 rounded-[10px] cursor-pointer text-xs transition-colors
                  ${selected?.id === c.id ? "bg-rose-50 border border-rose-200 text-rose-700" : "text-[#707070] hover:bg-[#f5f5f7] border border-transparent"}`}
              >
                <span className="truncate">{c.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConcept(c.id); }}
                  className="text-[#d2d2d7] hover:text-rose-500 opacity-0 group-hover:opacity-100 flex-shrink-0"
                >×</button>
              </div>
            ))}
          </div>

          {concepts.length === 0 && (
            <p className="text-xs text-[#707070] text-center py-4">컨셉을 추가하세요</p>
          )}
        </div>

        {/* Concept Detail */}
        {selected ? (
          <div className="flex-1 space-y-4 min-w-0">
            <input
              type="text"
              value={selected.title}
              onChange={(e) => updateConcept({ title: e.target.value })}
              className="w-full bg-transparent text-base font-semibold text-[#1d1d1f] focus:outline-none border-b border-[#e8e8ed] pb-2 focus:border-rose-400 transition-colors"
            />

            <div>
              <label className="text-xs text-[#707070] mb-1.5 block">컨셉 설명</label>
              <textarea
                value={selected.description}
                onChange={(e) => updateConcept({ description: e.target.value })}
                rows={3}
                placeholder="이 컨셉이 해결하는 문제와 핵심 아이디어를 설명하세요"
                className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2.5 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-rose-400 resize-none transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-[#707070]">유저 플로우</label>
                <button
                  onClick={() => addStep(flowSteps)}
                  className="text-xs text-rose-600 hover:text-rose-700 border border-rose-200 px-2 py-1 rounded-full transition-colors"
                >+ 스텝</button>
              </div>
              <div className="space-y-2">
                {flowSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-rose-100 border border-rose-200 text-rose-600 text-xs flex items-center justify-center font-bold mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        value={step.step}
                        onChange={(e) => updateStep(flowSteps, i, "step", e.target.value)}
                        placeholder="스텝 이름"
                        className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-1.5 text-xs text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-rose-400 transition-colors"
                      />
                      <input
                        type="text"
                        value={step.description}
                        onChange={(e) => updateStep(flowSteps, i, "description", e.target.value)}
                        placeholder="상세 설명"
                        className="w-full bg-[#f5f5f7] border border-[#f5f5f7] rounded-[10px] px-3 py-1.5 text-xs text-[#707070] placeholder-[#d2d2d7] focus:outline-none focus:border-rose-400 transition-colors"
                      />
                    </div>
                    <button
                      onClick={() => removeStep(flowSteps, i)}
                      className="text-[#d2d2d7] hover:text-rose-500 text-sm mt-1"
                    >×</button>
                  </div>
                ))}
                {flowSteps.length === 0 && (
                  <p className="text-xs text-[#707070] py-3 text-center border-2 border-dashed border-[#e8e8ed] rounded-[10px]">플로우 스텝을 추가하세요</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#707070] mb-1.5 block">인터페이스 터치포인트</label>
                <textarea
                  value={selected.interface_notes}
                  onChange={(e) => updateConcept({ interface_notes: e.target.value })}
                  rows={4}
                  placeholder="어떤 화면, 어떤 인터랙션으로 경험을 만드는가"
                  className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2.5 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-rose-400 resize-none transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-[#707070] mb-1.5 block">리텐션 & 가치 설계</label>
                <textarea
                  value={selected.retention_notes}
                  onChange={(e) => updateConcept({ retention_notes: e.target.value })}
                  rows={4}
                  placeholder="어디서 효능감과 가치를 제공하고 재방문을 유도하는가"
                  className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2.5 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-rose-400 resize-none transition-colors"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#707070] text-sm">
            컨셉을 선택하거나 새로 만드세요
          </div>
        )}
      </div>
    </div>
  );
}
