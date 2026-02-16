import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "自然探索卡片",
  description: "帮助家长在徒步前备课的自然探索卡片生成器",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="font-['Noto_Sans_SC',sans-serif] bg-[#f0ebe3] min-h-screen">
        {children}
      </body>
    </html>
  );
}
