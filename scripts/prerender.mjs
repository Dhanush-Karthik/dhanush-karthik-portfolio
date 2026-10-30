// Prerenders every public route to static HTML after `vite build` + `vite build --ssr`.
// Content comes from Supabase at build time (VITE_* env vars), so the CMS "Publish"
// button only has to trigger a Netlify build. Also writes sitemap.xml and 404.html.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const SITE = "https://dhanushkarthik.com";

const { render, loadPortfolioData } = await import(pathToFileURL(path.join(root, "dist-ssr", "entry-server.js")).href);

const template = await fs.readFile(path.join(dist, "index.html"), "utf8");
const data = await loadPortfolioData();
const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);

function page(url, { withData = true } = {}) {
  const { html, head } = render(url, data);
  return template
    .replace("<!--app-head-->", head)
    .replace(/<!--default-head-->[\s\S]*?<!--\/default-head-->/, "")
    .replace("<!--app-html-->", html)
    .replace("<!--app-data-->", withData ? `<script>window.__DK_DATA__=${json}</script>` : "");
}

async function write(rel, content) {
  const file = path.join(dist, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
  console.log(`  prerendered ${rel}`);
}

// Client-only shell for the CMS (no prerendered markup, default head kept).
await write("app.html", template.replace("<!--app-head-->", "").replace(/<!--\/?default-head-->/g, "").replace("<!--app-html-->", "").replace("<!--app-data-->", ""));

await write("index.html", page("/"));
for (const p of data.projects) await write(`projects/${p.slug}/index.html`, page(`/projects/${p.slug}`));
await write("404.html", page("/__not-found__"));

const today = new Date().toISOString().slice(0, 10);
const day = (v) => (v ? String(v).slice(0, 10) : today);
const urls = [
  { loc: `${SITE}/`, lastmod: today, priority: "1.0" },
  ...data.projects.map((p) => ({ loc: `${SITE}/projects/${p.slug}`, lastmod: day(p.updated_at), priority: "0.8" })),
  // Subdomain homepages: accepted by Google when the domain is verified as a Domain property.
  ...data.subdomains.map((d) => ({ loc: `https://${d.host}/`, lastmod: day(d.updated_at), priority: "0.7" })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`;
await write("sitemap.xml", sitemap);
await fs.rm(path.join(root, "dist-ssr"), { recursive: true, force: true });
console.log(`Prerendered ${2 + data.projects.length} pages from ${process.env.VITE_SUPABASE_URL ? "Supabase" : "built-in defaults (no VITE_SUPABASE_URL)"}.`);
