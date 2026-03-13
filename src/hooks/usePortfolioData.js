import { useState, useEffect } from "react";
import {
  fetchSiteConfig, fetchHero, fetchAbout, fetchSkills,
  fetchExperience, fetchProjects, fetchSocialLinks, fetchContact,
  fetchEducation, fetchTestimonials, fetchSectionOrder, fetchResume,
} from "../lib/supabase";
import {
  defaultConfig, defaultHero, defaultAbout, defaultSkills,
  defaultExperience, defaultProjects, defaultSocialLinks, defaultContact,
  defaultEducation, defaultTestimonials, defaultSectionOrder, defaultResume,
} from "../lib/defaults";

export function usePortfolioData() {
  const [data, setData] = useState({
    config: defaultConfig, hero: defaultHero, about: defaultAbout,
    skills: defaultSkills, experience: defaultExperience,
    education: defaultEducation, projects: defaultProjects,
    testimonials: defaultTestimonials, socialLinks: defaultSocialLinks,
    contact: defaultContact, resume: defaultResume,
    sectionOrder: defaultSectionOrder, loading: true,
  });

  useEffect(() => {
    async function load() {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        setData((prev) => ({ ...prev, loading: false }));
        return;
      }
      try {
        const [config, hero, about, skills, experience, education, projects, testimonials, socialLinks, contact, resume, sectionOrder] =
          await Promise.all([
            fetchSiteConfig(), fetchHero(), fetchAbout(), fetchSkills(),
            fetchExperience(), fetchEducation(), fetchProjects(),
            fetchTestimonials(), fetchSocialLinks(), fetchContact(),
            fetchResume(), fetchSectionOrder(),
          ]);
        setData({
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
          loading: false,
        });
      } catch {
        setData((prev) => ({ ...prev, loading: false }));
      }
    }
    load();
  }, []);

  return data;
}
