import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import { loadPortfolioData } from "./lib/portfolioData";

export { loadPortfolioData };

export function render(url, data) {
  const helmetContext = {};
  const html = renderToString(
    <React.StrictMode>
      <HelmetProvider context={helmetContext}>
        <StaticRouter location={url}>
          <App initialData={data} />
        </StaticRouter>
      </HelmetProvider>
    </React.StrictMode>,
  );
  const { helmet } = helmetContext;
  const head = [helmet.title, helmet.meta, helmet.link, helmet.script].map((h) => h?.toString() || "").join("\n");
  return { html, head };
}
