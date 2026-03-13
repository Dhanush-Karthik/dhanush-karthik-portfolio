import { useState } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle } from "lucide-react";
import { useInView } from "../hooks/useInView";

export default function ContactSection({ contact }) {
  const [ref, isInView] = useInView({ threshold: 0.15 });
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    const subject = encodeURIComponent(`Portfolio Contact from ${form.name}`);
    const body = encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`);
    window.location.href = `mailto:${contact.email}?subject=${subject}&body=${body}`;
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  const inputStyle = { background: "var(--c-bg-primary)", color: "var(--c-text-primary)", border: "1px solid var(--c-border)" };

  return (
    <section id="contact" ref={ref} className="section-container">
      <motion.div initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }} className="max-w-2xl mx-auto text-center">
        <p className="section-heading">{"// Contact"}</p>
        <h2 className="section-title">{contact.heading || "Let's Connect"}</h2>
        <p className="text-lg mb-10 -mt-6" style={{ color: "var(--c-text-secondary)" }}>{contact.subtext}</p>
        {contact.show_form !== false && (
          <div className="terminal-window text-left">
            <div className="terminal-header">
              <div className="terminal-dot" style={{ background: "#f87171" }} />
              <div className="terminal-dot" style={{ background: "#fbbf24" }} />
              <div className="terminal-dot" style={{ background: "#4ade80" }} />
              <span className="ml-3 text-xs font-mono" style={{ color: "var(--c-text-tertiary)" }}>new Message()</span>
            </div>
            <div className="p-6">
              {sent ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <CheckCircle size={40} style={{ color: "var(--c-accent-primary)" }} />
                  <p className="font-mono text-sm" style={{ color: "var(--c-accent-primary)" }}>Opening your email client...</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label className="block font-mono text-xs mb-2 uppercase tracking-wider" style={{ color: "var(--c-text-tertiary)" }}>String name</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="w-full px-4 py-3 rounded-lg font-mono text-sm outline-none" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block font-mono text-xs mb-2 uppercase tracking-wider" style={{ color: "var(--c-text-tertiary)" }}>String email</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" className="w-full px-4 py-3 rounded-lg font-mono text-sm outline-none" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block font-mono text-xs mb-2 uppercase tracking-wider" style={{ color: "var(--c-text-tertiary)" }}>String message</label>
                    <textarea rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell me about your project..." className="w-full px-4 py-3 rounded-lg font-mono text-sm outline-none resize-none" style={inputStyle} />
                  </div>
                  <button onClick={handleSubmit} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-mono text-sm font-medium transition-all duration-300 hover:scale-105 w-full justify-center" style={{ background: "var(--c-accent-primary)", color: "var(--c-bg-primary)" }}>
                    <Send size={16} />send()
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </section>
  );
}
