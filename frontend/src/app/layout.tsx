import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UX 기획 플래너",
  description: "목적 탐지부터 솔루션 도출까지 — UX 기획 워크플로우 대시보드",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-[#F7F8FA] text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
