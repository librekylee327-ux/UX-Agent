"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { CrawlResult } from "@/lib/types";

interface Props {
  projectId: string;
  stage: number;
  onSaved?: () => void;
}

const STAGE_HINTS: Record<number, string> = {
  1: "버즈리포트 · 혁신 사례 · 트렌드",
  2: "도메인 분석 · 시장 조사 · 경쟁사",
  3: "사용자 행동 연구 · 사용성 조사",
  4: "사용자 피드백 · 인터뷰 자료",
  5: "UX 사례 · 디자인 패턴 · 레퍼런스",
};

export default function CrawlerPanel({ projectId, stage, onSaved }: Props) {
  const [naturalQuery, setNaturalQuery] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CrawlResult[]>([]);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  const hint = STAGE_HINTS[stage] ?? "";
  const naturalDisabled = !!url.trim();
  const urlDisabled = !!naturalQuery.trim();
  const canSubmit = !loading && (!!naturalQuery.trim() || !!url.trim());

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setResults([]);
    setError("");
    setSaved(new Set());
    try {
      let res: { results: CrawlResult[]; count: number };
      if (naturalQuery.trim()) {
        res = await api.crawl.smart({ natural_query: naturalQuery.trim(), stage, project_id: projectId, save: true }) as typeof res;
      } else {
        const r = await api.crawl.url({ url, project_id: projectId, stage, save: true }) as CrawlResult;
        if (r.error) throw new Error(`스크래핑 실패: ${r.error}`);
        res = { results: [r], count: 1 };
      }
      setResults(res.results || []);
      const successCount = (res.results || []).filter((r: CrawlResult) => !r.error).length;
      if (successCount > 0) {
        setSaved(new Set(res.results.map((_: CrawlResult, i: number) => i)));
        onSaved?.();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "크롤링 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-[28px] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#1d1d1f]">크롤러</h3>
            <p className="text-xs text-[#707070] mt-0.5">{hint}</p>
          </div>
          <span className="text-xs text-[#707070] bg-[#f5f5f7] px-2 py-0.5 rounded-[10px]">Stage {stage}</span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSearch} className="px-5 pb-5 space-y-3">
        {/* 자연어 검색 */}
        <div className={`transition-opacity duration-150 ${naturalDisabled ? "opacity-30 pointer-events-none" : ""}`}>
          <label className="block text-[11px] text-[#707070] mb-1 font-medium">자연어 검색</label>
          <textarea
            value={naturalQuery}
            onChange={(e) => {
              setNaturalQuery(e.target.value);
              setResults([]);
              setError("");
            }}
            disabled={naturalDisabled}
            rows={3}
            placeholder="예: 최근 에이전틱 서비스를 사용하는 고객의 불편 혹은 VOC를 알고 싶어"
            className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-[#0071e3] transition-colors resize-none"
          />
        </div>

        {/* 구분 */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#e8e8ed]" />
          <span className="text-[11px] text-[#d2d2d7]">또는</span>
          <div className="flex-1 h-px bg-[#e8e8ed]" />
        </div>

        {/* URL 직접입력 */}
        <div className={`transition-opacity duration-150 ${urlDisabled ? "opacity-30 pointer-events-none" : ""}`}>
          <label className="block text-[11px] text-[#707070] mb-1 font-medium">URL 직접입력</label>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setResults([]);
              setError("");
            }}
            disabled={urlDisabled}
            placeholder="https://..."
            className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-[#0071e3] transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-40 text-white text-sm font-normal py-2 rounded-full transition-colors"
        >
          {loading ? "수집 중..." : "수집 시작"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mx-5 mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded-[10px] text-xs text-rose-600">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="px-5 pb-4 space-y-1">
          {results.map((r, i) => (
            <div key={i} className={`text-xs px-2.5 py-1.5 rounded-[10px] border ${r.error ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
              {r.error ? `실패: ${r.error}` : `저장됨 ✓ ${r.title || r.url}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
