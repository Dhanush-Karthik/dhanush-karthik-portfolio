import { useState } from "react";
import Sheet from "../components/Sheet";
import RibbonTitle from "../components/RibbonTitle";
import { traceFor, SECTION_META } from "./meta";

export default function Contact({ data, line, prev }) {
  const { contact, socialLinks } = data;
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [out, setOut] = useState({ text: "", ok: false });
  const [copied, setCopied] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (!form.message.trim()) { setOut({ text: "mail: body is empty — write a message first", ok: false }); return; }
    const subject = encodeURIComponent(`Portfolio contact from ${form.name || "someone"}`);
    const body = encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`);
    window.location.href = `mailto:${contact.email}?subject=${subject}&body=${body}`;
    setOut({ text: `Opening your mail client with a message to ${contact.email} …`, ok: true });
  }

  async function copy() {
    try { await navigator.clipboard.writeText(contact.email); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  }

  return (
    <Sheet id="contact" variant="term" prev={prev} trace={traceFor("contact", line)} cmd={SECTION_META.contact.cmd} label="Contact">
      <RibbonTitle text={contact.heading?.length <= 14 ? contact.heading : "Say hello"} onPaper={false} />
      <p className="lead" style={{ margin: "0 auto 40px", textAlign: "center" }}>{contact.subtext}</p>
      {contact.show_form !== false && (
        <form className="shell" onSubmit={submit} aria-label="Contact form">
          <div className="shell-bar"><span>mail — dhanush@dk</span><span>⏎ in the last field or press send</span></div>
          <div className="shell-body">
            <div className="shell-row"><label>to:</label><span style={{ paddingTop: 8, color: "#fff" }}>{contact.email}<button type="button" className="copy-btn" onClick={copy}>{copied ? "copied" : "copy"}</button></span></div>
            <div className="shell-row"><label htmlFor="c-name">from:</label><input id="c-name" autoComplete="name" placeholder="your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="shell-row"><label htmlFor="c-email">reply-to:</label><input id="c-email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="shell-row"><label htmlFor="c-msg">body:</label><textarea id="c-msg" rows={5} placeholder="Tell me about the project, the role, or the bug." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
            <div className="shell-row"><span /><div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn solid" type="submit">send ⏎</button>
              <span className={`shell-out ${out.ok ? "ok" : ""}`} role="status">{out.text}</span>
            </div></div>
          </div>
        </form>
      )}
      <div className="contact-side">
        <span>$ ls ~/links →</span>
        {socialLinks.map((s) => <a key={s.id} href={s.url} rel="me noopener" target={s.url.startsWith("mailto:") ? undefined : "_blank"}>{s.platform.toLowerCase()}</a>)}
      </div>
    </Sheet>
  );
}
