import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Github, Star, Maximize2, X } from "lucide-react";
import { useInView } from "../hooks/useInView";

function ProjectCard({ project, idx, isInView }) {
  const [previewMode, setPreviewMode] = useState("screenshot");
  const hasLiveUrl = project.live_url && project.live_url.trim();
  const hasScreenshot = project.screenshot_url && project.screenshot_url.trim();
  const hasPreview = hasLiveUrl || hasScreenshot;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: idx * 0.15 }}
      className="group rounded-2xl overflow-hidden"
      style={{ background: "var(--c-bg-secondary)", border: "1px solid var(--c-border)", transition: "all 0.4s ease" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--c-accent-primary)"; e.currentTarget.style.boxShadow = "0 0 40px var(--c-accent-primary-glow), 0 20px 60px rgba(0,0,0,0.4)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--c-border)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {hasPreview && (
        <div className="relative w-full overflow-hidden" style={{ height: "280px", background: "var(--c-bg-primary)" }}>
          {previewMode === "live" && hasLiveUrl ? (
            <iframe
              src={project.live_url}
              title={`${project.title} preview`}
              className="w-[200%] h-[200%] origin-top-left pointer-events-auto"
              style={{ transform: "scale(0.5)", border: "none" }}
              sandbox="allow-scripts allow-same-origin"
              loading="lazy"
            />
          ) : hasScreenshot ? (
            <img src={project.screenshot_url} alt={project.title} className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
          ) : hasLiveUrl ? (
            <iframe
              src={project.live_url}
              title={`${project.title} preview`}
              className="w-[200%] h-[200%] origin-top-left pointer-events-auto"
              style={{ transform: "scale(0.5)", border: "none" }}
              sandbox="allow-scripts allow-same-origin"
              loading="lazy"
            />
          ) : null}

          <div className="absolute inset-0 bg-gradient-to-t from-[var(--c-bg-secondary)] via-transparent to-transparent" />

          {hasLiveUrl && hasScreenshot && (
            <div className="absolute top-3 right-3 flex gap-1.5">
              <button
                onClick={() => setPreviewMode("screenshot")}
                className="px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-all duration-200"
                style={{ background: previewMode === "screenshot" ? "var(--c-accent-primary)" : "rgba(0,0,0,0.6)", color: previewMode === "screenshot" ? "var(--c-bg-primary)" : "var(--c-text-secondary)" }}
              >
                Image
              </button>
              <button
                onClick={() => setPreviewMode("live")}
                className="px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-all duration-200"
                style={{ background: previewMode === "live" ? "var(--c-accent-primary)" : "rgba(0,0,0,0.6)", color: previewMode === "live" ? "var(--c-bg-primary)" : "var(--c-text-secondary)" }}
              >
                Live
              </button>
            </div>
          )}

          {project.featured && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider"
              style={{ background: "rgba(251,191,36,0.15)", color: "var(--c-accent-tertiary)", border: "1px solid rgba(251,191,36,0.3)" }}>
              <Star size={10} fill="currentColor" />Featured
            </div>
          )}
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--c-text-primary)" }}>
            {project.title}
          </h3>
          <div className="flex items-center gap-3 ml-4 flex-shrink-0">
            {project.github_url && (
              <a href={project.github_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-all duration-200"
                style={{ border: "1px solid var(--c-border)", color: "var(--c-text-secondary)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--c-accent-primary)"; e.currentTarget.style.color = "var(--c-accent-primary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--c-border)"; e.currentTarget.style.color = "var(--c-text-secondary)"; }}>
                <Github size={14} />Source
              </a>
            )}
            {hasLiveUrl && (
              <a href={project.live_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-all duration-200"
                style={{ background: "var(--c-accent-primary)", color: "var(--c-bg-primary)" }}>
                <ExternalLink size={14} />Live
              </a>
            )}
          </div>
        </div>

        <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--c-text-secondary)" }}>
          {project.description}
        </p>

        {project.tech_stack && (
          <div className="flex flex-wrap gap-2">
            {project.tech_stack.map((tech) => (
              <span key={tech} className="font-mono text-xs px-3 py-1.5 rounded-lg transition-colors duration-200"
                style={{ background: "var(--c-bg-tertiary)", color: "var(--c-accent-primary)", border: "1px solid var(--c-border)" }}>
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ProjectsSection({ projects }) {
  const [ref, isInView] = useInView({ threshold: 0.05 });

  return (
    <section id="projects" ref={ref} className="section-container">
      <motion.div initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}>
        <p className="section-heading">{"// Projects"}</p>
        <h2 className="section-title">Featured Work</h2>
        <div className="space-y-8">
          {projects.map((project, idx) => (
            <ProjectCard key={project.id || idx} project={project} idx={idx} isInView={isInView} />
          ))}
        </div>
      </motion.div>
    </section>
  );
}
