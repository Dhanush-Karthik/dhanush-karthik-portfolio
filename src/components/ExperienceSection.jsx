import { motion } from "framer-motion";
import { Briefcase } from "lucide-react";
import { useInView } from "../hooks/useInView";

export default function ExperienceSection({ experience }) {
  const [ref, isInView] = useInView({ threshold: 0.1 });

  return (
    <section id="experience" ref={ref} className="section-container">
      <motion.div initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}>
        <p className="section-heading">{"// Experience"}</p>
        <h2 className="section-title">Work History</h2>
        <div className="relative">
          <div className="absolute left-0 md:left-8 top-0 bottom-0 w-px" style={{ background: "var(--c-border)" }} />
          <div className="space-y-12">
            {experience.map((exp, idx) => (
              <motion.div key={exp.id || idx} initial={{ opacity: 0, x: -20 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5, delay: idx * 0.15 }} className="relative pl-8 md:pl-20">
                <div className="absolute left-0 md:left-8 top-1 -translate-x-1/2 w-3 h-3 rounded-full border-2" style={{ borderColor: "var(--c-accent-primary)", background: idx === 0 ? "var(--c-accent-primary)" : "var(--c-bg-primary)" }} />
                <div className="glass-card p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--c-text-primary)" }}>{exp.role}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Briefcase size={14} style={{ color: "var(--c-accent-primary)" }} />
                        <span className="font-mono text-sm" style={{ color: "var(--c-accent-primary)" }}>{exp.company}</span>
                        {exp.location && <span className="font-mono text-xs" style={{ color: "var(--c-text-tertiary)" }}>· {exp.location}</span>}
                      </div>
                    </div>
                    <span className="font-mono text-xs mt-2 md:mt-0 px-3 py-1 rounded-full" style={{ background: "var(--c-bg-tertiary)", color: "var(--c-text-secondary)" }}>{exp.start_date} — {exp.end_date}</span>
                  </div>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--c-text-secondary)" }}>{exp.description}</p>
                  {exp.tech_stack && (
                    <div className="flex flex-wrap gap-2">
                      {exp.tech_stack.map((tech) => (
                        <span key={tech} className="font-mono text-xs px-2 py-1 rounded" style={{ background: "var(--c-bg-primary)", color: "var(--c-accent-secondary)", border: "1px solid var(--c-border)" }}>{tech}</span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
