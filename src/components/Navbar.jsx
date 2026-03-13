import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Github, Linkedin, Mail } from "lucide-react";

const iconMap = { github: Github, linkedin: Linkedin, mail: Mail, email: Mail };

export default function Navbar({ socialLinks, sectionOrder }) {
  const [activeHash, setActiveHash] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleSections = (sectionOrder || [])
    .filter((s) => s.visible && s.id !== "hero")
    .sort((a, b) => a.position - b.position);

  useEffect(() => {
    const sections = visibleSections.map((s) => document.getElementById(s.id)).filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActiveHash(visible[0].target.id);
      },
      { threshold: 0.3, rootMargin: "-80px 0px -40% 0px" }
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionOrder]);

  return (
    <>
      <motion.aside
        initial={{ x: -80 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 1.8 }}
        className="fixed left-0 top-0 bottom-0 z-50 hidden lg:flex flex-col items-center justify-between py-6 w-[72px]"
        style={{
          background: "rgba(10,26,10,0.6)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRight: "1px solid var(--c-border)",
        }}
      >
        <a href="#" className="font-mono text-base font-bold" style={{ color: "var(--c-accent-primary)", writingMode: "vertical-lr", letterSpacing: "0.15em" }}>
          DK
        </a>

        <nav className="flex flex-col items-center gap-1">
          {visibleSections.map((section) => {
            const isActive = activeHash === section.id;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="group relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200"
                style={{ background: isActive ? "var(--c-bg-tertiary)" : "transparent" }}
              >
                <span
                  className="absolute left-0 w-[3px] rounded-r-full transition-all duration-300"
                  style={{
                    height: isActive ? "24px" : "0px",
                    background: "var(--c-accent-primary)",
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
                <span
                  className="font-mono text-[10px] uppercase tracking-widest transition-colors duration-200"
                  style={{
                    writingMode: "vertical-lr",
                    color: isActive ? "var(--c-accent-primary)" : "var(--c-text-tertiary)",
                  }}
                >
                  {section.label.slice(0, 3)}
                </span>
                <span
                  className="absolute left-full ml-3 px-2 py-1 rounded text-xs font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200"
                  style={{ background: "var(--c-bg-tertiary)", color: "var(--c-text-primary)", border: "1px solid var(--c-border)" }}
                >
                  {section.label}
                </span>
              </a>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-4">
          {(socialLinks || []).slice(0, 3).map((link) => {
            const Icon = iconMap[link.icon?.toLowerCase()];
            if (!Icon) return null;
            return (
              <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="transition-all duration-200 hover:scale-110"
                style={{ color: "var(--c-text-tertiary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--c-accent-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--c-text-tertiary)")}
                aria-label={link.platform}>
                <Icon size={16} />
              </a>
            );
          })}
          <div className="w-px h-8" style={{ background: "var(--c-border)" }} />
        </div>
      </motion.aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-5"
        style={{ background: "rgba(5,10,5,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--c-border)" }}>
        <a href="#" className="font-mono text-base font-bold" style={{ color: "var(--c-accent-primary)" }}>
          <span style={{ color: "var(--c-text-tertiary)" }}>{"{"}</span>DK<span style={{ color: "var(--c-text-tertiary)" }}>{"}"}</span>
        </a>
        <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          {mobileOpen ? <X size={20} style={{ color: "var(--c-accent-primary)" }} /> : <Menu size={20} style={{ color: "var(--c-accent-primary)" }} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="lg:hidden fixed inset-0 z-40 pt-14"
            style={{ background: "rgba(5,10,5,0.95)", backdropFilter: "blur(20px)" }}
          >
            <nav className="flex flex-col items-center gap-6 pt-12">
              {visibleSections.map((section) => (
                <a key={section.id} href={`#${section.id}`} onClick={() => setMobileOpen(false)}
                  className="font-mono text-lg transition-colors duration-200"
                  style={{ color: activeHash === section.id ? "var(--c-accent-primary)" : "var(--c-text-secondary)" }}>
                  {section.label.toLowerCase()}()
                </a>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
