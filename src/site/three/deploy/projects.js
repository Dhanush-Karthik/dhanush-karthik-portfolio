// The deploy shelf: every project on the résumé plus the ones on the live site. No three imports, so
// the Flat layout and the server render read it too. The CMS only overlays links and screenshots
// onto matching rows (and adds rows of its own); the words live here, like the résumé history.
import { defaultProjects } from "../../../lib/defaults";
import { projectSlug } from "../../../lib/slug";

const INK = { bg: "#111311", fg: "#F7F5EF", accent: "#4ADE80" };
const GREEN = { bg: "#07110A", fg: "#4ADE80", accent: "#CFE3D4" };
const RED = { bg: "#E5432D", fg: "#FFFFFF", accent: "#111311" };
const PAPER = { bg: "#FBFAF6", fg: "#111311", accent: "#E5432D" };
const TAPE = { bg: "#F2C94C", fg: "#111311", accent: "#111311" };
const STYLES = [GREEN, RED, PAPER, TAPE, INK];

// motif: which live diorama is drawn on the card (see motifs.js)
const BASE = [
  {
    id: "ibm-idp", match: [], motif: 0, style: GREEN, kind: "client", tag: "Client · IBM",
    title: "IBM Identity Provider Platform", card: "IBM Identity Provider", tagline: "Identity provider for IBM e-Health, in production",
    org: "Grootan Technologies", role: "Software Engineer",
    lead: "The Identity Provider Platform (IDP) behind IBM e-Health: secure identity verification, authentication, device management and usage tracking for tens of thousands of users.",
    bullets: [
      "Own 3 of 8 production Java microservices, built with Spring Boot and Quarkus.",
      "Designed 50+ client-facing REST APIs, including the Quarkus-based device management architecture.",
      "End-to-end mTLS: PKI certificates, IBM Secrets Manager, Kubernetes External Secrets, Java keystores.",
      "Traced a production mTLS failure through OpenTelemetry and Prometheus, then coordinated the certificate rotation.",
    ],
    metrics: [{ v: "3 / 8", l: "services owned" }, { v: "50+", l: "REST APIs" }, { v: "mTLS", l: "end to end" }],
    tech: ["Java", "Spring Boot", "Quarkus", "Kubernetes", "Helm", "mTLS", "PKI", "OpenTelemetry", "GitHub Actions"],
  },
  {
    id: "migros-cip", match: [], motif: 1, style: RED, kind: "client", tag: "Client · Migros",
    title: "Migros Consumer Identity Platform", card: "Migros Consumer Identity", tagline: "Real-time auth events: polling replaced by SSE",
    org: "Grootan Technologies", role: "Software Engineer",
    lead: "The consumer identity platform behind Migros sign-ins: authentication events delivered in real time, and an activation flow that reaches people on whichever channel they have.",
    bullets: [
      "Replaced 1-second client polling with Server-Sent Events served straight from the IdP.",
      "Cut the flow from 4 components to 2, removing the failure points of the old socket.io setup.",
      "Infinispan as a distributed pub/sub layer for cluster-wide event propagation. I owned the design.",
      "Omnichannel activation: mobile push, activation codes and manual-letter verification.",
    ],
    metrics: [{ v: "SSE", l: "replaces 1 s polling" }, { v: "4 → 2", l: "components" }, { v: "Q3 '24", l: "Groot of the Quarter" }],
    tech: ["Java", "Server-Sent Events", "Infinispan", "Distributed pub/sub", "Push notifications"],
  },
  {
    id: "shiftpen", match: [], motif: 2, style: PAPER, kind: "product", tag: "Product PoC",
    title: "ShiftPen", card: "ShiftPen e-Signing", tagline: "Multi-signer digital e-signing, provider-agnostic",
    org: "Grootan Technologies", role: "Backend engineer, team of 3",
    lead: "A multi-signer digital e-signing platform: one signing workflow that coordinates every signer and whichever third-party provider is behind it.",
    bullets: [
      "A provider-agnostic e-signature architecture: the core workflow no longer depends on any provider's API.",
      "The multi-signer signing workflow on Java, Spring Boot and Flowable.",
      "OTP re-authentication when a signer's session expires, before the flow continues.",
      "Backend delivered ahead of a 4-week deadline, in time for stakeholder demos and first-client onboarding.",
    ],
    metrics: [{ v: "3", l: "engineers" }, { v: "4 wk", l: "deadline, beaten" }, { v: "OTP", l: "signer re-auth" }],
    tech: ["Java", "Spring Boot", "Flowable", "BPM", "OTP"],
  },
  {
    id: "archistudio", match: ["archistudio", "archistud"], motif: 3, style: TAPE, kind: "site", tag: "Live",
    title: "ArchiStudio", card: "ArchiStudio", tagline: "SaaS for architecture firms and their clients",
    org: "Personal project", role: "Full-stack engineer", live: "https://archistud-io.netlify.app",
    lead: "A dual-engine SaaS platform for high-end structural engineering and architecture firms. Chief Architects run the whole practice from one side; clients get a transparent, real-time view of their build on the other.",
    bullets: [
      "Razorpay payments with integrated GST invoicing.",
      "Granular, role-based team management for the firm.",
      "Client side: real-time build updates and native Google Meet scheduling.",
      "A centralised communication hub between the firm and its clients.",
    ],
    metrics: [{ v: "2", l: "engines: firm + client" }, { v: "GST", l: "invoicing" }, { v: "Meet", l: "native scheduling" }],
    tech: ["Spring Boot", "React", "PostgreSQL", "Razorpay", "Google Meet"],
  },
  {
    id: "psk-hi-tech-designers", match: ["psk"], motif: 4, style: INK, kind: "site", tag: "Live",
    title: "PSK Hi-Tech Designers Website", card: "PSK Hi-Tech Designers", tagline: "White-label portfolio and CMS for architects",
    org: "Client site", role: "Full-stack engineer", live: "https://psk-hi-tech-desingers.netlify.app",
    lead: "A white-labelled portfolio platform that gives an architecture firm a premium storefront it controls: a high-end gallery on the front, a custom CMS behind it.",
    bullets: [
      "Chief Architects upload high-res project galleries without touching code.",
      "Edit case studies and update the firm's branding from the CMS.",
      "A gallery front end built to match the spatial care of the firm's work.",
    ],
    metrics: [{ v: "CMS", l: "built in" }, { v: "0", l: "lines of code to update" }, { v: "White", l: "label" }],
    tech: ["React", "Tailwind CSS", "Custom CMS"],
  },
  {
    id: "tailorlyai", match: ["tailorly"], motif: 5, style: GREEN, kind: "site", tag: "Live",
    title: "TailorlyAI", card: "TailorlyAI", tagline: "Job URL in, ATS-ready resume out",
    org: "Personal project", role: "Full-stack engineer", live: "https://tailorlyai.netlify.app",
    lead: "Applying to jobs shouldn't mean hours of rewriting a resume to beat an algorithm. Drop in a job description URL and TailorlyAI does the optimising.",
    bullets: [
      "A custom web scraper extracts the core requirements from the job description URL.",
      "Cross-references them with your existing experience and rewrites the resume.",
      "Exports a perfectly formatted, high-scoring ATS Word document, ready to submit.",
    ],
    metrics: [{ v: "URL", l: "in" }, { v: "ATS", l: "scored" }, { v: ".docx", l: "out" }],
    tech: ["Python", "FastAPI", "React"],
  },
];

