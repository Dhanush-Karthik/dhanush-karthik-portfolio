import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

const bootLines = [
  "$ java -version",
  "openjdk 21.0.2 2024-01-16",
  "$ mvn spring-boot:run",
  "  .   ____          _",
  "  :: Spring Boot :: (v3.2.4)",
  "Loading beans...",
  "Tomcat started on port 8080",
  "Application ready ✓",
];

export default function LoadingScreen({ onComplete }) {
  const [lines, setLines] = useState([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= bootLines.length) {
        clearInterval(interval);
        setTimeout(() => onCompleteRef.current?.(), 400);
        return;
      }
      const line = bootLines[idx];
      idx++;
      setLines((prev) => [...prev, line]);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "var(--c-bg-primary)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="terminal-window w-full max-w-xl mx-4">
        <div className="terminal-header">
          <div className="terminal-dot" style={{ background: "#f87171" }} />
          <div className="terminal-dot" style={{ background: "#fbbf24" }} />
          <div className="terminal-dot" style={{ background: "#4ade80" }} />
          <span className="ml-3 text-xs font-mono" style={{ color: "var(--c-text-tertiary)" }}>
            dk-portfolio — boot
          </span>
        </div>
        <div className="terminal-body min-h-[240px]">
          {lines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.12 }}
              style={{
                color:
                  line.startsWith("$") || line.includes("✓")
                    ? "var(--c-accent-primary)"
                    : "var(--c-text-secondary)",
              }}
              className={line.includes("✓") ? "font-bold" : ""}
            >
              {line}
            </motion.div>
          ))}
          <span
            className="inline-block w-2 h-4 ml-1 animate-cursor-blink"
            style={{ background: "var(--c-accent-primary)" }}
          />
        </div>
      </div>
    </motion.div>
  );
}
