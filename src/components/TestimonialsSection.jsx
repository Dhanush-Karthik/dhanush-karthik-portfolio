import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { useInView } from "../hooks/useInView";

export default function TestimonialsSection({ testimonials }) {
  const [ref, isInView] = useInView({ threshold: 0.1 });

  if (!testimonials?.length) return null;

  return (
    <section id="testimonials" ref={ref} className="section-container">
      <motion.div initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}>
        <p className="section-heading">{"// Testimonials"}</p>
        <h2 className="section-title">What People Say</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((t, idx) => (
            <motion.div
              key={t.id || idx}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: idx * 0.12 }}
              className="glass-card p-6 relative"
            >
              <Quote size={32} className="absolute top-4 right-4 opacity-10" style={{ color: "var(--c-accent-primary)" }} />
              <p className="text-sm leading-relaxed mb-5 italic" style={{ color: "var(--c-text-secondary)" }}>
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3">
                {t.avatar_url ? (
                  <img src={t.avatar_url} alt={t.name} className="w-10 h-10 rounded-full object-cover" style={{ border: "2px solid var(--c-border)" }} />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm font-bold" style={{ background: "var(--c-bg-tertiary)", color: "var(--c-accent-primary)", border: "2px solid var(--c-border)" }}>
                    {t.name?.charAt(0) || "?"}
                  </div>
                )}
                <div>
                  <div className="font-mono text-sm font-semibold" style={{ color: "var(--c-text-primary)" }}>{t.name}</div>
                  <div className="font-mono text-xs" style={{ color: "var(--c-text-tertiary)" }}>
                    {t.role}{t.company ? ` @ ${t.company}` : ""}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
