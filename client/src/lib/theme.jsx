import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "leo_theme";
const DEFAULTS = { mode: "dark", accent: "#ffffff" };

const ThemeContext = createContext(null);

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function shade(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  const mix = (c) => Math.round((t - c) * p + c);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function applyAccent(accent) {
  const rgb = hexToRgb(accent);
  const isLight = relativeLuminance(rgb) > 0.5;
  const root = document.documentElement.style;
  root.setProperty("--accent-1", accent);
  root.setProperty("--accent-2", shade(accent, isLight ? -0.18 : 0.25));
  root.setProperty("--accent-text", isLight ? "#0a0a0a" : "#ffffff");
  root.setProperty("--accent-glow", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
  root.setProperty("--accent-glow-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme.mode);
    applyAccent(theme.accent);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  const value = useMemo(
    () => ({
      mode: theme.mode,
      accent: theme.accent,
      setMode: (mode) => setTheme((t) => ({ ...t, mode })),
      setAccent: (accent) => setTheme((t) => ({ ...t, accent })),
      resetAccent: () => setTheme((t) => ({ ...t, accent: DEFAULTS.accent })),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export const ACCENT_PRESETS = ["#ffffff", "#22c55e", "#3b82f6", "#a855f7", "#f43f5e", "#f59e0b", "#06b6d4"];
