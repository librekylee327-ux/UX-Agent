import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UXER Kyle's Design Workflow Agent",
  description: "목적 탐지부터 솔루션 도출까지 — UX 기획 워크플로우 대시보드",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen text-[#1d1d1f] antialiased">
        {children}
      </body>
    </html>
  );
}
