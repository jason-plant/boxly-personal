export type PaletteKey = "ivory" | "stone" | "warm" | "anthracite" | "custom";

export const PALETTES: Record<Exclude<PaletteKey, 'custom'>, { bg: string; surface: string; border: string; text: string; muted: string; accent: string; }> = {
// ...existing code...
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
  return "ivory";
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
