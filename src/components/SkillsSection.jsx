import { motion } from "framer-motion";
import { Code, Layers, Server, Database, Shield, GitBranch } from "lucide-react";
import { useInView } from "../hooks/useInView";

const iconMap = { code: Code, layers: Layers, server: Server, database: Database, shield: Shield, "git-branch": GitBranch };

export default function SkillsSection({ skills }) {
  const [ref, isInView] = useInView({ threshold: 0.1 });

  return (
    <section id="skills" ref={ref} className="section-container">
      <motion.div initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}>
        <p className="section-heading">{"// Skills"}</p>
        <h2 className="section-title">Tech Stack</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.map((skill, idx) => {
            const Icon = iconMap[skill.icon] || Code;
            return (
              <motion.div key={skill.id || idx} initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: idx * 0.1 }} className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg" style={{ background: "var(--c-bg-tertiary)" }}>
                    <Icon size={20} style={{ color: "var(--c-accent-primary)" }} />
                  </div>
                  <h3 className="font-mono text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--c-text-primary)" }}>{skill.category}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(skill.items || []).map((item) => (
                    <span key={item} className="font-mono text-xs px-3 py-1.5 rounded-md" style={{ background: "var(--c-bg-primary)", color: "var(--c-text-secondary)", border: "1px solid var(--c-border)" }}>{item}</span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
