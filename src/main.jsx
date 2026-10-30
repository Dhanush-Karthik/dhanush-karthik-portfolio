import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./styles/index.css";

const root = document.getElementById("root");
const initialData = window.__DK_DATA__;
const app = (
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App initialData={initialData} />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);

// Prerendered pages hydrate; the CMS and unknown paths render from scratch.
if (root.hasChildNodes() && initialData && !location.pathname.startsWith("/cms")) ReactDOM.hydrateRoot(root, app);
else {
  root.replaceChildren();
  ReactDOM.createRoot(root).render(app);
}
