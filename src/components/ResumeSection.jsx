import { motion } from "framer-motion";
import { Download, FileText } from "lucide-react";
import { useInView } from "../hooks/useInView";

export default function ResumeSection({ resume }) {
  const [ref, isInView] = useInView({ threshold: 0.15 });

  if (!resume?.file_url) return null;

  return (
    <section id="resume" ref={ref} className="section-container">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7 }}
        className="max-w-2xl mx-auto text-center"
      >
        <p className="section-heading">{"// Resume"}</p>
        <h2 className="section-title">{resume.heading || "Download My Resume"}</h2>
        <p className="text-lg mb-8 -mt-6" style={{ color: "var(--c-text-secondary)" }}>
          {resume.subtext || "Get a detailed overview of my experience, skills, and qualifications."}
        </p>

        <div className="terminal-window inline-block w-full max-w-md">
          <div className="terminal-header">
            <div className="terminal-dot" style={{ background: "#f87171" }} />
            <div className="terminal-dot" style={{ background: "#fbbf24" }} />
            <div className="terminal-dot" style={{ background: "#4ade80" }} />
            <span className="ml-3 text-xs font-mono" style={{ color: "var(--c-text-tertiary)" }}>resume.download()</span>
          </div>
          <div className="p-8 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{ background: "var(--c-bg-tertiary)", border: "1px solid var(--c-border)" }}>
              <FileText size={28} style={{ color: "var(--c-accent-primary)" }} />
            </div>
            <div>
              <p className="font-mono text-sm font-semibold" style={{ color: "var(--c-text-primary)" }}>
                {resume.file_name || "Resume.pdf"}
              </p>
              <p className="font-mono text-xs mt-1" style={{ color: "var(--c-text-tertiary)" }}>PDF Document</p>
            </div>
            <a
              href={resume.file_url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-mono text-sm font-medium transition-all duration-300 hover:scale-105"
              style={{ background: "var(--c-accent-primary)", color: "var(--c-bg-primary)" }}
            >
              <Download size={16} />Download Resume
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
