export type PaletteKey = "stone" | "warm" | "gray";

export const PALETTES: Record<PaletteKey, { bg: string; surface: string; border: string; text: string; muted: string; accent: string; }> = {
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
  gray: {
    bg: "#F7F7F8",
    surface: "#FFFFFF",
    border: "#E6E6E8",
    text: "#2B2B2F",
    muted: "#7B7B82",
    accent: "#4B7A74",
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
    if (p && PALETTES[p]) return p;
  } catch (e) {}
  return "stone";
}

export function applyTheme(theme: "light" | "dark", palette: PaletteKey) {
  const root = document.documentElement;
  const p = PALETTES[palette];
  root.style.setProperty("--bg", p.bg);
  root.style.setProperty("--surface", p.surface);
  root.style.setProperty("--border", p.border);
  root.style.setProperty("--text", p.text);
  root.style.setProperty("--muted", p.muted);
  root.style.setProperty("--accent", p.accent);

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
