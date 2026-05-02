"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Sequence } from "@/lib/types";

interface Props { projectId: string; }

const PHASES = [
  { id: "pre",    label: "전 (Pre)",    color: "text-blue-600",    border: "border-blue-200",    bg: "bg-blue-50" },
  { id: "during", label: "중 (During)", color: "text-emerald-600", border: "border-emerald-200", bg: "bg-emerald-50" },
  { id: "post",   label: "후 (Post)",   color: "text-amber-600",   border: "border-amber-200",   bg: "bg-amber-50" },
];

export default function PeopleStage({ projectId }: Props) {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [form, setForm] = useState({ persona: "", phase: "during", action_type: "physical", action: "", target: "" });

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    const data = await api.sequences.list(projectId) as Sequence[];
    setSequences(data);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.action.trim()) return;
    const maxOrder = sequences.filter((s) => s.phase === form.phase).length;
    await api.sequences.create(projectId, { ...form, order_index: maxOrder });
    setForm({ ...form, action: "", target: "" });
    load();
  }

  async function deleteSeq(id: string) {
    await api.sequences.delete(id);
    setSequences((p) => p.filter((s) => s.id !== id));
  }

  const byPhase = (phase: string) =>
    sequences.filter((s) => s.phase === phase).sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="space-y-6">
      {/* Guide */}
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-slate-600">
        <p className="font-semibold text-emerald-700 mb-1">행위 시퀀스 구성 원칙</p>
        <p>전/중/후 단위로 구성 · 물리적/사고적 행위 총괄 · 행동의 대상(Target)과 외부 요소 포함</p>
      </div>

      {/* Add Form */}
      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">행위 추가</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">페르소나</label>
            <input
              type="text"
              value={form.persona}
              onChange={(e) => setForm({ ...form, persona: e.target.value })}
              placeholder="예: 직장인 30대"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-400"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">단계</label>
            <select
              value={form.phase}
              onChange={(e) => setForm({ ...form, phase: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-400"
            >
              <option value="pre">전 (Pre)</option>
              <option value="during">중 (During)</option>
              <option value="post">후 (Post)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">행위 유형</label>
            <div className="flex gap-2">
              {(["physical", "cognitive"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, action_type: t })}
                  className={`flex-1 text-xs py-2 rounded-lg border transition-colors
                    ${form.action_type === t ? "bg-emerald-600 border-emerald-500 text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}
                >
                  {t === "physical" ? "물리적" : "사고적"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">대상 / 외부요소</label>
            <input
              type="text"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              placeholder="예: 앱, 배달기사, 결제수단"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">행위 *</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
              placeholder="구체적인 행위를 입력하세요"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              disabled={!form.action.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg"
            >추가</button>
          </div>
        </div>
      </form>

      {/* Sequence Timeline */}
      <div className="grid grid-cols-3 gap-4">
        {PHASES.map((phase) => {
          const items = byPhase(phase.id);
          return (
            <div key={phase.id} className={`${phase.bg} border ${phase.border} rounded-xl p-3`}>
              <h4 className={`text-xs font-semibold ${phase.color} mb-3`}>{phase.label}</h4>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">비어있음</p>
                ) : (
                  items.map((s, i) => (
                    <div key={s.id} className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs group">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="text-slate-400">{i + 1}</span>
                        <button onClick={() => deleteSeq(s.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                      </div>
                      <p className="text-slate-800 leading-snug">{s.action}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${s.action_type === "physical" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                          {s.action_type === "physical" ? "물리" : "사고"}
                        </span>
                        {s.target && <span className="text-slate-400">→ {s.target}</span>}
                        {s.persona && <span className="text-slate-400">{s.persona}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
