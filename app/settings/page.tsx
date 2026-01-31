"use client";

import React, { useEffect, useState } from "react";
import RequireAuth from "../components/RequireAuth";
import ThemeToggle from "../components/ThemeToggle";
import { applyTheme, getStoredPalette, getStoredTheme, PALETTES } from "../lib/theme";

export default function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark">((typeof window !== "undefined" && getStoredTheme()) || "light");
  const [palette, setPalette] = useState<string>((typeof window !== "undefined" && getStoredPalette()) || "stone");

  useEffect(() => {
    // reflect current stored theme on mount
    if (typeof window !== "undefined") {
      applyTheme(theme, palette as any);
    }
  }, []);

  return (
    <RequireAuth>
      <main style={{ padding: 16 }}>
        <h1 style={{ marginTop: 6, marginBottom: 10 }}>Settings</h1>

        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 12, borderRadius: 14 }}>
          <h2 style={{ margin: "0 0 8px 0" }}>Appearance</h2>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="radio" name="theme" value="light" checked={theme === "light"} onChange={() => { setTheme("light"); applyTheme("light", palette as any); }} /> Light
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="radio" name="theme" value="dark" checked={theme === "dark"} onChange={() => { setTheme("dark"); applyTheme("dark", palette as any); }} /> Dark
            </label>

            <div style={{ marginLeft: "auto" }}>
              <ThemeToggle />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {(Object.keys(PALETTES) as Array<keyof typeof PALETTES>).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setPalette(k);
                  applyTheme(theme, k as any);
                }}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  padding: 8,
                  borderRadius: 10,
                  border: palette === k ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <div style={{ width: 36, height: 24, borderRadius: 6, background: PALETTES[k].bg, border: `1px solid ${PALETTES[k].border}` }} />
                <div style={{ fontWeight: 800 }}>{k}</div>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12, opacity: 0.85 }}>
            Palette and theme changes apply immediately and are persisted to your browser.
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <h2 style={{ margin: "0 0 8px 0" }}>Formats</h2>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 12, borderRadius: 14 }}>
            Format options will live here (label print presets, default copies, etc.).
          </div>
        </section>
      </main>
    </RequireAuth>
  );
}
