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

  const order: PaletteKey[] = ["ivory", "stone", "warm", "charcoal"];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button onClick={toggleTheme} className="tap-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        {theme === "dark" ? "Switch to light" : "Switch to dark"}
      </button>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {order.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setPalette(k);
              applyTheme(theme, k);
            }}
            aria-pressed={palette === k}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: 8,
              borderRadius: 10,
              border: palette === k ? "2px solid var(--accent)" : "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            <div style={{ width: 44, height: 22, borderRadius: 6, background: PALETTES[k].bg, border: `1px solid ${PALETTES[k].border}` }} />
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "capitalize" }}>{k}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