const DEFAULT_SLUGS = new Set(defaultProjects.map(projectSlug));

// Static rows, with links / screenshots / case studies from matching CMS rows, plus CMS rows that
// are new (the CMS's untouched placeholder projects are ignored).
export function buildProjects(data) {
  const cms = (data?.projects || []).map((p) => ({ p, slug: projectSlug(p) }));
  const used = new Set();
  const out = BASE.map((b) => {
    const hit = cms.find(({ slug }) => slug === b.id || b.match.some((m) => slug.includes(m)));
    if (!hit) return { ...b };
    used.add(hit.slug);
    const { p, slug } = hit;
    return {
      ...b,
      live: p.live_url || b.live || null,
      source: p.github_url || null,
      image: p.screenshot_url || null,
      caseHref: p.case_study?.trim() ? `/projects/${slug}` : null,
    };
  });
  cms.forEach(({ p, slug }) => {
    if (used.has(slug) || DEFAULT_SLUGS.has(slug)) return;
    const i = out.length;
    out.push({
      id: slug, match: [], motif: i % 6, style: STYLES[i % STYLES.length], kind: "site", tag: p.year || "Live",
      title: p.title, card: p.title, tagline: p.description, org: "", role: p.role || "Engineer",
      lead: p.description, bullets: [], metrics: [], tech: p.tech_stack || [],
      live: p.live_url || null, source: p.github_url || null, image: p.screenshot_url || null,
      caseHref: p.case_study?.trim() ? `/projects/${slug}` : null,
    });
  });
  return out.map((p, i) => ({ ...p, num: String(i + 1).padStart(2, "0"), live: p.live || null, source: p.source || null, caseHref: p.caseHref || null }));
}
