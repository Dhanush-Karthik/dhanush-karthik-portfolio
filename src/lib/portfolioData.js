import {
  fetchSiteConfig, fetchHero, fetchAbout, fetchSkills,
  fetchExperience, fetchProjects, fetchSocialLinks, fetchContact,
  fetchEducation, fetchTestimonials, fetchSectionOrder, fetchResume,
  fetchSubdomains,
} from "./supabase";
import {
  defaultConfig, defaultHero, defaultAbout, defaultSkills,
  defaultExperience, defaultProjects, defaultSocialLinks, defaultContact,
  defaultEducation, defaultTestimonials, defaultSectionOrder, defaultResume,
  defaultSubdomains,
} from "./defaults";
import { projectSlug } from "./slug";

export const defaultData = {
  config: defaultConfig, hero: defaultHero, about: defaultAbout,
  skills: defaultSkills, experience: defaultExperience,
  education: defaultEducation, projects: defaultProjects,
  testimonials: defaultTestimonials, socialLinks: defaultSocialLinks,
  contact: defaultContact, resume: defaultResume,
  subdomains: defaultSubdomains, sectionOrder: defaultSectionOrder,
};

// Fills gaps left by older databases (no slug column, no "network" section row, no cutout).
export function normalizeData(raw) {
  const d = { ...defaultData, ...raw };
  d.hero = { ...defaultHero, ...d.hero };
  if (!d.hero.cutout_url) { d.hero.cutout_url = defaultHero.cutout_url; d.hero.depth_url = defaultHero.depth_url; }
  d.contact = { ...defaultContact, ...d.contact };
  d.projects = d.projects.map((p) => ({ ...p, slug: projectSlug(p) }));
  d.subdomains = (d.subdomains || []).filter((s) => s.visible !== false);
  if (!d.sectionOrder.some((s) => s.id === "network")) {
    const projects = d.sectionOrder.find((s) => s.id === "projects");
    const pos = projects ? projects.position + 0.5 : d.sectionOrder.length;
    d.sectionOrder = [...d.sectionOrder, { id: "network", label: "Network", position: pos, visible: true }];
  }
  return d;
}

export async function loadPortfolioData() {
  if (!import.meta.env.VITE_SUPABASE_URL) return normalizeData({});
  const [config, hero, about, skills, experience, education, projects, testimonials, socialLinks, contact, resume, sectionOrder, subdomains] =
    await Promise.all([
      fetchSiteConfig(), fetchHero(), fetchAbout(), fetchSkills(),
      fetchExperience(), fetchEducation(), fetchProjects(),
      fetchTestimonials(), fetchSocialLinks(), fetchContact(),
      fetchResume(), fetchSectionOrder(), fetchSubdomains(),
    ]);
  return normalizeData({
    config: config || defaultConfig, hero: hero || defaultHero,
    about: about || defaultAbout,
    skills: skills?.length ? skills : defaultSkills,
    experience: experience?.length ? experience : defaultExperience,
    education: education?.length ? education : defaultEducation,
    projects: projects?.length ? projects : defaultProjects,
    testimonials: testimonials?.length ? testimonials : defaultTestimonials,
    socialLinks: socialLinks?.length ? socialLinks : defaultSocialLinks,
    contact: contact || defaultContact,
    resume: resume || defaultResume,
    sectionOrder: sectionOrder?.length ? sectionOrder : defaultSectionOrder,
    subdomains: subdomains?.length ? subdomains : defaultSubdomains,
  });
}
