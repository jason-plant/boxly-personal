"use client";

import React, { useEffect, useState } from "react";
import { applyTheme, getStoredPalette, getStoredTheme, PaletteKey, PALETTES } from "../lib/theme";

export default function ThemeToggle({ small = false }: { small?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [palette, setPalette] = useState<PaletteKey>(getStoredPalette());

  useEffect(() => {
    try {
      const t = getStoredTheme();
      setTheme(t);
      setPalette(getStoredPalette());
      // apply on mount
      applyTheme(t, getStoredPalette());
    } catch (e) {
      /* ignore */
    }
  }, []);

  function toggleTheme() {
    const n = theme === "light" ? "dark" : "light";
    setTheme(n);
    applyTheme(n, palette);
  }

  // small: render as a compact button (for menus)
  if (small) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        style={{
          width: 44,
          height: 36,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--text)",
          fontWeight: 900,
        }}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? "🌙" : "☀️"}
      </button>
    );
  }

  // Only show the theme toggle button (no palette buttons)
  return (
    <button onClick={toggleTheme} className="tap-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {theme === "dark" ? "Switch to light" : "Switch to dark"}
    </button>
  );
}
