import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Github, Star, ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { useInView } from "../hooks/useInView";

function Showcase({ project }) {
  const hasScreenshot = project.screenshot_url?.trim();
  const hasLiveUrl = project.live_url?.trim();
  const [showLive, setShowLive] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: "#0a0a0a", border: "1px solid rgba(74,222,128,0.15)", boxShadow: "0 0 60px rgba(74,222,128,0.06), 0 25px 80px rgba(0,0,0,0.5)" }}
    >
      {(hasScreenshot || hasLiveUrl) && (
        <div className="relative overflow-hidden" style={{ height: "360px" }}>
          {showLive && hasLiveUrl ? (
            <iframe src={project.live_url} title={`${project.title} live`}
              className="w-[200%] h-[200%] origin-top-left pointer-events-auto"
              style={{ transform: "scale(0.5)", border: "none" }}
              sandbox="allow-scripts allow-same-origin" />
          ) : hasScreenshot ? (
            <img src={project.screenshot_url} alt={project.title} className="w-full h-full object-cover object-top" />
          ) : hasLiveUrl ? (
            <iframe src={project.live_url} title={`${project.title} live`}
              className="w-[200%] h-[200%] origin-top-left pointer-events-auto"
              style={{ transform: "scale(0.5)", border: "none" }}
              sandbox="allow-scripts allow-same-origin" />
          ) : null}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, #0a0a0a 0%, transparent 40%)" }} />

          {project.featured && (
            <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[9px] uppercase tracking-wider"
              style={{ background: "rgba(251,191,36,0.15)", color: "var(--c-accent-tertiary)", border: "1px solid rgba(251,191,36,0.25)", backdropFilter: "blur(8px)" }}>
              <Star size={9} fill="currentColor" />Featured
            </div>
          )}

          {hasLiveUrl && hasScreenshot && (
            <button onClick={() => setShowLive(!showLive)}
              className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[9px] uppercase tracking-wider transition-all duration-200"
              style={{ background: showLive ? "var(--c-accent-primary)" : "rgba(0,0,0,0.6)", color: showLive ? "#000" : "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Globe size={9} />{showLive ? "Screenshot" : "Live Preview"}
            </button>
          )}
        </div>
      )}

      <div className="p-7 pt-3">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#fff" }}>{project.title}</h3>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            {project.github_url && (
              <a href={project.github_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-mono text-xs transition-all duration-200"
                style={{ border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--c-accent-primary)"; e.currentTarget.style.color = "var(--c-accent-primary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}>
                <Github size={14} />Source
              </a>
            )}
            {hasLiveUrl && (
              <a href={project.live_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-mono text-xs"
                style={{ background: "var(--c-accent-primary)", color: "#000" }}>
                <ExternalLink size={14} />Live
              </a>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>{project.description}</p>
        {project.tech_stack && (
          <div className="flex flex-wrap gap-2">
            {project.tech_stack.map((tech) => (
              <span key={tech} className="font-mono text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.04)", color: "var(--c-accent-primary)", border: "1px solid rgba(74,222,128,0.1)" }}>
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Thumbnail({ project, isActive, onClick, index }) {
  const hasScreenshot = project.screenshot_url?.trim();

  return (
    <motion.div
      onClick={onClick}
      className="flex-shrink-0 cursor-pointer relative group"
      style={{ width: "260px", scrollSnapAlign: "start" }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="rounded-xl overflow-hidden transition-all duration-300"
        style={{
          background: "#0a0a0a",
          border: isActive ? "1px solid var(--c-accent-primary)" : "1px solid rgba(255,255,255,0.04)",
          boxShadow: isActive ? "0 0 25px rgba(74,222,128,0.1)" : "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <div className="relative overflow-hidden" style={{ height: "130px" }}>
          {hasScreenshot ? (
            <img src={project.screenshot_url} alt={project.title}
              className="w-full h-full object-cover object-top transition-all duration-500"
              style={{ filter: isActive ? "brightness(1) saturate(1)" : "brightness(0.4) saturate(0.5)" }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: isActive ? "rgba(74,222,128,0.05)" : "rgba(255,255,255,0.015)" }}>
              <Globe size={20} style={{ color: isActive ? "var(--c-accent-primary)" : "rgba(255,255,255,0.1)" }} />
            </div>
          )}
          <div className="absolute inset-0 transition-opacity duration-300" style={{
            background: "linear-gradient(135deg, transparent 40%, #0a0a0a 100%)",
            opacity: isActive ? 0.3 : 0.7,
          }} />

          {isActive && (
            <motion.div
              layoutId="activeIndicator"
              className="absolute bottom-0 left-0 right-0 h-[2px]"
              style={{ background: "var(--c-accent-primary)" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}

          <div className="absolute top-2 left-2.5 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{
              background: isActive ? "var(--c-accent-primary)" : "rgba(255,255,255,0.08)",
              color: isActive ? "#000" : "rgba(255,255,255,0.4)",
            }}>
            {String(index + 1).padStart(2, "0")}
          </div>

          {project.featured && (
            <Star size={10} fill="var(--c-accent-tertiary)" className="absolute top-2 right-2.5" style={{ color: "var(--c-accent-tertiary)", opacity: isActive ? 1 : 0.4 }} />
          )}
        </div>

        <div className="px-3.5 py-3">
          <h4 className="font-mono text-[11px] font-semibold truncate transition-colors duration-200"
            style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.45)" }}>
            {project.title}
          </h4>
          <div className="flex gap-1.5 mt-2">
            {(project.tech_stack || []).slice(0, 3).map((t) => (
              <span key={t} className="font-mono text-[8px] px-1.5 py-0.5 rounded transition-colors duration-200"
                style={{
                  background: isActive ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.03)",
                  color: isActive ? "var(--c-accent-primary)" : "rgba(255,255,255,0.25)",
                  border: `1px solid ${isActive ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.03)"}`,
                }}>
                {t}
              </span>
            ))}
            {(project.tech_stack || []).length > 3 && (
              <span className="font-mono text-[8px] py-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>+{project.tech_stack.length - 3}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function HiddenIframePreloader({ projects }) {
  const liveProjects = projects.filter((p) => p.live_url?.trim());
  if (!liveProjects.length) return null;

  return (
    <div className="fixed" style={{ width: 0, height: 0, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
      {liveProjects.map((p) => (
        <iframe key={p.id || p.live_url} src={p.live_url} title="preload"
          sandbox="allow-scripts allow-same-origin" style={{ width: "1px", height: "1px" }} />
      ))}
    </div>
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

  useEffect(() => {
    if (scrollRef.current) {
      const thumb = scrollRef.current.children[activeIdx];
      if (thumb) {
        const container = scrollRef.current;
        const scrollLeft = thumb.offsetLeft - container.offsetWidth / 2 + thumb.offsetWidth / 2;
        container.scrollTo({ left: scrollLeft, behavior: "smooth" });
      }
    }
  }, [activeIdx]);

  function navigate(dir) {
    setActiveIdx((prev) => {
      const next = prev + dir;
      if (next < 0) return sorted.length - 1;
      if (next >= sorted.length) return 0;
      return next;
    });
  }

  return (
    <section id="projects" ref={ref} className="section-container">
      <HiddenIframePreloader projects={sorted} />
      <motion.div initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}>
        <p className="section-heading">{"// Projects"}</p>
        <h2 className="section-title">Featured Work</h2>

        <AnimatePresence mode="wait">
          <Showcase key={activeProject?.id || activeIdx} project={activeProject} />
        </AnimatePresence>

        {sorted.length > 1 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-wider" style={{ color: "var(--c-text-tertiary)" }}>
                  {String(activeIdx + 1).padStart(2, "0")} / {String(sorted.length).padStart(2, "0")}
                </span>
                <div className="flex gap-0.5">
                  {sorted.map((_, idx) => (
                    <button key={idx} onClick={() => setActiveIdx(idx)}
                      className="h-1 rounded-full transition-all duration-300"
                      style={{
                        width: idx === activeIdx ? "24px" : "8px",
                        background: idx === activeIdx ? "var(--c-accent-primary)" : "rgba(255,255,255,0.1)",
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigate(-1)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--c-text-secondary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--c-accent-primary)"; e.currentTarget.style.color = "var(--c-accent-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "var(--c-text-secondary)"; }}>
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => navigate(1)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--c-text-secondary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--c-accent-primary)"; e.currentTarget.style.color = "var(--c-accent-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "var(--c-text-secondary)"; }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide" style={{ scrollSnapType: "x mandatory" }}>
              {sorted.map((project, idx) => (
                <Thumbnail key={project.id || idx} project={project} isActive={idx === activeIdx} onClick={() => setActiveIdx(idx)} index={idx} />
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </section>
  );
}
