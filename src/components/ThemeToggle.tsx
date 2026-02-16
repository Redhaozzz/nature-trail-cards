"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    // Dispatch event so maps can switch tiles
    window.dispatchEvent(new CustomEvent("themechange", { detail: { dark: next } }));
  };

  if (!mounted) return null; // Avoid hydration mismatch

  return (
    <button
      onClick={toggle}
      className="fixed top-3 right-3 z-50 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-lg transition-colors hover:scale-110 active:scale-95"
      aria-label="切换夜间模式"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
