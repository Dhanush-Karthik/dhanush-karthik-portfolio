export const SITE = "https://dhanushkarthik.com";
export const PERSON_ID = `${SITE}/#person`;
export const WEBSITE_ID = `${SITE}/#website`;

export function personLd(data) {
  const { config, socialLinks, skills, experience, education, hero } = data;
  const job = experience.find((e) => /present/i.test(e.end_date || "")) || experience[0];
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: "Dhanush Karthik",
    alternateName: ["DhanushKarthik", "Dhanush K"],
    url: `${SITE}/`,
    image: `${SITE}${hero.cutout_url?.startsWith("/") ? hero.cutout_url : "/portrait/dk-cutout.webp"}`,
    jobTitle: config.site_subtitle || "Java Backend Engineer",
    description: config.meta_description,
    ...(job ? { worksFor: { "@type": "Organization", name: job.company } } : {}),
    ...(education[0] ? { alumniOf: { "@type": "EducationalOrganization", name: education[0].university } } : {}),
    knowsAbout: skills.flatMap((s) => s.items || []).slice(0, 24),
    sameAs: [
      ...socialLinks.map((s) => s.url).filter((u) => /^https?:/.test(u)),
      ...data.subdomains.map((d) => `https://${d.host}/`),
    ],
  };
}

export function homeLd(data) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: `${SITE}/`,
        name: "Dhanush Karthik",
        alternateName: ["DhanushKarthik", "dhanushkarthik.com", "Dhanush Karthik Portfolio"],
        publisher: { "@id": PERSON_ID },
        inLanguage: "en",
      },
      {
        "@type": "ProfilePage",
        "@id": `${SITE}/#profile`,
        url: `${SITE}/`,
        name: "Dhanush Karthik — Java Backend Engineer",
        isPartOf: { "@id": WEBSITE_ID },
        mainEntity: { "@id": PERSON_ID },
        hasPart: [
          ...data.projects.map((p) => ({ "@type": "CreativeWork", name: p.title, url: `${SITE}/projects/${p.slug}` })),
          ...data.subdomains.map((d) => ({ "@type": "WebSite", name: `${d.title} — Dhanush Karthik`, url: `https://${d.host}/`, author: { "@id": PERSON_ID } })),
        ],
      },
      personLd(data),
    ],
  };
}

export function projectLd(data, p) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CreativeWork",
        "@id": `${SITE}/projects/${p.slug}#work`,
        name: p.title,
        description: p.description,
        url: `${SITE}/projects/${p.slug}`,
        ...(p.screenshot_url ? { image: p.screenshot_url } : {}),
        ...(p.year ? { dateCreated: p.year } : {}),
        keywords: (p.tech_stack || []).join(", "),
        author: { "@id": PERSON_ID },
        isPartOf: { "@id": WEBSITE_ID },
        ...(p.github_url ? { codeRepository: p.github_url } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Dhanush Karthik", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Projects", item: `${SITE}/#projects` },
          { "@type": "ListItem", position: 3, name: p.title, item: `${SITE}/projects/${p.slug}` },
        ],
      },
      personLd(data),
    ],
  };
}
