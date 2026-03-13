import { motion } from "framer-motion";
import { useInView } from "../hooks/useInView";

export default function AboutSection({ about }) {
  const [ref, isInView] = useInView({ threshold: 0.15 });
  const stats = about.stats || [];

  return (
    <section id="about" ref={ref} className="section-container">
      <motion.div initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}>
        <p className="section-heading">{"// About"}</p>
        <h2 className="section-title">{about.title || "About Me"}</h2>
        <div className="grid md:grid-cols-3 gap-12">
          <div className="md:col-span-2">
            {about.bio?.split("\n").map((paragraph, idx) => (
              <p key={idx} className="mb-4 text-lg leading-relaxed" style={{ color: "var(--c-text-secondary)" }}>{paragraph}</p>
            ))}
          </div>
          <div className="space-y-4">
            {stats.map((stat, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, x: 20 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5, delay: 0.2 + idx * 0.1 }} className="glass-card p-5">
                <div className="font-mono text-2xl font-bold mb-1" style={{ color: "var(--c-accent-primary)" }}>{stat.value}</div>
                <div className="font-mono text-xs uppercase tracking-wider" style={{ color: "var(--c-text-tertiary)" }}>{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
