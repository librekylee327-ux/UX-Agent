"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { CrawlResult } from "@/lib/types";

interface Props {
  projectId: string;
  stage: number;
  onSaved?: () => void;
}

type Tab = "news" | "url";

const STAGE_HINTS: Record<number, string> = {
  1: "버즈리포트 · 혁신 사례 · 트렌드",
  2: "도메인 분석 · 시장 조사 · 경쟁사",
  3: "사용자 행동 연구 · 사용성 조사",
  4: "사용자 피드백 · 인터뷰 자료",
  5: "UX 사례 · 디자인 패턴 · 레퍼런스",
};

const DOMAIN_PLACEHOLDERS: Record<number, string> = {
  1: "예: 모바일 앱, 한국 시장",
  2: "예: 핀테크, B2B SaaS",
  3: "예: 10대, 직장인, 노인",
  4: "예: 불만, 이탈, 온보딩",
  5: "예: 앱 디자인, 대시보드 UI",
};

export default function CrawlerPanel({ projectId, stage, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>("url");
  const [keyword, setKeyword] = useState("");
  const [domain, setDomain] = useState("");
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
        res = await api.crawl.news({ keyword, domain: domain.trim() || undefined, stage, project_id: projectId, save: true }) as typeof res;
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

  const TABS: { id: Tab; label: string }[] = [
    { id: "url", label: "URL 직접입력" },
    { id: "news", label: "뉴스" },
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
          <div className="space-y-2">
            <div>
              <label className="block text-[11px] text-[#707070] mb-1 font-medium">주제어 *</label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="예: 배달앱, 헬스케어 앱"
                className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-[#0071e3] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#707070] mb-1 font-medium">도메인 · 맥락 <span className="font-normal">(선택)</span></label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder={DOMAIN_PLACEHOLDERS[stage] ?? "예: 모바일 앱, 한국 시장"}
                className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-[10px] px-3 py-2 text-sm text-[#1d1d1f] placeholder-[#707070] focus:outline-none focus:border-[#0071e3] transition-colors"
              />
            </div>
          </div>
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
          disabled={loading || (tab === "news" ? !keyword.trim() : !url.trim())}
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
