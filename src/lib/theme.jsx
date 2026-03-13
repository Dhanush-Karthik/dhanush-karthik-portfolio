import { createContext, useContext, useEffect } from "react";
import { defaultConfig } from "./defaults";

const ThemeContext = createContext({});

export function ThemeProvider({ config, children }) {
  const colors = config?.colors || defaultConfig.colors;

  useEffect(() => {
    const root = document.documentElement;

    root.style.setProperty("--c-bg-primary", colors.bg_primary);
    root.style.setProperty("--c-bg-secondary", colors.bg_secondary);
    root.style.setProperty("--c-bg-tertiary", colors.bg_tertiary);
    root.style.setProperty("--c-border", colors.border);
    root.style.setProperty("--c-text-primary", colors.text_primary);
    root.style.setProperty("--c-text-secondary", colors.text_secondary);
    root.style.setProperty("--c-text-tertiary", colors.text_tertiary);
    root.style.setProperty("--c-accent-primary", colors.accent_primary);
    root.style.setProperty("--c-accent-secondary", colors.accent_secondary);
    root.style.setProperty("--c-accent-tertiary", colors.accent_tertiary);
    root.style.setProperty("--c-accent-danger", colors.accent_danger);
    root.style.setProperty(
      "--c-accent-primary-glow",
      colors.accent_primary_glow || "rgba(74,222,128,0.15)"
    );
  }, [colors]);

  return (
    <ThemeContext.Provider value={{ colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}