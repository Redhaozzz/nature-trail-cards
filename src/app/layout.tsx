import type { Metadata } from "next";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

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
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
              document.documentElement.classList.add('dark');
            }
          } catch(e) {}
        `}} />
      </head>
      <body className="font-['Noto_Sans_SC',sans-serif] bg-[#f0ebe3] dark:bg-gray-900 min-h-screen transition-colors">
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
