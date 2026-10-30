import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { usePortfolioData } from "./hooks/usePortfolioData";
import { ThemeProvider } from "./lib/theme";
import SiteShell from "./site/SiteShell";

// The CMS is never prerendered and is loaded only when visited.
const CMSLogin = lazy(() => import("./pages/CMSLogin"));
const CMSDashboard = lazy(() => import("./pages/CMSDashboard"));

function Site({ initialData }) {
  const data = usePortfolioData(initialData);
  return <SiteShell data={data} />;
}

function Cms({ children }) {
  return <ThemeProvider config={null}><Suspense fallback={null}>{children}</Suspense></ThemeProvider>;
}

export default function App({ initialData }) {
  return (
    <Routes>
      <Route path="/cms" element={<Cms><CMSLogin /></Cms>} />
      <Route path="/cms/dashboard" element={<Cms><CMSDashboard /></Cms>} />
      <Route path="/*" element={<Site initialData={initialData} />} />
    </Routes>
  );
}
