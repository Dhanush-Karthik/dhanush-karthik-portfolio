import { useEffect, useRef, useState } from "react";
import { useSite } from "../SiteContext";
import { SECTION_META } from "../sections/meta";

const SUGGEST = ["ls", "cd projects", "open ", "ping ", "gesture on", "mode print", "resume", "help"];

// The HUD command line. Opens with "/" or Ctrl/⌘+K from anywhere.
export default function CommandPalette({ sections }) {
  const { paletteOpen, setPaletteOpen, data, go, scrollTo, setMode, setHand } = useSite();
  const [log, setLog] = useState([{ kind: "hint", text: "type help for commands · esc to close" }]);
  const [value, setValue] = useState("");
  const [hist, setHist] = useState([]);
  const [hi, setHi] = useState(-1);
  const input = useRef(null);
  const out = useRef(null);

  useEffect(() => {
    function onKey(e) {
      const typing = /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "Escape") setPaletteOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen]);

  useEffect(() => { if (paletteOpen) setTimeout(() => input.current?.focus(), 10); }, [paletteOpen]);
  useEffect(() => { out.current?.scrollTo(0, out.current.scrollHeight); }, [log]);

  const ids = sections.map((s) => s.id);
  const find = (q) => {
    q = q.replace(/^~\/?|\/$/g, "").toLowerCase();
    return ids.find((id) => id === q || SECTION_META[id]?.dir === q || SECTION_META[id]?.nav === q || (q === "deploy" && id === "projects"));
  };
  const project = (q) => data.projects.find((p) => p.slug === q || p.title.toLowerCase() === q.toLowerCase() || p.slug.startsWith(q.toLowerCase()));
  const host = (q) => data.subdomains.find((d) => d.host === q || d.host.startsWith(`${q}.`));

  function close() { setPaletteOpen(false); }
  function goSection(id) { close(); if (window.location.pathname !== "/") go(`/#${id}`, "var(--ink)"); else setTimeout(() => scrollTo(id), 60); }

  function run(raw) {
    const cmd = raw.trim();
    if (!cmd) return;
    const [name, ...args] = cmd.split(/\s+/);
    const arg = args.join(" ");
    const lines = [{ kind: "cmd", text: cmd }];
    const say = (text, kind = "") => lines.push({ kind, text });

    switch (name.toLowerCase()) {
      case "help":
        say("ls · cd <section> · open <project|host> · ping <host> · resume · mail · gesture on|off · mode stack|print · clear · whoami");
        break;
      case "ls":
        if (/deploy|projects/.test(arg)) say(data.projects.map((p) => p.slug).join("  "));
        else if (/etc|hosts|network/.test(arg)) say(data.subdomains.map((d) => d.host).join("  "));
        else say([...ids.filter((i) => i !== "hero").map((i) => SECTION_META[i]?.dir || i), "resume.pdf"].join("  "));
        break;
      case "cd": {
        if (!arg || arg === "~" || arg === "..") { goSection("hero"); break; }
        const id = find(arg);
        if (id) goSection(id); else say(`cd: no such directory: ${arg}`, "err");
        break;
      }
      case "open": case "cat": {
        const p = project(arg);
        const h = host(arg);
        if (p) { close(); go(`/projects/${p.slug}`); }
        else if (h) { window.open(`https://${h.host}`, "_blank", "noopener"); say(`opened https://${h.host}`); }
        else if (find(arg)) goSection(find(arg));
        else say(`open: ${arg || "?"}: not found. try: ls deploy`, "err");
        break;
      }
      case "ping": {
        const h = host(arg) || data.subdomains[0];
        if (!h) { say("ping: no hosts configured", "err"); break; }
        const t0 = performance.now();
        say(`PING ${h.host} …`);
        fetch(`https://${h.host}/favicon.ico?ping=${Date.now()}`, { mode: "no-cors", cache: "no-store" })
          .then(() => setLog((l) => [...l, { kind: "", text: `reply from ${h.host}: time=${Math.round(performance.now() - t0)}ms` }]))
          .catch(() => setLog((l) => [...l, { kind: "err", text: `${h.host}: unreachable` }]));
        break;
      }
      case "resume": case "curl":
        if (data.resume?.file_url) { window.open(data.resume.file_url, "_blank", "noopener"); say("downloading resume …"); }
        else goSection("resume");
        break;
      case "mail": case "contact": goSection("contact"); break;
      case "gesture": case "hand":
        if (arg === "off") { setHand("off"); say("hand mode off"); } else { close(); setHand("intro"); }
        break;
      case "mode":
        if (arg === "print" || arg === "2d") { setMode("print"); say("mode: print (flat 2D)"); }
        else if (arg === "stack" || arg === "3d") { setMode("stack"); say("mode: stack (3D)"); }
        else say("usage: mode stack|print", "err");
        break;
      case "whoami": say(`Dhanush Karthik — ${data.config.site_subtitle}`); break;
      case "clear": setLog([]); setValue(""); return;
      case "sudo":
        if (/hire/.test(arg)) { say("[sudo] permission granted. routing you to contact …"); setTimeout(() => goSection("contact"), 700); }
        else say("dhanush is not in the sudoers file. This incident will be reported.", "err");
        break;
      case "exit": close(); break;
      default: say(`${name}: command not found. type help`, "err");
    }
    setLog((l) => [...l, ...lines]);
    setHist((h) => [cmd, ...h].slice(0, 30));
    setHi(-1);
    setValue("");
  }

  if (!paletteOpen) return null;
  return (
    <div className="palette-back" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command line">
        <div className="palette-out" ref={out} aria-live="polite">
          {log.map((l, i) => <div key={i} className={l.kind}>{l.text}</div>)}
        </div>
        <form className="palette-in" onSubmit={(e) => { e.preventDefault(); run(value); }}>
          <span>~/dhanush $</span>
          <input ref={input} value={value} onChange={(e) => setValue(e.target.value)} aria-label="Command" autoComplete="off" spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" && hist.length) { e.preventDefault(); const n = Math.min(hi + 1, hist.length - 1); setHi(n); setValue(hist[n]); }
              if (e.key === "ArrowDown") { e.preventDefault(); const n = Math.max(hi - 1, -1); setHi(n); setValue(n < 0 ? "" : hist[n]); }
            }} />
        </form>
        <div className="palette-sugg">
          {SUGGEST.map((s) => <button key={s} type="button" onClick={() => { if (s.endsWith(" ")) { setValue(s); input.current?.focus(); } else run(s); }}>{s.trim()}</button>)}
        </div>
      </div>
    </div>
  );
}
