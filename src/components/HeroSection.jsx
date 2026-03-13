import { motion } from "framer-motion";
import { ArrowDown, Terminal } from "lucide-react";

export default function HeroSection({ hero }) {
  const hasPhoto = hero.photo_url && hero.photo_url.trim();

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center px-6 pt-20 lg:pt-6">
      <div className="max-w-5xl w-full flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
        {hasPhoto && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 1.3 }}
            className="relative flex-shrink-0 flex justify-center"
          >
            <div className="w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 lg:w-56 lg:h-56 rounded-2xl overflow-hidden"
              style={{ border: "2px solid var(--c-border)", boxShadow: "0 0 40px var(--c-accent-primary-glow)" }}>
              <img src={hero.photo_url} alt="Dhanush Karthik" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 sm:-bottom-2 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full animate-pulse" style={{ background: "var(--c-accent-primary)", boxShadow: "0 0 12px var(--c-accent-primary)" }} />
          </motion.div>
        )}

        <div className="flex-1 w-full">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1.5 }} className="terminal-window">
            <div className="terminal-header">
              <div className="terminal-dot" style={{ background: "#f87171" }} />
              <div className="terminal-dot" style={{ background: "#fbbf24" }} />
              <div className="terminal-dot" style={{ background: "#4ade80" }} />
              <span className="ml-3 text-xs font-mono" style={{ color: "var(--c-text-tertiary)" }}>DhanushKarthik.java</span>
            </div>
            <div className="terminal-body">
              <div className="mb-1"><span className="code-comment">{"// Welcome to my portfolio"}</span></div>
              <div className="mb-3 md:mb-4">
                <span className="code-keyword">public class </span>
                <span className="code-class text-xl sm:text-2xl md:text-4xl font-bold">{hero.name || "DhanushKarthik"}</span>
              </div>
              <div className="mb-3 md:mb-4 pl-3 sm:pl-4 md:pl-8">
                <span className="code-keyword">extends </span>
                <span className="code-class text-lg sm:text-xl md:text-2xl">{hero.tagline || "BackendEngineer"}</span>
                <span style={{ color: "var(--c-text-tertiary)" }}> {"{"}</span>
              </div>
              <div className="pl-3 sm:pl-4 md:pl-8 mb-4 md:mb-6">
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2, duration: 0.8 }} className="text-sm sm:text-base md:text-lg leading-relaxed max-w-2xl" style={{ color: "var(--c-text-secondary)" }}>
                  <span className="code-comment">{"/* "}</span>
                  {hero.description}
                  <span className="code-comment">{" */"}</span>
                </motion.p>
              </div>
              <div className="pl-3 sm:pl-4 md:pl-8 mb-2"><span style={{ color: "var(--c-text-tertiary)" }}>{"}"}</span></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.8, duration: 0.6 }} className="mt-6 md:mt-8 flex flex-wrap gap-4 justify-center lg:justify-start">
            <a href={hero.cta_link || "#projects"} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-mono text-sm font-medium transition-all duration-300 hover:scale-105" style={{ background: "var(--c-accent-primary)", color: "var(--c-bg-primary)" }}>
              <Terminal size={16} />{hero.cta_text || "View My Work"}
            </a>
          </motion.div>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.2 }} className="absolute bottom-10 left-1/2 -translate-x-1/2">
        <a href="#about" aria-label="Scroll down"><ArrowDown size={20} className="animate-bounce" style={{ color: "var(--c-text-tertiary)" }} /></a>
      </motion.div>
    </section>
  );
}
