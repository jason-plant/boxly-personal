"use client";

import { useEffect } from "react";
import { applyStoredCustomThemeVars, applyTheme, getStoredPalette, getStoredTheme, applyCustomButtonColors } from "../lib/theme";

export default function ThemeInitializer() {
  useEffect(() => {
    try {
      const t = getStoredTheme();
      const p = getStoredPalette();
      applyTheme(t, p);
      applyStoredCustomThemeVars();
      applyCustomButtonColors();
      // If palette is 'custom', apply custom overrides
      if (p === 'custom') {
        const customText = localStorage.getItem('customText');
        const customBg = localStorage.getItem('customBg');
        const customSurface = localStorage.getItem('customSurface');
        if (customText) document.documentElement.style.setProperty('--text', customText);
        if (customBg) document.documentElement.style.setProperty('--bg', customBg);
        if (customSurface) document.documentElement.style.setProperty('--surface', customSurface);
      }
    } catch (e) {
      /* ignore */
    }
  }, []);

  return null;
}
