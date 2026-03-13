import { useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import HeroSection from "../components/HeroSection";
import AboutSection from "../components/AboutSection";
import SkillsSection from "../components/SkillsSection";
import ExperienceSection from "../components/ExperienceSection";
import EducationSection from "../components/EducationSection";
import ProjectsSection from "../components/ProjectsSection";
import ResumeSection from "../components/ResumeSection";
import TestimonialsSection from "../components/TestimonialsSection";
import ContactSection from "../components/ContactSection";
import Footer from "../components/Footer";
import LoadingScreen from "../components/LoadingScreen";

const sectionMap = {
  hero: (data) => <HeroSection key="hero" hero={data.hero} />,
  about: (data) => <AboutSection key="about" about={data.about} />,
  skills: (data) => <SkillsSection key="skills" skills={data.skills} />,
  experience: (data) => <ExperienceSection key="experience" experience={data.experience} />,
  education: (data) => <EducationSection key="education" education={data.education} />,
  projects: (data) => <ProjectsSection key="projects" projects={data.projects} />,
  resume: (data) => <ResumeSection key="resume" resume={data.resume} />,
  testimonials: (data) => <TestimonialsSection key="testimonials" testimonials={data.testimonials} />,
  contact: (data) => <ContactSection key="contact" contact={data.contact} />,
};

export default function Portfolio({ data }) {
  const [bootDone, setBootDone] = useState(false);
  const handleBootComplete = useCallback(() => setBootDone(true), []);

  const showLoading = !bootDone || data.loading;

  const { config, socialLinks, sectionOrder } = data;
  const orderedSections = [...sectionOrder].filter((s) => s.visible).sort((a, b) => a.position - b.position);

  return (
    <>
      <Helmet>
        <title>{config.site_title} | {config.site_subtitle}</title>
        <meta name="description" content={config.meta_description} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org", "@type": "Person",
            name: config.site_title || "Dhanush Karthik",
            jobTitle: config.site_subtitle || "Java Backend Engineer",
            url: "https://dhanushkarthik.dev",
            sameAs: socialLinks.map((s) => s.url),
          })}
        </script>
      </Helmet>

      <AnimatePresence>
        {showLoading && <LoadingScreen key="loader" onComplete={handleBootComplete} />}
      </AnimatePresence>

      <div className="relative min-h-screen" style={{ opacity: showLoading ? 0 : 1, transition: "opacity 0.5s ease" }}>
        <div className="fixed inset-0 bg-grid-pattern pointer-events-none" />
        <div className="fixed top-0 left-0 right-0 h-[600px] bg-radial-glow pointer-events-none" />
        <Navbar socialLinks={socialLinks} sectionOrder={sectionOrder} />
        <div className="relative z-10 lg:ml-[72px]">
          {orderedSections.map((section) => { const render = sectionMap[section.id]; return render ? render(data) : null; })}
          <Footer socialLinks={socialLinks} config={config} />
        </div>
      </div>
    </>
  );
}
