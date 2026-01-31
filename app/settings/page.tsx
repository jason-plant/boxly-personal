"use client";

import React, { useEffect, useState } from "react";
import RequireAuth from "../components/RequireAuth";
import ThemeToggle from "../components/ThemeToggle";
import { applyTheme, getStoredPalette, getStoredTheme, PALETTES } from "../lib/theme";

export default function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark">((typeof window !== "undefined" && getStoredTheme()) || "light");
  const [palette, setPalette] = useState<string>((typeof window !== "undefined" && getStoredPalette()) || "stone");
  const [customText, setCustomText] = useState<string>("");
  const [customBg, setCustomBg] = useState<string>("");
  const [customSurface, setCustomSurface] = useState<string>("");

  useEffect(() => {
    // reflect current stored theme on mount
    if (typeof window !== "undefined") {
      applyTheme(theme, palette as any);
    }

    // load custom overrides
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("customText") || "";
      const b = localStorage.getItem("customBg") || "";
      const s = localStorage.getItem("customSurface") || "";
      setCustomText(t);
      setCustomBg(b);
      setCustomSurface(s);
      if (t) document.documentElement.style.setProperty("--text", t);
      if (b) document.documentElement.style.setProperty("--bg", b);
      if (s) document.documentElement.style.setProperty("--surface", s);
    }
  }, []);

  function handleCustomChange(type: "text" | "bg" | "surface", value: string) {
    if (type === "text") {
      setCustomText(value);
      document.documentElement.style.setProperty("--text", value);
      localStorage.setItem("customText", value);
    } else if (type === "bg") {
      setCustomBg(value);
      document.documentElement.style.setProperty("--bg", value);
      localStorage.setItem("customBg", value);
    } else if (type === "surface") {
      setCustomSurface(value);
      document.documentElement.style.setProperty("--surface", value);
      localStorage.setItem("customSurface", value);
    }
  }

  function resetThemeOverrides() {
    setCustomText("");
    setCustomBg("");
    setCustomSurface("");
    localStorage.removeItem("customText");
    localStorage.removeItem("customBg");
    localStorage.removeItem("customSurface");
    // re-apply palette/theme
    applyTheme(theme, palette as any);
  }

  return (
    <RequireAuth>
      <main style={{ padding: 16 }}>
        <h1 style={{ marginTop: 6, marginBottom: 10 }}>Settings</h1>

        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 12, borderRadius: 14, boxSizing: "border-box", overflow: "hidden" }}>
          <h2 style={{ margin: "0 0 8px 0" }}>Appearance</h2>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <div style={{ marginLeft: "auto" }}>
              <ThemeToggle />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))", gap: 10, alignItems: "start", width: "100%", boxSizing: "border-box" }}>
            {(["ivory", "stone", "warm", "charcoal"] as Array<keyof typeof PALETTES>).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setPalette(k);
                  applyTheme(theme, k as any);
                }}
                aria-pressed={palette === k}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  alignItems: "center",
                  padding: 10,
                  borderRadius: 12,
                  border: palette === k ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: "var(--surface)",
                  width: "100%",
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ width: 56, height: 30, borderRadius: 8, background: PALETTES[k].bg, border: `1px solid ${PALETTES[k].border}` }} />
                <div style={{ fontWeight: 800, textTransform: "capitalize" }}>{k}</div>
              </button>
            ))}
          </div>

          {/* Custom color controls */}
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 700 }}>Text color</span>
              <input type="color" value={customText || ""} onChange={e => handleCustomChange("text", e.target.value)} style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid var(--border)" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 700 }}>Background</span>
              <input type="color" value={customBg || ""} onChange={e => handleCustomChange("bg", e.target.value)} style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid var(--border)" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 700 }}>Card color</span>
              <input type="color" value={customSurface || ""} onChange={e => handleCustomChange("surface", e.target.value)} style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid var(--border)" }} />
            </label>
          </div>

          <button onClick={resetThemeOverrides} className="tap-btn" style={{ marginTop: 10, width: 180 }}>
            Reset to default
          </button>

          {/* Live preview */}
          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: 12, borderRadius: 10 }}>
                <div style={{ background: "var(--surface)", padding: 12, borderRadius: 8, border: "1px solid var(--border)", maxWidth: 360 }}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>App preview</div>
                  <div style={{ marginTop: 8, color: "var(--muted)" }}>This card shows how the palette affects surface, borders, text, and accent.</div>

                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button className="tap-btn primary">Accent button</button>
                    <button className="tap-btn">Neutral</button>
                  </div>
                </div>
              </div>
            </div>
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
