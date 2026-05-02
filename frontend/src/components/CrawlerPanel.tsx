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
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">크롤러</h3>
            <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
          </div>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Stage {stage}</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-xs px-3 py-2 transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSearch} className="p-4 space-y-3">
        {tab !== "url" ? (
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={tab === "news" ? "키워드 입력 (예: 배달앱 트렌드)" : "검색어 입력"}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400"
          />
        ) : (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400"
          />
        )}
        <button
          type="submit"
          disabled={loading || (tab !== "url" ? !keyword.trim() : !url.trim())}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {loading ? "수집 중..." : "수집 시작"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-600">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-emerald-600">{results.length}개 저장됨 ✓</p>
        </div>
      )}
    </div>
  );
}
