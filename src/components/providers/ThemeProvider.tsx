"use client";

import { useEffect } from "react";

const DEFAULT_ACCENT = "#6C63FF";

export function ThemeProvider() {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", DEFAULT_ACCENT);

    fetch("/api/cosmetics")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const accent = data?.equipped?.themeAccent;
        if (typeof accent === "string" && /^#[0-9A-Fa-f]{6}$/.test(accent)) {
          root.style.setProperty("--accent", accent);
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
