"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { CrawlResult } from "@/lib/types";

interface Props {
  projectId: string;
  stage: number;
  onSaved?: () => void;
}

type Tab = "news" | "search" | "url";

const STAGE_HINTS: Record<number, string> = {
  1: "버즈리포트 · 혁신 사례 · 트렌드",
  2: "도메인 분석 · 시장 조사 · 경쟁사",
  3: "사용자 행동 연구 · 사용성 조사",
  4: "사용자 피드백 · 인터뷰 자료",
  5: "UX 사례 · 디자인 패턴 · 레퍼런스",
};

export default function CrawlerPanel({ projectId, stage, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>("news");
  const [keyword, setKeyword] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CrawlResult[]>([]);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  const hint = STAGE_HINTS[stage] ?? "";

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResults([]);
    setError("");
    setSaved(new Set());
    try {
      let res: { results: CrawlResult[]; count: number };
      if (tab === "news") {
        res = await api.crawl.news({ keyword, stage, project_id: projectId, save: true }) as typeof res;
      } else if (tab === "search") {
        res = await api.crawl.search({ keyword, stage, project_id: projectId, save: true }) as typeof res;
      } else {
        const r = await api.crawl.url({ url, project_id: projectId, stage, save: true }) as CrawlResult;
        res = { results: [r], count: 1 };
      }
      setResults(res.results || []);
      if (res.results?.length) {
        setSaved(new Set(res.results.map((_: CrawlResult, i: number) => i)));
        onSaved?.();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "크롤링 실패");
    } finally {
      setLoading(false);
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "news", label: "뉴스" },
    { id: "search", label: "웹 검색" },
    { id: "url", label: "URL 직접" },
  ];

  return (
    <div className="bg-white rounded-[28px] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#1d1d1f]">크롤러</h3>
            <p className="text-xs text-[#707070] mt-0.5">{hint}</p>
          </div>
          <span className="text-xs text-[#707070] bg-[#f5f5f7] px-2 py-0.5 rounded-[10px]">Stage {stage}</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#e8e8ed]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-xs px-3 py-2 transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? "border-[#0071e3] text-[#0071e3]"
                  : "border-transparent text-[#707070] hover:text-[#1d1d1f]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSearch} className="p-5 space-y-3">
        {tab !== "url" ? (
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={tab === "news" ? "키워드 입력 (예: 배달앱 트렌드)" : "검색어 입력"}
            className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-[#0071e3] transition-colors"
          />
        ) : (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-[#0071e3] transition-colors"
          />
        )}
        <button
          type="submit"
          disabled={loading || (tab !== "url" ? !keyword.trim() : !url.trim())}
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
        <div className="px-5 pb-4">
          <p className="text-xs text-emerald-600">{results.length}개 저장됨 ✓</p>
        </div>
      )}
    </div>
  );
}
