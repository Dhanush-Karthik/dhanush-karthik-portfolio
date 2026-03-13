import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Github, Star, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useInView } from "../hooks/useInView";

function ProjectCard({ project, isActive, onClick }) {
  const hasScreenshot = project.screenshot_url?.trim();
  const hasLiveUrl = project.live_url?.trim();

  return (
    <motion.div
      layout
      onClick={onClick}
      className={`flex-shrink-0 rounded-xl overflow-hidden cursor-pointer transition-all duration-400 ${isActive ? "ring-1" : ""}`}
      style={{
        width: isActive ? "100%" : "320px",
        background: "#0c0c0c",
        border: isActive ? "1px solid var(--c-accent-primary)" : "1px solid rgba(255,255,255,0.06)",
        boxShadow: isActive ? "0 0 50px rgba(74,222,128,0.08)" : "none",
        ringColor: "var(--c-accent-primary)",
      }}
      whileHover={!isActive ? { y: -4, borderColor: "rgba(255,255,255,0.12)" } : {}}
    >
      {hasScreenshot || hasLiveUrl ? (
        <div className="relative overflow-hidden" style={{ height: isActive ? "340px" : "180px" }}>
          {hasScreenshot ? (
            <img src={project.screenshot_url} alt={project.title}
              className="w-full h-full object-cover object-top transition-transform duration-700"
              style={{ filter: isActive ? "none" : "brightness(0.7)" }}
            />
          ) : hasLiveUrl ? (
            <iframe src={project.live_url} title={project.title}
              className="w-[200%] h-[200%] origin-top-left"
              style={{ transform: "scale(0.5)", border: "none", pointerEvents: isActive ? "auto" : "none" }}
              sandbox="allow-scripts allow-same-origin" loading="lazy" />
          ) : null}
          <div className="absolute inset-0" style={{
            background: isActive
              ? "linear-gradient(to top, #0c0c0c 0%, transparent 50%)"
              : "linear-gradient(to top, #0c0c0c 5%, rgba(12,12,12,0.4) 60%, transparent 100%)"
          }} />
          {project.featured && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-wider"
              style={{ background: "rgba(251,191,36,0.15)", color: "var(--c-accent-tertiary)", border: "1px solid rgba(251,191,36,0.25)" }}>
              <Star size={8} fill="currentColor" />Featured
            </div>
          )}
          {!isActive && (
            <div className="absolute bottom-3 left-4 right-4">
              <h3 className="text-base font-bold truncate" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#fff" }}>{project.title}</h3>
              <div className="flex gap-1.5 mt-2">
                {(project.tech_stack || []).slice(0, 3).map((t) => (
                  <span key={t} className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>{t}</span>
                ))}
                {(project.tech_stack || []).length > 3 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ color: "rgba(255,255,255,0.35)" }}>+{project.tech_stack.length - 3}</span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center font-mono text-sm" style={{ height: isActive ? "200px" : "180px", color: "var(--c-text-tertiary)", background: "rgba(255,255,255,0.02)" }}>
          {!isActive && <span className="text-base font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#fff" }}>{project.title}</span>}
        </div>
      )}

      {isActive && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="p-6 pt-2">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#fff" }}>{project.title}</h3>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              {project.github_url && (
                <a href={project.github_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-all duration-200"
                  style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--c-accent-primary)"; e.currentTarget.style.color = "var(--c-accent-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}>
                  <Github size={14} />Source
                </a>
              )}
              {hasLiveUrl && (
                <a href={project.live_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs"
                  style={{ background: "var(--c-accent-primary)", color: "#000" }}>
                  <ExternalLink size={14} />Live
                </a>
              )}
            </div>
          </div>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.55)" }}>{project.description}</p>
          {project.tech_stack && (
            <div className="flex flex-wrap gap-2">
              {project.tech_stack.map((tech) => (
                <span key={tech} className="font-mono text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.04)", color: "var(--c-accent-primary)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {tech}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

export default function ProjectsSection({ projects }) {
  const [ref, isInView] = useInView({ threshold: 0.05 });
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef(null);

  const featured = projects.filter((p) => p.featured);
  const others = projects.filter((p) => !p.featured);
  const sorted = [...featured, ...others];
  const activeProject = sorted[activeIdx];

  function scrollStrip(dir) {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 340, behavior: "smooth" });
    }
  }

  return (
    <section id="projects" ref={ref} className="section-container">
      <motion.div initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}>
        <p className="section-heading">{"// Projects"}</p>
        <h2 className="section-title">Featured Work</h2>

        <AnimatePresence mode="wait">
          <ProjectCard key={activeProject?.id || activeIdx} project={activeProject} isActive={true} onClick={() => {}} />
        </AnimatePresence>

        {sorted.length > 1 && (
          <div className="mt-6 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs uppercase tracking-wider" style={{ color: "var(--c-text-tertiary)" }}>
                {activeIdx + 1} / {sorted.length} projects
              </span>
              <div className="flex gap-2">
                <button onClick={() => scrollStrip(-1)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--c-text-secondary)" }}>
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => scrollStrip(1)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--c-text-secondary)" }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide" style={{ scrollSnapType: "x mandatory" }}>
              {sorted.map((project, idx) => (
                <div key={project.id || idx} className="flex-shrink-0" style={{ scrollSnapAlign: "start" }}>
                  <div
                    onClick={() => setActiveIdx(idx)}
                    className={`w-[300px] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${idx === activeIdx ? "ring-2" : ""}`}
                    style={{
                      background: "#0c0c0c",
                      border: idx === activeIdx ? "1px solid var(--c-accent-primary)" : "1px solid rgba(255,255,255,0.05)",
                      ringColor: "var(--c-accent-primary)",
                      opacity: idx === activeIdx ? 1 : 0.7,
                      transform: idx === activeIdx ? "scale(1)" : "scale(0.97)",
                    }}
                    onMouseEnter={(e) => { if (idx !== activeIdx) e.currentTarget.style.opacity = "0.9"; }}
                    onMouseLeave={(e) => { if (idx !== activeIdx) e.currentTarget.style.opacity = "0.7"; }}
                  >
                    {project.screenshot_url?.trim() ? (
                      <div className="relative h-[140px] overflow-hidden">
                        <img src={project.screenshot_url} alt={project.title} className="w-full h-full object-cover object-top" style={{ filter: idx === activeIdx ? "none" : "brightness(0.5) saturate(0.7)" }} />
                        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #0c0c0c 5%, transparent 70%)" }} />
                      </div>
                    ) : (
                      <div className="h-[60px]" style={{ background: "rgba(255,255,255,0.02)" }} />
                    )}
                    <div className="px-4 pb-3 pt-1">
                      <h4 className="font-mono text-xs font-semibold truncate" style={{ color: idx === activeIdx ? "var(--c-accent-primary)" : "rgba(255,255,255,0.6)" }}>
                        {project.title}
                      </h4>
                      <div className="flex gap-1 mt-1.5">
                        {(project.tech_stack || []).slice(0, 2).map((t) => (
                          <span key={t} className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </section>
  );
}
