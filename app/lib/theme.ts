// Button color customizations
export function setCustomButtonColors({ primary, danger, neutral }: { primary?: string; danger?: string; neutral?: string }) {
  if (primary) {
    document.documentElement.style.setProperty('--btn-primary', primary);
    localStorage.setItem('customBtnPrimary', primary);
  }
  if (danger) {
    document.documentElement.style.setProperty('--btn-danger', danger);
    localStorage.setItem('customBtnDanger', danger);
  }
  if (neutral) {
    document.documentElement.style.setProperty('--btn-neutral', neutral);
    localStorage.setItem('customBtnNeutral', neutral);
  }
}

export function applyCustomButtonColors() {
  const primary = localStorage.getItem('customBtnPrimary');
  const danger = localStorage.getItem('customBtnDanger');
  const neutral = localStorage.getItem('customBtnNeutral');
  if (primary) document.documentElement.style.setProperty('--btn-primary', primary);
  if (danger) document.documentElement.style.setProperty('--btn-danger', danger);
  if (neutral) document.documentElement.style.setProperty('--btn-neutral', neutral);
}

export const THEME_VAR_KEYS = [
  "--bg",
  "--surface",
  "--border",
  "--text",
  "--muted",
  "--accent",
  "--header-bg",
  "--header-border",
  "--header-text",
  "--btn-primary",
  "--btn-primary-text",
  "--btn-neutral",
  "--btn-neutral-text",
  "--btn-danger",
  "--btn-danger-text",
  "--font-body",
  "--nav-active-text",
] as const;

export type ThemeVarKey = (typeof THEME_VAR_KEYS)[number];

function storageKeyForVar(cssVar: ThemeVarKey) {
  return `themeVar:${cssVar}`;
}

export function setCustomThemeVar(cssVar: ThemeVarKey, value: string) {
  document.documentElement.style.setProperty(cssVar, value);
  try {
    localStorage.setItem(storageKeyForVar(cssVar), value);
  } catch {}
}

export function getStoredThemeVar(cssVar: ThemeVarKey): string | null {
  try {
    return localStorage.getItem(storageKeyForVar(cssVar));
  } catch {
    return null;
  }
}

export function clearCustomThemeVars() {
  try {
    for (const k of THEME_VAR_KEYS) {
      localStorage.removeItem(storageKeyForVar(k));
    }
  } catch {}
}

export function applyStoredCustomThemeVars() {
  try {
    for (const k of THEME_VAR_KEYS) {
      const v = localStorage.getItem(storageKeyForVar(k));
      if (v) document.documentElement.style.setProperty(k, v);
    }
  } catch {}
}
export type PaletteKey = "ivory" | "stone" | "warm" | "anthracite" | "custom";

export const PALETTES: Record<Extract<PaletteKey, 'ivory' | 'stone' | 'warm' | 'anthracite'>, { bg: string; surface: string; border: string; text: string; muted: string; accent: string; }> = {
  ivory: {
    bg: "#FBFBFA",
    surface: "#FFFFFF",
    border: "#EFEDEB",
    text: "#111827",
    muted: "#6B7280",
    accent: "#9AA4A8",
  },
  stone: {
    bg: "#F4F6F7",
    surface: "#FBFCFD",
    border: "#DDE2E6",
    text: "#1F2933",
    muted: "#6B7280",
    accent: "#6B8FA3",
  },
  warm: {
    bg: "#F6F4F2",
    surface: "#FFFFFF",
    border: "#D6CFC8",
    text: "#222028",
    muted: "#6B6661",
    accent: "#927E6B",
  },
  anthracite: {
    bg: "#ECEFF1",
    surface: "#FFFFFF",
    border: "#D6D8DB",
    text: "#0F1724",
    muted: "#6B7280",
    accent: "#33363A",
  },
};

export function getStoredTheme(): "light" | "dark" {
  try {
    const t = localStorage.getItem("theme");
    if (t === "dark") return "dark";
  } catch (e) {}
  return "light";
}


export function getStoredPalette(): PaletteKey {
  try {
    const p = localStorage.getItem("palette") as PaletteKey | null;
    if (p && (p === 'custom' || PALETTES[p])) return p;
  } catch (e) {}
  return "ivory";
}

export function applyTheme(theme: "light" | "dark", palette: PaletteKey) {
  const root = document.documentElement;
  if (palette === 'custom') {
    // Use custom overrides from localStorage
    const customBg = localStorage.getItem('customBg') || '#fff';
    const customSurface = localStorage.getItem('customSurface') || '#fff';
    const customText = localStorage.getItem('customText') || '#111';
    root.style.setProperty("--bg", customBg);
    root.style.setProperty("--surface", customSurface);
    root.style.setProperty("--border", '#e5e7eb');
    root.style.setProperty("--text", customText);
    root.style.setProperty("--muted", '#6B7280');
    root.style.setProperty("--accent", '#6B8FA3');
  } else {
    const p = PALETTES[palette];
    root.style.setProperty("--bg", p.bg);
    root.style.setProperty("--surface", p.surface);
    root.style.setProperty("--border", p.border);
    root.style.setProperty("--text", p.text);
    root.style.setProperty("--muted", p.muted);
    root.style.setProperty("--accent", p.accent);
  }

  // Apply any per-variable overrides (header/buttons/fonts/etc)
  applyStoredCustomThemeVars();
  applyCustomButtonColors();

  if (theme === "dark") {
    root.setAttribute("data-theme", "dark");
  } else {
    root.removeAttribute("data-theme");
  }

  try {
    localStorage.setItem("theme", theme);
    localStorage.setItem("palette", palette);
  } catch (e) {}
}
