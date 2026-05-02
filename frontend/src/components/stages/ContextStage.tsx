"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Framework, FrameworkDimension } from "@/lib/types";

interface Props { projectId: string; }

function genId() { return Math.random().toString(36).slice(2); }

export default function ContextStage({ projectId }: Props) {
  const [dimensions, setDimensions] = useState<FrameworkDimension[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    const fw = await api.framework.get(projectId) as Framework | null;
    if (fw) {
      try { setDimensions(JSON.parse(fw.structure)); } catch { setDimensions([]); }
      setNotes(fw.notes ?? "");
    }
  }

  async function save() {
    setSaving(true);
    await api.framework.upsert(projectId, { structure: JSON.stringify(dimensions), notes });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addDimension() {
    setDimensions([...dimensions, { id: genId(), name: "", sub_dimensions: [] }]);
  }

  function updateDimension(id: string, name: string) {
    setDimensions((d) => d.map((dim) => dim.id === id ? { ...dim, name } : dim));
  }

  function removeDimension(id: string) {
    setDimensions((d) => d.filter((dim) => dim.id !== id));
  }

  function addSubDimension(dimId: string) {
    setDimensions((d) => d.map((dim) =>
      dim.id === dimId ? { ...dim, sub_dimensions: [...dim.sub_dimensions, { id: genId(), name: "", elements: [] }] } : dim
    ));
  }

  function updateSubDimension(dimId: string, subId: string, name: string) {
    setDimensions((d) => d.map((dim) =>
      dim.id === dimId ? { ...dim, sub_dimensions: dim.sub_dimensions.map((s) => s.id === subId ? { ...s, name } : s) } : dim
    ));
  }

  function removeSubDimension(dimId: string, subId: string) {
    setDimensions((d) => d.map((dim) =>
      dim.id === dimId ? { ...dim, sub_dimensions: dim.sub_dimensions.filter((s) => s.id !== subId) } : dim
    ));
  }

  function addElement(dimId: string, subId: string) {
    setDimensions((d) => d.map((dim) =>
      dim.id === dimId ? { ...dim, sub_dimensions: dim.sub_dimensions.map((s) =>
        s.id === subId ? { ...s, elements: [...s.elements, ""] } : s
      )} : dim
    ));
  }

  function updateElement(dimId: string, subId: string, idx: number, val: string) {
    setDimensions((d) => d.map((dim) =>
      dim.id === dimId ? { ...dim, sub_dimensions: dim.sub_dimensions.map((s) =>
        s.id === subId ? { ...s, elements: s.elements.map((e, i) => i === idx ? val : e) } : s
      )} : dim
    ));
  }

  function removeElement(dimId: string, subId: string, idx: number) {
    setDimensions((d) => d.map((dim) =>
      dim.id === dimId ? { ...dim, sub_dimensions: dim.sub_dimensions.map((s) =>
        s.id === subId ? { ...s, elements: s.elements.filter((_, i) => i !== idx) } : s
      )} : dim
    ));
  }

  return (
    <div className="space-y-6">
      {/* MECE Guide */}
      <div className="p-3 bg-purple-50 border border-purple-200 rounded-[10px]">
        <p className="text-xs font-semibold text-purple-700 mb-1.5">MECE 원칙</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-[#474747]">
          <div><span className="text-purple-600 font-medium">ME</span> — 각 차원은 상호배타적</div>
          <div><span className="text-purple-600 font-medium">CE</span> — 합으로 도메인 완전 대변</div>
          <div><span className="text-purple-600 font-medium">Granularity</span> — 항목 크기 동등</div>
          <div><span className="text-purple-600 font-medium">Pertinent</span> — 목적에서 이탈 금지</div>
        </div>
      </div>

      {/* Framework Builder */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#1d1d1f]">도메인 프레임워크</h3>
          <div className="flex gap-2">
            <button
              onClick={addDimension}
              className="text-xs text-purple-600 hover:text-purple-700 border border-purple-200 px-3 py-1.5 rounded-full transition-colors"
            >+ 차원 추가</button>
            <button
              onClick={save}
              disabled={saving}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors font-medium
                ${saved ? "bg-emerald-600 text-white" : "bg-purple-600 hover:bg-purple-500 text-white"}`}
            >
              {saved ? "저장됨 ✓" : saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>

        {dimensions.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-[#e8e8ed] rounded-[10px]">
            <p className="text-sm text-[#707070]">차원을 추가해 도메인 프레임워크를 설계하세요</p>
            <p className="text-xs text-[#d2d2d7] mt-1">예: 경험 → 인지 → 행동 → 맥락</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dimensions.map((dim, di) => (
              <div key={dim.id} className="bg-white border border-[#e8e8ed] rounded-[10px] overflow-hidden">
                <div className="flex items-center gap-2 p-3 bg-purple-50 border-b border-[#e8e8ed]">
                  <span className="text-xs text-purple-600 font-bold">D{di + 1}</span>
                  <input
                    type="text"
                    value={dim.name}
                    onChange={(e) => updateDimension(dim.id, e.target.value)}
                    placeholder="차원 이름 (예: 인지적 요소)"
                    className="flex-1 bg-transparent text-sm font-medium text-[#1d1d1f] placeholder-[#d2d2d7] focus:outline-none"
                  />
                  <button onClick={() => addSubDimension(dim.id)} className="text-xs text-[#707070] hover:text-purple-600">+ 세부</button>
                  <button onClick={() => removeDimension(dim.id)} className="text-[#d2d2d7] hover:text-rose-500 text-sm">×</button>
                </div>

                <div className="p-3 space-y-3">
                  {dim.sub_dimensions.map((sub) => (
                    <div key={sub.id} className="pl-3 border-l-2 border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={sub.name}
                          onChange={(e) => updateSubDimension(dim.id, sub.id, e.target.value)}
                          placeholder="세부 차원 이름"
                          className="flex-1 bg-transparent text-xs font-medium text-[#474747] placeholder-[#d2d2d7] focus:outline-none"
                        />
                        <button onClick={() => addElement(dim.id, sub.id)} className="text-xs text-[#707070] hover:text-purple-600">+ 요소</button>
                        <button onClick={() => removeSubDimension(dim.id, sub.id)} className="text-[#d2d2d7] hover:text-rose-500 text-xs">×</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sub.elements.map((el, ei) => (
                          <div key={ei} className="flex items-center gap-1 bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-2 py-1">
                            <input
                              type="text"
                              value={el}
                              onChange={(e) => updateElement(dim.id, sub.id, ei, e.target.value)}
                              placeholder="요소"
                              className="bg-transparent text-xs text-[#474747] placeholder-[#d2d2d7] focus:outline-none w-20"
                            />
                            <button onClick={() => removeElement(dim.id, sub.id, ei)} className="text-[#d2d2d7] hover:text-rose-500 text-xs">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {dim.sub_dimensions.length === 0 && (
                    <p className="text-xs text-[#d2d2d7] pl-2">세부 차원을 추가하세요</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Notes */}
      <section>
        <h3 className="text-sm font-semibold text-[#1d1d1f] mb-2">프레임워크 설계 메모</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={save}
          rows={3}
          placeholder="프레임워크 설계 근거, 목적, 인사이트를 기록하세요"
          className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2.5 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-purple-400 resize-none transition-colors"
        />
      </section>
    </div>
  );
}
