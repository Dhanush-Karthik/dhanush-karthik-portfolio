import { createContext, useContext, useEffect, useState } from "react";
import { defaultConfig } from "./defaults";

const ThemeContext = createContext({});

export function ThemeProvider({ config, children }) {
  const [colors, setColors] = useState(defaultConfig.colors);

  useEffect(() => {
    const c = config?.colors || defaultConfig.colors;
    setColors(c);
    const root = document.documentElement;
    root.style.setProperty("--c-bg-primary", c.bg_primary);
    root.style.setProperty("--c-bg-secondary", c.bg_secondary);
    root.style.setProperty("--c-bg-tertiary", c.bg_tertiary);
    root.style.setProperty("--c-border", c.border);
    root.style.setProperty("--c-text-primary", c.text_primary);
    root.style.setProperty("--c-text-secondary", c.text_secondary);
    root.style.setProperty("--c-text-tertiary", c.text_tertiary);
    root.style.setProperty("--c-accent-primary", c.accent_primary);
    root.style.setProperty("--c-accent-secondary", c.accent_secondary);
    root.style.setProperty("--c-accent-tertiary", c.accent_tertiary);
    root.style.setProperty("--c-accent-danger", c.accent_danger);
    root.style.setProperty("--c-accent-primary-glow", c.accent_primary_glow || "rgba(74,222,128,0.15)");
  }, [config]);

  return (
    <ThemeContext.Provider value={{ colors, setColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
