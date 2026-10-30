import { useEffect, useState } from "react";
import Sheet from "../components/Sheet";
import RibbonTitle from "../components/RibbonTitle";
import { traceFor, SECTION_META } from "./meta";

// Rough reachability check: an opaque no-cors request resolves when the host answers.
function usePing(host) {
  const [state, setState] = useState({ status: "checking", ms: null });
  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const t0 = performance.now();
    fetch(`https://${host}/favicon.ico?ping=${Date.now()}`, { mode: "no-cors", cache: "no-store", signal: ctl.signal })
      .then(() => alive && setState({ status: "up", ms: Math.round(performance.now() - t0) }))
      .catch(() => alive && setState({ status: "down", ms: null }))
      .finally(() => clearTimeout(timer));
    return () => { alive = false; ctl.abort(); clearTimeout(timer); };
  }, [host]);
  return state;
}

function Unit({ d }) {
  const ping = usePing(d.host);
  const [sub, ...rest] = d.host.split(".");
  return (
    <a className="unit" href={`https://${d.host}`} target="_blank" rel="noopener">
      <span className="screw l" aria-hidden="true" /><span className="screw r" aria-hidden="true" />
      <span className={`led ${ping.status}`} aria-label={`status ${ping.status}`} />
      <div>
        <div className="unit-host"><em>{sub}</em>.{rest.join(".")}</div>
        <div className="unit-desc">{d.title} — {d.description}</div>
        {d.tags?.length > 0 && <div className="unit-tags">{d.tags.map((t) => <span key={t}>{t}</span>)}</div>}
      </div>
      <div className="unit-meta">
        <b>{ping.ms != null ? `${ping.ms}ms` : ping.status === "down" ? "—" : "…"}</b>
        {d.status || "live"} · ssh →
      </div>
      {d.screenshot_url && <img className="unit-shot" src={d.screenshot_url} alt="" loading="lazy" />}
    </a>
  );
}

export default function Network({ data, line, prev }) {
  const blanks = Math.max(1, 3 - data.subdomains.length);
  return (
    <Sheet id="network" variant="term" prev={prev} trace={traceFor("network", line)} cmd={SECTION_META.network.cmd} label="Network">
      <RibbonTitle text="Network" onPaper={false} />
      <p className="lead" style={{ margin: "0 auto 48px", textAlign: "center" }}>Other things I run on dhanushkarthik.com. Live response times are measured from your browser.</p>
      <div className="rack-wrap">
        <div className="rack">
          {data.subdomains.map((d) => <Unit key={d.host} d={d} />)}
          {Array.from({ length: blanks }, (_, i) => (
            <div key={i} className="unit blank" aria-hidden="true"><span>slot {data.subdomains.length + i + 1} · reserved</span></div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
