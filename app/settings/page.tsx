"use client";

import React, { useEffect, useState } from "react";
import RequireAuth from "../components/RequireAuth";
import ThemeToggle from "../components/ThemeToggle";
import { applyTheme, getStoredPalette, getStoredTheme, PALETTES } from "../lib/theme";
import ProfileSettingsPage from "./profile";

export default function SettingsPage() {
  const [tab, setTab] = useState<'appearance' | 'profile'>('appearance');
  const [theme, setTheme] = useState<"light" | "dark">((typeof window !== "undefined" && getStoredTheme()) || "light");
  const [palette, setPalette] = useState<string>((typeof window !== "undefined" && getStoredPalette()) || "stone");
  const [customText, setCustomText] = useState<string>("");
  const [customBg, setCustomBg] = useState<string>("");
  const [customSurface, setCustomSurface] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [savedThemes, setSavedThemes] = useState<Array<{ name: string; text: string; bg: string; surface: string }>>([]);

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

    // Load saved themes
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("savedThemes");
      if (raw) {
        try {
          setSavedThemes(JSON.parse(raw));
        } catch {}
      }
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

  function saveCustomTheme() {
    if (!customName.trim()) return;
    const theme = {
      name: customName.trim(),
      text: customText || getComputedStyle(document.documentElement).getPropertyValue("--text"),
      bg: customBg || getComputedStyle(document.documentElement).getPropertyValue("--bg"),
      surface: customSurface || getComputedStyle(document.documentElement).getPropertyValue("--surface"),
    };
    const next = [...savedThemes.filter((t) => t.name !== theme.name), theme];
    setSavedThemes(next);
    localStorage.setItem("savedThemes", JSON.stringify(next));
    setCustomName("");
  }

  function applySavedTheme(t: { name: string; text: string; bg: string; surface: string }) {
    setCustomText(t.text);
    setCustomBg(t.bg);
    setCustomSurface(t.surface);
    document.documentElement.style.setProperty("--text", t.text);
    document.documentElement.style.setProperty("--bg", t.bg);
    document.documentElement.style.setProperty("--surface", t.surface);
    localStorage.setItem("customText", t.text);
    localStorage.setItem("customBg", t.bg);
    localStorage.setItem("customSurface", t.surface);
  }

  return (
    <RequireAuth>
      <main style={{ padding: 16 }}>
        <h1 style={{ marginTop: 6, marginBottom: 10 }}>Settings</h1>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <button
            className={tab === 'appearance' ? 'tap-btn primary' : 'tap-btn'}
            style={{ minWidth: 120 }}
            onClick={() => setTab('appearance')}
          >
            Appearance
          </button>
          <button
            className={tab === 'profile' ? 'tap-btn primary' : 'tap-btn'}
            style={{ minWidth: 120 }}
            onClick={() => setTab('profile')}
          >
            Profile
          </button>
        </div>
        {tab === 'appearance' ? (
          <>
            {/* Appearance section (moved from above) */}
            <section style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 12, borderRadius: 14, boxSizing: "border-box", overflow: "hidden" }}>
              <h2 style={{ margin: "0 0 8px 0" }}>Appearance</h2>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <div style={{ marginLeft: "auto" }}>
                  <ThemeToggle />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))", gap: 10, alignItems: "start", width: "100%", boxSizing: "border-box" }}>
                {(["ivory", "stone", "warm", "anthracite"] as Array<keyof typeof PALETTES>).map((k) => (
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
              {/* Save custom theme */}
              <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Name this theme"
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border)" }}
                />
                <button onClick={saveCustomTheme} className="tap-btn primary" style={{ minWidth: 100 }}>
                  Save custom
                </button>
              </div>
              {/* List saved themes */}
              {savedThemes.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Saved themes:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {savedThemes.map((t, idx) => (
                      <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => applySavedTheme(t)}
                          className="tap-btn"
                          style={{ background: t.bg, color: t.text, border: `1.5px solid ${t.surface}`, minWidth: 90 }}
                        >
                          {t.name}
                        </button>
                        <button
                          aria-label="Edit theme"
                          className="tap-btn"
                          style={{ padding: '2px 8px', fontSize: 13 }}
                          onClick={() => {
                            setCustomText(t.text);
                            setCustomBg(t.bg);
                            setCustomSurface(t.surface);
                            setCustomName(t.name);
                          }}
                        >✏️</button>
                        <button
                          aria-label="Delete theme"
                          className="tap-btn danger"
                          style={{ padding: '2px 8px', fontSize: 13 }}
                          onClick={() => {
                            const next = savedThemes.filter((_, i) => i !== idx);
                            setSavedThemes(next);
                            localStorage.setItem("savedThemes", JSON.stringify(next));
                          }}
                        >🗑️</button>
                        <button
                          aria-label="Apply theme to all pages"
                          className="tap-btn primary"
                          style={{ padding: '2px 8px', fontSize: 13 }}
                          onClick={() => {
                            setCustomText(t.text);
                            setCustomBg(t.bg);
                            setCustomSurface(t.surface);
                            document.documentElement.style.setProperty("--text", t.text);
                            document.documentElement.style.setProperty("--bg", t.bg);
                            document.documentElement.style.setProperty("--surface", t.surface);
                            localStorage.setItem("customText", t.text);
                            localStorage.setItem("customBg", t.bg);
                            localStorage.setItem("customSurface", t.surface);
                            window.location.reload();
                          }}
                        >Apply</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
          </>
        ) : (
          <ProfileSettingsPage />
        )}
      </main>
    </RequireAuth>
  );
}
