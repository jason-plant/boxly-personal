
"use client";
import { useIconSettings } from "../lib/iconSettings";
import { useAppIcon } from "../components/Icons";
import type { IconKey } from "../lib/iconSettings";

import React, { useEffect, useState } from "react";
import RequireAuth from "../components/RequireAuth";
import ThemeToggle from "../components/ThemeToggle";
import {
  applyTheme,
  clearCustomThemeVars,
  getStoredPalette,
  getStoredTheme,
  PALETTES,
  setCustomButtonColors,
  setCustomThemeVar,
  ThemeVarKey,
  THEME_VAR_KEYS,
} from "../lib/theme";
import ProfileSettingsPage from "./profile";
import EditIconButton from "../components/EditIconButton";
import DeleteIconButton from "../components/DeleteIconButton";

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number) {
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6;
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (h >= 0 && h < 60) {
    rp = c;
    gp = x;
  } else if (h >= 60 && h < 120) {
    rp = x;
    gp = c;
  } else if (h >= 120 && h < 180) {
    gp = c;
    bp = x;
  } else if (h >= 180 && h < 240) {
    gp = x;
    bp = c;
  } else if (h >= 240 && h < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function makeShades(hex: string) {
  if (!isHexColor(hex)) return [] as string[];
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const steps = [-0.18, -0.1, -0.04, 0.04, 0.1, 0.18];
  return steps.map((d) => {
    const next = clamp01(l + d);
    const rgb = hslToRgb(h, s, next);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  });
}

function ColorControl({
  label,
  cssVar,
  value,
  onChange,
  hint,
}: {
  label: string;
  cssVar: ThemeVarKey;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
}) {
  const shades = makeShades(value);
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 12,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: value || "transparent",
            flex: "0 0 auto",
          }}
        />
        <div style={{ fontWeight: 900, lineHeight: 1.1 }}>
          {label}
          <div style={{ fontSize: 12, opacity: 0.65, fontWeight: 700 }}>{cssVar}</div>
        </div>
      </div>

      {hint ? <div style={{ fontSize: 13, opacity: 0.75 }}>{hint}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 10, alignItems: "center" }}>
        <input
          type="color"
          value={isHexColor(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} picker`}
          style={{ width: "100%", height: 40, borderRadius: 12, border: "1px solid var(--border)", padding: 0 }}
        />

        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#RRGGBB"
          inputMode="text"
          spellCheck={false}
          style={{ width: "100%" }}
        />
      </div>

      {shades.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {shades.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              aria-label={`Set ${label} shade ${s}`}
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: s,
                padding: 0,
                boxShadow: "none",
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SettingsPage() {
  const [customBtnPrimary, setCustomBtnPrimary] = useState<string>(typeof window !== "undefined" ? localStorage.getItem("customBtnPrimary") || "" : "");
  const [customBtnDanger, setCustomBtnDanger] = useState<string>(typeof window !== "undefined" ? localStorage.getItem("customBtnDanger") || "" : "");
  const [customBtnNeutral, setCustomBtnNeutral] = useState<string>(typeof window !== "undefined" ? localStorage.getItem("customBtnNeutral") || "" : "");
  const { iconSettings, setIconStyle } = useIconSettings();
  const [tab, setTab] = useState<'appearance' | 'profile'>('appearance');
  const [theme, setTheme] = useState<"light" | "dark">((typeof window !== "undefined" && getStoredTheme()) || "light");
  const [palette, setPalette] = useState<string>((typeof window !== "undefined" && getStoredPalette()) || "stone");
  const [customText, setCustomText] = useState<string>("");
  const [customBg, setCustomBg] = useState<string>("");
  const [customSurface, setCustomSurface] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [savedThemes, setSavedThemes] = useState<Array<{ name: string; text: string; bg: string; surface: string }>>([]);
  const [hideBoxCode, setHideBoxCode] = useState<boolean>(typeof window !== "undefined" ? localStorage.getItem("hideBoxCode") === "1" : false);

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

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("hideBoxCode") === "1";
      setHideBoxCode(stored);
    }
  }, []);

  // --- Theme var editor state ---
  const [themeVars, setThemeVars] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const next: Record<string, string> = {};
    for (const k of THEME_VAR_KEYS) {
      const stored = localStorage.getItem(`themeVar:${k}`);
      if (stored) next[k] = stored;
    }
    // sensible defaults for editor fields
    const cs = getComputedStyle(document.documentElement);
    for (const k of THEME_VAR_KEYS) {
      if (!next[k]) next[k] = cs.getPropertyValue(k).trim();
    }
    setThemeVars(next);
  }, []);

  function setVar(cssVar: ThemeVarKey, raw: string) {
    const next = raw.trim();
    setThemeVars((prev) => ({ ...prev, [cssVar]: next }));
    // For color vars, only persist once it is a valid hex.
    if (
      cssVar === "--font-body" ||
      cssVar === "--header-bg" ||
      cssVar === "--header-border" ||
      cssVar === "--header-text" ||
      cssVar === "--nav-active-text" ||
      cssVar.startsWith("--btn-") ||
      cssVar === "--bg" ||
      cssVar === "--surface" ||
      cssVar === "--border" ||
      cssVar === "--text" ||
      cssVar === "--muted" ||
      cssVar === "--accent"
    ) {
      if (cssVar === "--font-body") {
        setCustomThemeVar(cssVar, next);
        return;
      }
      if (isHexColor(next)) {
        setCustomThemeVar(cssVar, next);
      }
    }
  }

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
      // Back-compat: treat stored customSurface as the card background.
      document.documentElement.style.setProperty("--card-bg", value);
      localStorage.setItem("customSurface", value);
    }
  }

  function resetThemeOverrides() {
    setCustomText("");
    setCustomBg("");
    setCustomSurface("");
    setCustomBtnPrimary("");
    setCustomBtnDanger("");
    setCustomBtnNeutral("");
    localStorage.removeItem("customText");
    localStorage.removeItem("customBg");
    localStorage.removeItem("customSurface");
    localStorage.removeItem("customBtnPrimary");
    localStorage.removeItem("customBtnDanger");
    localStorage.removeItem("customBtnNeutral");

    // New per-variable editor overrides
    clearCustomThemeVars();

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
            <section style={{ background: "var(--card-bg)", border: "1px solid var(--border)", padding: 12, borderRadius: 14, boxSizing: "border-box", overflow: "hidden" }}>
              <h2 style={{ margin: "0 0 8px 0" }}>Appearance</h2>

              {/* Icon style pickers */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Icon style</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                  {[
                    { key: 'locations', label: 'Locations' },
                    { key: 'boxes', label: 'Boxes' },
                    { key: 'search', label: 'Search' },
                    { key: 'labels', label: 'Labels' },
                    { key: 'scanQR', label: 'Scan QR' },
                    { key: 'scanItem', label: 'Scan Item' },
                    { key: 'home', label: 'Home' },
                    { key: 'edit', label: 'Edit' },
                    { key: 'delete', label: 'Delete' },
                    { key: 'logout', label: 'Logout' },
                  ].map(({ key, label }) => {
                    const iconKey = key as IconKey;
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, border: '1px solid var(--border)', borderRadius: 8 }}>
                        <span style={{ minWidth: 28 }}>{useAppIcon(iconKey)}</span>
                        <span style={{ flex: 1 }}>{label}</span>
                        <select
                          value={iconSettings[iconKey] || 'svg'}
                          onChange={e => setIconStyle(iconKey, e.target.value as any)}
                          style={{ borderRadius: 6, padding: '2px 8px' }}
                        >
                          <option value="svg">SVG</option>
                          <option value="emoji">Emoji</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
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
              <div style={{ marginTop: 18 }}>
                <h3 style={{ margin: "0 0 10px 0" }}>Theme editor</h3>
                <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 12 }}>
                  Pick colours + shades for each element. Values are stored on this device.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                  <ColorControl
                    label="App background"
                    cssVar="--bg"
                    value={themeVars["--bg"] || customBg || "#ffffff"}
                    onChange={(v) => {
                      setVar("--bg", v);
                      handleCustomChange("bg", v);
                    }}
                    hint="The page background behind cards."
                  />

                  <ColorControl
                    label="Cards"
                    cssVar="--card-bg"
                    value={themeVars["--card-bg"] || customSurface || themeVars["--surface"] || "#ffffff"}
                    onChange={(v) => {
                      setVar("--card-bg", v);
                      handleCustomChange("surface", v);
                    }}
                    hint="Card/section background."
                  />

                  <ColorControl
                    label="Surface"
                    cssVar="--surface"
                    value={themeVars["--surface"] || "#ffffff"}
                    onChange={(v) => setVar("--surface", v)}
                    hint="Inputs, menus, and UI surfaces."
                  />

                  <ColorControl
                    label="Borders"
                    cssVar="--border"
                    value={themeVars["--border"] || "#e5e7eb"}
                    onChange={(v) => setVar("--border", v)}
                    hint="Outlines for cards, inputs, buttons."
                  />

                  <ColorControl
                    label="Text"
                    cssVar="--text"
                    value={themeVars["--text"] || customText || "#111111"}
                    onChange={(v) => {
                      setVar("--text", v);
                      handleCustomChange("text", v);
                    }}
                    hint="Main text colour."
                  />

                  <ColorControl
                    label="Muted text"
                    cssVar="--muted"
                    value={themeVars["--muted"] || "#6B7280"}
                    onChange={(v) => setVar("--muted", v)}
                    hint="Secondary text / hints."
                  />

                  <ColorControl
                    label="Accent"
                    cssVar="--accent"
                    value={themeVars["--accent"] || "#6B8FA3"}
                    onChange={(v) => setVar("--accent", v)}
                    hint="Active nav + accents."
                  />

                  <ColorControl
                    label="Header background"
                    cssVar="--header-bg"
                    value={themeVars["--header-bg"] || "#ffffff"}
                    onChange={(v) => setVar("--header-bg", v)}
                    hint="Top bar background."
                  />

                  <ColorControl
                    label="Header border"
                    cssVar="--header-border"
                    value={themeVars["--header-border"] || themeVars["--border"] || "#e5e7eb"}
                    onChange={(v) => setVar("--header-border", v)}
                    hint="Bottom divider line."
                  />

                  <ColorControl
                    label="Header text"
                    cssVar="--header-text"
                    value={themeVars["--header-text"] || themeVars["--text"] || "#111111"}
                    onChange={(v) => setVar("--header-text", v)}
                    hint="Header title + icons."
                  />

                  <ColorControl
                    label="Primary button"
                    cssVar="--btn-primary"
                    value={themeVars["--btn-primary"] || customBtnPrimary || "#111111"}
                    onChange={(v) => {
                      setVar("--btn-primary", v);
                      setCustomBtnPrimary(v);
                      if (isHexColor(v)) setCustomButtonColors({ primary: v });
                    }}
                    hint="Buttons with .primary."
                  />

                  <ColorControl
                    label="Primary button text"
                    cssVar="--btn-primary-text"
                    value={themeVars["--btn-primary-text"] || "#ffffff"}
                    onChange={(v) => setVar("--btn-primary-text", v)}
                  />

                  <ColorControl
                    label="Neutral button"
                    cssVar="--btn-neutral"
                    value={themeVars["--btn-neutral"] || customBtnNeutral || (themeVars["--surface"] || "#ffffff")}
                    onChange={(v) => {
                      setVar("--btn-neutral", v);
                      setCustomBtnNeutral(v);
                      if (isHexColor(v)) setCustomButtonColors({ neutral: v });
                    }}
                  />

                  <ColorControl
                    label="Neutral button text"
                    cssVar="--btn-neutral-text"
                    value={themeVars["--btn-neutral-text"] || (themeVars["--text"] || "#111111")}
                    onChange={(v) => setVar("--btn-neutral-text", v)}
                  />

                  <ColorControl
                    label="Danger colour"
                    cssVar="--btn-danger"
                    value={themeVars["--btn-danger"] || customBtnDanger || "#ef4444"}
                    onChange={(v) => {
                      setVar("--btn-danger", v);
                      setCustomBtnDanger(v);
                      if (isHexColor(v)) setCustomButtonColors({ danger: v });
                    }}
                    hint="Used for destructive actions."
                  />

                  <ColorControl
                    label="Danger text"
                    cssVar="--btn-danger-text"
                    value={themeVars["--btn-danger-text"] || (themeVars["--btn-danger"] || "#ef4444")}
                    onChange={(v) => setVar("--btn-danger-text", v)}
                  />

                  <ColorControl
                    label="Active nav text"
                    cssVar="--nav-active-text"
                    value={themeVars["--nav-active-text"] || "#ffffff"}
                    onChange={(v) => setVar("--nav-active-text", v)}
                    hint="Text colour on active nav buttons."
                  />
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>Font</div>
                  <select
                    value={themeVars["--font-body"] || ""}
                    onChange={(e) => setVar("--font-body", e.target.value as any)}
                  >
                    <option value="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Apple Color Emoji, Segoe UI Emoji">
                      System (default)
                    </option>
                    <option value="Segoe UI, ui-sans-serif, system-ui, -apple-system, Roboto, Arial, Apple Color Emoji, Segoe UI Emoji">
                      Segoe UI
                    </option>
                    <option value="Georgia, ui-serif, serif">Serif (Georgia)</option>
                    <option value="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace">
                      Monospace
                    </option>
                  </select>
                  <div style={{ fontSize: 13, opacity: 0.75 }}>
                    This changes the font across the whole app.
                  </div>
                </div>
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
                        <EditIconButton
                          onClick={() => {
                            setCustomText(t.text);
                            setCustomBg(t.bg);
                            setCustomSurface(t.surface);
                            setCustomName(t.name);
                          }}
                          title="Edit theme"
                        />
                        <DeleteIconButton
                          onClick={() => {
                            const next = savedThemes.filter((_, i) => i !== idx);
                            setSavedThemes(next);
                            localStorage.setItem("savedThemes", JSON.stringify(next));
                          }}
                          title="Delete theme"
                        />
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
                            localStorage.setItem("palette", "custom");
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
                    <div style={{ background: "var(--card-bg)", padding: 12, borderRadius: 8, border: "1px solid var(--border)", maxWidth: 360 }}>
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
              <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", padding: 12, borderRadius: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={hideBoxCode}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setHideBoxCode(next);
                      if (typeof window !== "undefined") {
                        localStorage.setItem("hideBoxCode", next ? "1" : "0");
                      }
                    }}
                  />
                  <span>Hide box code on box pages</span>
                </label>
                <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13 }}>
                  When enabled, the box code won’t be shown on the items page.
                </div>
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
