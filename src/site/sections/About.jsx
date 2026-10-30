import Sheet from "../components/Sheet";
import { traceFor, SECTION_META } from "./meta";

export default function About({ data, line, prev }) {
  const { about, hero } = data;
  const photo = about.profile_image_url || hero.photo_url || hero.cutout_url;
  const paragraphs = (about.bio || "").split(/\n\s*\n/).filter(Boolean);
  const stats = Array.isArray(about.stats) ? about.stats : [];
  return (
    <Sheet id="about" variant="paper" prev={prev} trace={traceFor("about", line)} cmd={SECTION_META.about.cmd} label="About">
      <div className="about-grid">
        <div className="select-frame">
          <span className="h tl" /><span className="h tm" /><span className="h tr" /><span className="h bl" /><span className="h bm" /><span className="h br" />
          <img src={photo} alt="Dhanush Karthik" loading="lazy" width="600" height="840" />
          <span className="dims" aria-hidden="true">dhanush.png · 600 × 840</span>
        </div>
        <div>
          <h2 className="about-hello">Hello</h2>
          <div className="about-bio">
            <p>Hi, I'm Dhanush Karthik.</p>
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
        <div className="stamps">
          {stats.map((s, i) => (
            <div key={i} className="stamp" style={{ "--r": `${[-4, 3, 2, -3][i % 4]}deg` }}>
              <b>{s.value}</b><span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
