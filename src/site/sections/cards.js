// The card deck shared by the 3D fan and the HTML grid: portrait card, projects, then subdomains.
export const CARD_STYLES = [
  { bg: "#07110A", fg: "#4ADE80", accent: "#CFE3D4" },
  { bg: "#E5432D", fg: "#FFFFFF", accent: "#111311" },
  { bg: "#FBFAF6", fg: "#111311", accent: "#E5432D" },
  { bg: "#F2C94C", fg: "#111311", accent: "#111311" },
];

export function buildDeck(data) {
  const cards = [];
  cards.push({ kind: "me", key: "me", title: "Dhanush Karthik", sub: data.config.site_subtitle || "Java Backend Engineer", image: data.hero.cutout_url, href: "#about", style: CARD_STYLES[1] });
  data.projects.forEach((p, i) => cards.push({
    kind: "project", key: `p-${p.slug}`, num: String(i + 1).padStart(2, "0"), title: p.title, sub: p.description,
    year: p.year, stack: p.tech_stack || [], image: p.screenshot_url, href: `/projects/${p.slug}`,
    style: CARD_STYLES[(i + 2) % CARD_STYLES.length],
  }));
  data.subdomains.forEach((d, i) => cards.push({
    kind: "subdomain", key: `s-${d.host}`, num: "sub", title: d.title || d.host, sub: d.description, year: d.host,
    stack: d.tags || [], image: d.screenshot_url, href: `https://${d.host}`, external: true,
    style: CARD_STYLES[(i + 1 + data.projects.length) % CARD_STYLES.length],
  }));
  return cards;
}
