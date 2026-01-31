"use client";

import { useEffect } from "react";
import { applyTheme, getStoredPalette, getStoredTheme } from "../lib/theme";

export default function ThemeInitializer() {
  useEffect(() => {
    try {
      const t = getStoredTheme();
      const p = getStoredPalette();
      applyTheme(t, p);
    } catch (e) {
      /* ignore */
    }
  }, []);

  return null;
}
