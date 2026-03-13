import { motion } from "framer-motion";
import { GraduationCap, MapPin } from "lucide-react";
import { useInView } from "../hooks/useInView";

export default function EducationSection({ education }) {
  const [ref, isInView] = useInView({ threshold: 0.1 });

  return (
    <section id="education" ref={ref} className="section-container">
      <motion.div initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}>
        <p className="section-heading">{"// Education"}</p>
        <h2 className="section-title">Academic Background</h2>
        <div className="relative">
          <div className="absolute left-0 md:left-8 top-0 bottom-0 w-px" style={{ background: "var(--c-border)" }} />
          <div className="space-y-10">
            {education.map((edu, idx) => (
              <motion.div key={edu.id || idx} initial={{ opacity: 0, x: -20 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5, delay: idx * 0.15 }} className="relative pl-8 md:pl-20">
                <div className="absolute left-0 md:left-8 top-1 -translate-x-1/2 w-3 h-3 rounded-full border-2" style={{ borderColor: "var(--c-accent-secondary)", background: idx === 0 ? "var(--c-accent-secondary)" : "var(--c-bg-primary)" }} />
                <div className="glass-card p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--c-text-primary)" }}>{edu.degree}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <GraduationCap size={14} style={{ color: "var(--c-accent-secondary)" }} />
                        <span className="font-mono text-sm" style={{ color: "var(--c-accent-secondary)" }}>{edu.university}</span>
                      </div>
                      {edu.location && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <MapPin size={12} style={{ color: "var(--c-text-tertiary)" }} />
                          <span className="font-mono text-xs" style={{ color: "var(--c-text-tertiary)" }}>{edu.location}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 mt-2 md:mt-0">
                      <span className="font-mono text-xs px-3 py-1 rounded-full" style={{ background: "var(--c-bg-tertiary)", color: "var(--c-text-secondary)" }}>
                        {edu.start_date} — {edu.end_date}
                      </span>
                      {edu.grade && (
                        <span className="font-mono text-xs px-3 py-1 rounded-full font-semibold" style={{ background: "rgba(34,211,238,0.1)", color: "var(--c-accent-secondary)", border: "1px solid rgba(34,211,238,0.2)" }}>
                          {edu.grade}
                        </span>
                      )}
                    </div>
                  </div>
                  {edu.description && <p className="text-sm leading-relaxed mt-3" style={{ color: "var(--c-text-secondary)" }}>{edu.description}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
