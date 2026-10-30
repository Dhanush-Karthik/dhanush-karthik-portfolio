import { useState, useEffect } from "react";
import { defaultData, loadPortfolioData, normalizeData } from "../lib/portfolioData";

// `initial` comes from the prerendered snapshot (window.__DK_DATA__) so hydration matches the static HTML.
// Live data is then refetched so CMS edits show up before the next publish.
export function usePortfolioData(initial) {
  const [data, setData] = useState(() => ({ ...(initial ? normalizeData(initial) : defaultData), loading: !initial }));

  useEffect(() => {
    let alive = true;
    loadPortfolioData()
      .then((fresh) => { if (alive) setData({ ...fresh, loading: false }); })
      .catch(() => { if (alive) setData((prev) => ({ ...prev, loading: false })); });
    return () => { alive = false; };
  }, []);

  return data;
}
