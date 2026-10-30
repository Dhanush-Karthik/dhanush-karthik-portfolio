import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useSite } from "../SiteContext";
import { homeLd, SITE } from "../lib/seo";
import { SECTION_META } from "../sections/meta";
import Hero from "../sections/Hero";
import About from "../sections/About";
import Skills from "../sections/Skills";
import Experience from "../sections/Experience";
import Education from "../sections/Education";
import Projects from "../sections/Projects";
import Network from "../sections/Network";
import Resume from "../sections/Resume";
import Testimonials from "../sections/Testimonials";
import Contact from "../sections/Contact";

const SECTIONS = { hero: Hero, about: About, skills: Skills, experience: Experience, education: Education, projects: Projects, network: Network, resume: Resume, testimonials: Testimonials, contact: Contact };

export default function Home({ sections }) {
  const { data, setActive } = useSite();
  const { config } = data;
  const title = `Dhanush Karthik — ${config.site_subtitle || "Java Backend Engineer"}`;
  const desc = config.meta_description || "Dhanush Karthik is a Java Backend Engineer building Spring Boot microservices, Keycloak IAM and REST APIs.";

  // HUD path follows the frame closest to the middle of the screen.
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: "-48% 0px -48% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections, setActive]);

  // Arriving with a #hash from another route.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView(), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={`${SITE}/`} />
        <meta property="og:type" content="profile" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={`${SITE}/`} />
        <meta property="og:image" content={`${SITE}/og-image.png`} />
        <meta property="profile:first_name" content="Dhanush" />
        <meta property="profile:last_name" content="Karthik" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={desc} />
        <script type="application/ld+json">{JSON.stringify(homeLd(data))}</script>
      </Helmet>
      <main>
        {sections.map((s, i) => {
          const C = SECTIONS[s.id];
          if (!C) return null;
          const prev = i > 0 ? SECTION_META[sections[i - 1].id]?.variant : null;
          return <C key={s.id} data={data} line={i + 1} prev={prev} />;
        })}
      </main>
    </>
  );
}
