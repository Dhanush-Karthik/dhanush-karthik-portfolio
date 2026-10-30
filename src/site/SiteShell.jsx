import { useMemo } from "react";
import { Routes, Route } from "react-router-dom";
import { SiteProvider } from "./SiteContext";
import Hud from "./components/Hud";
import Footer from "./components/Footer";
import BootLoader from "./components/BootLoader";
import CommandPalette from "./components/CommandPalette";
import HandMode from "./hand/HandMode";
import Home from "./pages/Home";
import ProjectPage from "./pages/ProjectPage";
import NotFound from "./pages/NotFound";
import "./site.css";

// CMS palette overrides (v2 keys) → CSS custom properties on the site root.
function paletteVars(colors = {}) {
  const map = { paper: "--paper", ink: "--ink", terminal: "--term", phosphor: "--phosphor", signal: "--signal", tape: "--tape" };
  const vars = {};
  Object.entries(map).forEach(([k, v]) => { if (colors[k]) vars[v] = colors[k]; });
  return vars;
}

export default function SiteShell({ data }) {
  const sections = useMemo(
    () => [...data.sectionOrder].filter((s) => s.visible).sort((a, b) => a.position - b.position),
    [data.sectionOrder],
  );
  return (
    <div className="dk" style={paletteVars(data.config?.colors)}>
      <SiteProvider data={data}>
        <Hud sections={sections} />
        <Routes>
          <Route path="/" element={<Home sections={sections} />} />
          <Route path="/projects/:slug" element={<ProjectPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer data={data} />
        <BootLoader />
        <CommandPalette sections={sections} />
        <HandMode />
      </SiteProvider>
    </div>
  );
}
