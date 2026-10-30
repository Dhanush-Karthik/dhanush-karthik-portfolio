import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, Github, ArrowLeft } from "lucide-react";
import Sheet from "../components/Sheet";
import { useSite } from "../SiteContext";
import { projectLd, SITE } from "../lib/seo";
import NotFound from "./NotFound";

// Minimal case-study text format from the CMS: blank line = paragraph, "## " = heading.
function Prose({ text }) {
  const blocks = (text || "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((b, i) => b.startsWith("## ") ? <h2 key={i}>{b.slice(3)}</h2> : <p key={i}>{b}</p>);
}

export default function ProjectPage() {
  const { slug } = useParams();
  const { data, go } = useSite();
  const idx = data.projects.findIndex((p) => p.slug === slug);
  if (idx < 0) return <NotFound />;
  const p = data.projects[idx];
  const prevP = data.projects[(idx - 1 + data.projects.length) % data.projects.length];
  const nextP = data.projects[(idx + 1) % data.projects.length];
  const title = `${p.title} — Dhanush Karthik`;
  const nav = (to) => (e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go(to, "var(--ink)"); };

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={p.description} />
        <link rel="canonical" href={`${SITE}/projects/${p.slug}`} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={p.description} />
        <meta property="og:url" content={`${SITE}/projects/${p.slug}`} />
        <meta property="og:image" content={p.screenshot_url || `${SITE}/og-image.png`} />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={p.description} />
        <script type="application/ld+json">{JSON.stringify(projectLd(data, p))}</script>
      </Helmet>
      <main>
        <Sheet id={`project-${p.slug}`} variant="paper" torn={false} trace={`at dk.Portfolio.open(${p.slug}.java:${idx + 1})`} cmd={`cd ~/deploy/${p.slug}`} label={p.title}>
          <Link to="/#projects" className="eyebrow" style={{ display: "inline-flex", gap: 6, alignItems: "center", marginBottom: 24, textDecoration: "none" }}><ArrowLeft size={14} />cd ..</Link>
          <div className="case-head">
            <h1 className="case-title">{p.title}</h1>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {p.live_url && <a className="btn solid" href={p.live_url} target="_blank" rel="noopener"><ExternalLink size={15} />Live</a>}
              {p.github_url && <a className="btn" href={p.github_url} target="_blank" rel="noopener"><Github size={15} />Source</a>}
            </div>
          </div>
          <dl className="case-meta">
            <div><dt>Year</dt><dd>{p.year || "—"}</dd></div>
            <div><dt>Role</dt><dd>{p.role || "Engineer"}</dd></div>
            <div><dt>Stack</dt><dd>{(p.tech_stack || []).join(", ")}</dd></div>
            <div><dt>Built by</dt><dd><Link to="/">Dhanush Karthik</Link></dd></div>
          </dl>
          {p.screenshot_url && <img className="case-shot" src={p.screenshot_url} alt={`${p.title} screenshot`} />}
          <div className="case-body">
            <div className="eyebrow">README.md</div>
            <div className="prose">
              <p style={{ fontSize: "1.25rem", fontWeight: 600 }}>{p.description}</p>
              <Prose text={p.case_study} />
            </div>
          </div>
          {data.projects.length > 1 && (
            <nav className="case-nav" aria-label="More projects">
              <a href={`/projects/${prevP.slug}`} onClick={nav(`/projects/${prevP.slug}`)}>← {prevP.title}</a>
              <a href={`/projects/${nextP.slug}`} onClick={nav(`/projects/${nextP.slug}`)}>{nextP.title} →</a>
            </nav>
          )}
        </Sheet>
      </main>
    </>
  );
}
