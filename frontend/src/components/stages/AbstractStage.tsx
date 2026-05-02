"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Insight, Reference } from "@/lib/types";

interface Props { projectId: string; }

const TYPE_CONFIG = {
  hypothesis: { label: "가설",     color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200",  badge: "bg-amber-100 text-amber-700" },
  raw_data:   { label: "Raw Data", color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",   badge: "bg-blue-100 text-blue-700" },
  interview:  { label: "인터뷰",   color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", badge: "bg-purple-100 text-purple-700" },
};

export default function AbstractStage({ projectId }: Props) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [refs, setRefs] = useState<Reference[]>([]);
  const [form, setForm] = useState({ type: "hypothesis", content: "", cluster_tag: "", source: "" });
  const [filterType, setFilterType] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    const [ins, r] = await Promise.all([
      api.insights.list(projectId) as Promise<Insight[]>,
      api.references.list(projectId, 4) as Promise<Reference[]>,
    ]);
    setInsights(ins);
    setRefs(r);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.content.trim()) return;
    await api.insights.create(projectId, form);
    setForm({ ...form, content: "", source: "" });
    load();
  }

  async function updateTag(id: string, tag: string) {
    await api.insights.update(id, { cluster_tag: tag });
    setInsights((p) => p.map((i) => i.id === id ? { ...i, cluster_tag: tag } : i));
  }

  async function deleteInsight(id: string) {
    await api.insights.delete(id);
    setInsights((p) => p.filter((i) => i.id !== id));
  }

  const allTags = Array.from(new Set(insights.map((i) => i.cluster_tag).filter(Boolean)));
  const filtered = insights.filter((i) => {
    const byType = filterType === "all" || i.type === filterType;
    const byTag = filterTag === "all" || i.cluster_tag === filterTag;
    return byType && byTag;
  });

  const clustered = allTags.reduce<Record<string, Insight[]>>((acc, tag) => {
    acc[tag] = filtered.filter((i) => i.cluster_tag === tag);
    return acc;
  }, {});
  const untagged = filtered.filter((i) => !i.cluster_tag);

  return (
    <div className="space-y-6">
      {/* Guide */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-[10px] text-xs text-[#474747]">
        <p className="font-semibold text-amber-700 mb-1">추상 세계 진입</p>
        <p>가설 수립 → Raw data/인터뷰 수집 → 클러스터 태깅 → 본질 추론 → 컨셉 구상</p>
      </div>

      {/* Add Form */}
      <form onSubmit={submit} className="bg-white border border-[#e8e8ed] rounded-[10px] p-4 space-y-3">
        <div className="flex gap-2">
          {(Object.entries(TYPE_CONFIG) as [string, typeof TYPE_CONFIG[keyof typeof TYPE_CONFIG]][]).map(([type, cfg]) => (
            <button
              key={type}
              type="button"
              onClick={() => setForm({ ...form, type })}
              className={`flex-1 text-xs py-2 rounded-full border transition-colors
                ${form.type === type ? `${cfg.bg} ${cfg.border} ${cfg.color} font-medium` : "bg-[#f5f5f7] border-[#e8e8ed] text-[#707070] hover:border-[#d2d2d7]"}`}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder={
            form.type === "hypothesis" ? "HMW (How Might We)... / 가설: ~할 것이다" :
            form.type === "raw_data" ? "관찰된 행동, 발화, 반응을 그대로 기록" :
            "인터뷰이: / 발화: / 맥락:"
          }
          rows={3}
          className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2.5 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-amber-400 resize-none transition-colors"
        />

        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={form.cluster_tag}
            onChange={(e) => setForm({ ...form, cluster_tag: e.target.value })}
            placeholder="클러스터 태그 (예: 결제불편)"
            className="bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-amber-400 transition-colors"
          />
          <input
            type="text"
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder="출처 (선택)"
            className="bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={!form.content.trim()}
          className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-full transition-colors"
        >추가</button>
      </form>

      {/* Filter bar */}
      {insights.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-white border border-[#e8e8ed] rounded-[10px] px-3 py-1.5 text-xs text-[#474747] focus:outline-none transition-colors"
          >
            <option value="all">전체 유형</option>
            {Object.entries(TYPE_CONFIG).map(([t, c]) => <option key={t} value={t}>{c.label}</option>)}
          </select>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="bg-white border border-[#e8e8ed] rounded-[10px] px-3 py-1.5 text-xs text-[#474747] focus:outline-none transition-colors"
          >
            <option value="all">전체 클러스터</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-xs text-[#707070] self-center">{filtered.length}개</span>
        </div>
      )}

      {/* Clustered View */}
      <div className="space-y-4">
        {allTags.map((tag) => {
          const items = clustered[tag] ?? [];
          if (!items.length) return null;
          return (
            <div key={tag} className="bg-white border border-[#e8e8ed] rounded-[10px] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#f5f5f7] border-b border-[#e8e8ed] flex items-center gap-2">
                <span className="text-xs font-semibold text-[#474747]"># {tag}</span>
                <span className="text-xs text-[#707070]">{items.length}개</span>
              </div>
              <div className="p-3 space-y-2">
                {items.map((ins) => <InsightCard key={ins.id} insight={ins} onDelete={deleteInsight} onTagChange={updateTag} />)}
              </div>
            </div>
          );
        })}
        {untagged.length > 0 && (
          <div>
            <p className="text-xs text-[#707070] mb-2">태그 없음</p>
            <div className="space-y-2">
              {untagged.map((ins) => <InsightCard key={ins.id} insight={ins} onDelete={deleteInsight} onTagChange={updateTag} />)}
            </div>
          </div>
        )}
        {insights.length === 0 && (
          <p className="text-xs text-[#707070] text-center py-6">아직 인사이트가 없습니다. 가설이나 Raw data를 추가하세요.</p>
        )}
      </div>

      {/* Collected refs */}
      <section>
        <h3 className="text-sm font-semibold text-[#1d1d1f] mb-2">수집된 리서치 자료 {refs.length > 0 && `(${refs.length})`}</h3>
        <div className="min-h-[160px] max-h-40 overflow-y-auto space-y-2">
          {refs.length > 0 ? refs.map((r) => (
            <div key={r.id} className="p-2.5 bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] text-xs">
              <p className="text-[#474747] font-medium">{r.title}</p>
              {r.content && <p className="text-[#707070] mt-1 line-clamp-2">{r.content}</p>}
            </div>
          )) : (
            <div className="flex items-center justify-center h-full min-h-[160px]">
              <p className="text-xs text-[#707070]">레퍼런스를 수집하면 여기에 표시됩니다.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function InsightCard({ insight, onDelete, onTagChange }: { insight: Insight; onDelete: (id: string) => void; onTagChange: (id: string, tag: string) => void }) {
  const cfg = TYPE_CONFIG[insight.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.raw_data;
  const [editTag, setEditTag] = useState(false);
  const [tag, setTag] = useState(insight.cluster_tag);

  return (
    <div className={`p-3 ${cfg.bg} border ${cfg.border} rounded-[10px] group`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.badge} font-medium`}>{cfg.label}</span>
        <button onClick={() => onDelete(insight.id)} className="text-[#d2d2d7] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs">×</button>
      </div>
      <p className="text-sm text-[#1d1d1f] leading-relaxed">{insight.content}</p>
      <div className="mt-2 flex items-center gap-2">
        {editTag ? (
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onBlur={() => { onTagChange(insight.id, tag); setEditTag(false); }}
            onKeyDown={(e) => e.key === "Enter" && (onTagChange(insight.id, tag), setEditTag(false))}
            autoFocus
            className="text-xs bg-white border border-[#e8e8ed] rounded px-2 py-0.5 text-[#474747] focus:outline-none w-32"
          />
        ) : (
          <button onClick={() => setEditTag(true)} className="text-xs text-[#707070] hover:text-amber-600 transition-colors">
            {insight.cluster_tag ? `# ${insight.cluster_tag}` : "+ 태그"}
          </button>
        )}
        {insight.source && <span className="text-xs text-[#707070]">· {insight.source}</span>}
      </div>
    </div>
  );
}
