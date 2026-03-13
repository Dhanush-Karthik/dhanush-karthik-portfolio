import { Routes, Route } from "react-router-dom";
import { usePortfolioData } from "./hooks/usePortfolioData";
import { ThemeProvider } from "./lib/theme";
import Portfolio from "./pages/Portfolio";
import CMSLogin from "./pages/CMSLogin";
import CMSDashboard from "./pages/CMSDashboard";

export default function App() {
  const data = usePortfolioData();

  return (
    <ThemeProvider config={data.config}>
      <Routes>
        <Route path="/" element={<Portfolio data={data} />} />
        <Route path="/cms" element={<CMSLogin />} />
        <Route path="/cms/dashboard" element={<CMSDashboard />} />
      </Routes>
    </ThemeProvider>
  );
}
