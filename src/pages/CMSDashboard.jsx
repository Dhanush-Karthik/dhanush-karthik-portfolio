import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { isAuthenticated, clearAuth } from "../lib/auth";
import { supabase, updateRow, insertRow, deleteRow, upsertSingle } from "../lib/supabase";
import { uploadFile } from "../lib/storage";
import { LogOut, Save, Plus, Trash2, Palette, User, Briefcase, Code, FolderOpen, MessageSquare, Link, Layout, ChevronDown, ChevronRight, Check, AlertCircle, GripVertical, GraduationCap, Quote, Layers, Eye, EyeOff, ArrowUp, ArrowDown, Upload, X, FileText, Image } from "lucide-react";

const TABS = [
  { id: "site", label: "Site Config", icon: Layout },
  { id: "colors", label: "Color Palette", icon: Palette },
  { id: "sections", label: "Section Order", icon: Layers },
  { id: "hero", label: "Hero", icon: User },
  { id: "about", label: "About", icon: User },
  { id: "skills", label: "Skills", icon: Code },
  { id: "experience", label: "Experience", icon: Briefcase },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "projects", label: "Projects", icon: FolderOpen },
  { id: "resume", label: "Resume", icon: FileText },
  { id: "testimonials", label: "Testimonials", icon: Quote },
  { id: "social", label: "Social Links", icon: Link },
  { id: "contact", label: "Contact", icon: MessageSquare },
];

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg font-mono text-sm shadow-lg"
      style={{ background: type === "success" ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)", border: `1px solid ${type === "success" ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)"}`, color: type === "success" ? "var(--c-accent-primary)" : "var(--c-accent-danger)" }}>
      {type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}{message}
    </div>
  );
}

function Field({ label, type = "text", value, onChange, rows, placeholder }) {
  const style = { background: "var(--c-bg-primary)", color: "var(--c-text-primary)", border: "1px solid var(--c-border)" };
  return (
    <div className="mb-4">
      <label className="block font-mono text-xs mb-1.5 uppercase tracking-wider" style={{ color: "var(--c-text-tertiary)" }}>{label}</label>
      {type === "textarea" ? (
        <textarea rows={rows || 4} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 rounded-lg font-mono text-sm outline-none resize-y" style={style} />
      ) : type === "color" ? (
        <div className="flex items-center gap-3">
          <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
          <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className="flex-1 px-3 py-2 rounded-lg font-mono text-sm outline-none" style={style} />
        </div>
      ) : (
        <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 rounded-lg font-mono text-sm outline-none" style={style} />
      )}
    </div>
  );
}

function FileUploadField({ label, value, onChange, accept, folder, showToast }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const isImage = accept?.includes("image");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, folder || "uploads");
      onChange(url);
      showToast?.("File uploaded");
    } catch (err) {
      showToast?.(err.message, "error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mb-4">
      <label className="block font-mono text-xs mb-1.5 uppercase tracking-wider" style={{ color: "var(--c-text-tertiary)" }}>{label}</label>
      {value && isImage && (
        <div className="relative inline-block mb-2">
          <img src={value} alt="preview" className="h-20 rounded-lg object-cover" style={{ border: "1px solid var(--c-border)" }} />
          <button onClick={() => onChange("")} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "var(--c-accent-danger)", color: "#fff" }}>
            <X size={10} />
          </button>
        </div>
      )}
      {value && !isImage && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg font-mono text-xs" style={{ background: "var(--c-bg-primary)", border: "1px solid var(--c-border)", color: "var(--c-text-secondary)" }}>
          <FileText size={14} style={{ color: "var(--c-accent-primary)" }} />
          <span className="flex-1 truncate">{value.split("/").pop()}</span>
          <button onClick={() => onChange("")}><X size={12} style={{ color: "var(--c-accent-danger)" }} /></button>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs transition-all duration-200"
          style={{ background: "var(--c-bg-tertiary)", color: "var(--c-text-secondary)", border: "1px solid var(--c-border)" }}>
          <Upload size={12} />{uploading ? "Uploading..." : "Upload File"}
        </button>
        <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Or paste URL..."
          className="flex-1 px-3 py-2 rounded-lg font-mono text-xs outline-none"
          style={{ background: "var(--c-bg-primary)", color: "var(--c-text-primary)", border: "1px solid var(--c-border)" }} />
      </div>
      <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
    </div>
  );
}

function ArrayField({ label, value, onChange }) {
  const items = Array.isArray(value) ? value : [];
  const [input, setInput] = useState("");
  function add() { if (input.trim()) { onChange([...items, input.trim()]); setInput(""); } }
  function remove(idx) { onChange(items.filter((_, i) => i !== idx)); }
  return (
    <div className="mb-4">
      <label className="block font-mono text-xs mb-1.5 uppercase tracking-wider" style={{ color: "var(--c-text-tertiary)" }}>{label}</label>
      <div className="flex gap-2 mb-2">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder="Add item..." className="flex-1 px-3 py-2 rounded-lg font-mono text-sm outline-none" style={{ background: "var(--c-bg-primary)", color: "var(--c-text-primary)", border: "1px solid var(--c-border)" }} />
        <button onClick={add} className="px-3 py-2 rounded-lg font-mono text-xs" style={{ background: "var(--c-accent-primary)", color: "var(--c-bg-primary)" }}><Plus size={14} /></button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 rounded font-mono text-xs" style={{ background: "var(--c-bg-tertiary)", color: "var(--c-text-secondary)", border: "1px solid var(--c-border)" }}>
            {item}<button onClick={() => remove(idx)} className="hover:opacity-70"><Trash2 size={10} style={{ color: "var(--c-accent-danger)" }} /></button>
          </span>
        ))}
      </div>
    </div>
  );
}

function JsonField({ label, value, onChange }) {
  const [raw, setRaw] = useState(JSON.stringify(value || [], null, 2));
  const [err, setErr] = useState("");
  function handleBlur() { try { onChange(JSON.parse(raw)); setErr(""); } catch { setErr("Invalid JSON"); } }
  return (
    <div className="mb-4">
      <label className="block font-mono text-xs mb-1.5 uppercase tracking-wider" style={{ color: "var(--c-text-tertiary)" }}>{label}</label>
      <textarea rows={4} value={raw} onChange={(e) => setRaw(e.target.value)} onBlur={handleBlur} className="w-full px-3 py-2 rounded-lg font-mono text-xs outline-none resize-y" style={{ background: "var(--c-bg-primary)", color: "var(--c-text-primary)", border: `1px solid ${err ? "var(--c-accent-danger)" : "var(--c-border)"}` }} />
      {err && <p className="text-xs mt-1 font-mono" style={{ color: "var(--c-accent-danger)" }}>{err}</p>}
    </div>
  );
}

function SaveBtn({ onClick, saving }) {
  return <button onClick={onClick} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm" style={{ background: "var(--c-accent-primary)", color: "var(--c-bg-primary)" }}><Save size={14} />{saving ? "Saving..." : "Save"}</button>;
}
function AddBtn({ onClick, label }) {
  return <button onClick={onClick} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm border" style={{ borderColor: "var(--c-border)", color: "var(--c-text-secondary)" }}><Plus size={14} />{label}</button>;
}

function SectionOrderEditor({ sections, setSections, onSave, saving }) {
  function moveUp(idx) { if (idx === 0) return; const arr = [...sections]; [arr[idx-1],arr[idx]]=[arr[idx],arr[idx-1]]; arr.forEach((s,i)=>(s.position=i)); setSections(arr); }
  function moveDown(idx) { if (idx >= sections.length-1) return; const arr = [...sections]; [arr[idx],arr[idx+1]]=[arr[idx+1],arr[idx]]; arr.forEach((s,i)=>(s.position=i)); setSections(arr); }
  function toggleVisibility(idx) { setSections(sections.map((s,i) => i===idx ? {...s, visible:!s.visible} : s)); }
  return (
    <div>
      <p className="text-sm mb-6" style={{ color: "var(--c-text-secondary)" }}>Reorder sections and toggle visibility.</p>
      <div className="space-y-2">
        {sections.sort((a,b)=>a.position-b.position).map((section,idx) => (
          <div key={section.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--c-bg-secondary)", border: "1px solid var(--c-border)" }}>
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveUp(idx)} disabled={idx===0} className="disabled:opacity-20" style={{ color: "var(--c-text-tertiary)" }}><ArrowUp size={14} /></button>
              <button onClick={() => moveDown(idx)} disabled={idx>=sections.length-1} className="disabled:opacity-20" style={{ color: "var(--c-text-tertiary)" }}><ArrowDown size={14} /></button>
            </div>
            <span className="font-mono text-xs w-6 text-center" style={{ color: "var(--c-text-tertiary)" }}>{idx}</span>
            <span className="font-mono text-sm flex-1 font-semibold" style={{ color: section.visible ? "var(--c-text-primary)" : "var(--c-text-tertiary)", textDecoration: section.visible ? "none" : "line-through" }}>{section.label}</span>
            <button onClick={() => toggleVisibility(idx)} className="p-1.5 rounded" style={{ color: section.visible ? "var(--c-accent-primary)" : "var(--c-text-tertiary)" }}>{section.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
          </div>
        ))}
      </div>
      <div className="mt-4"><SaveBtn onClick={onSave} saving={saving} /></div>
    </div>
  );
}

export default function CMSDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("site");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  const [siteConfig, setSiteConfig] = useState(null);
  const [colors, setColors] = useState(null);
  const [hero, setHero] = useState(null);
  const [about, setAbout] = useState(null);
  const [skills, setSkills] = useState([]);
  const [experience, setExperience] = useState([]);
  const [education, setEducation] = useState([]);
  const [projects, setProjects] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [socialLinks, setSocialLinks] = useState([]);
  const [contact, setContact] = useState(null);
  const [resume, setResume] = useState(null);
  const [sectionOrder, setSectionOrder] = useState([]);

  useEffect(() => { if (!isAuthenticated()) navigate("/cms"); }, [navigate]);

  function showToast(msg, type = "success") { setToast({ message: msg, type }); }

  const loadData = useCallback(async () => {
    const q = (t) => supabase.from(t).select("*");
    const [sc,h,a,sk,ex,ed,pr,te,sl,co,re,so] = await Promise.all([
      q("site_config").single(), q("hero").single(), q("about").single(),
      q("skills").order("sort_order"), q("experience").order("sort_order"),
      q("education").order("sort_order"), q("projects").order("sort_order"),
      q("testimonials").order("sort_order"), q("social_links").order("sort_order"),
      q("contact").single(), q("resume").single(), q("section_order").order("position"),
    ]);
    if(sc.data){setSiteConfig(sc.data);setColors(sc.data.colors||{});} if(h.data)setHero(h.data);
    if(a.data)setAbout(a.data); if(sk.data)setSkills(sk.data); if(ex.data)setExperience(ex.data);
    if(ed.data)setEducation(ed.data); if(pr.data)setProjects(pr.data); if(te.data)setTestimonials(te.data);
    if(sl.data)setSocialLinks(sl.data); if(co.data)setContact(co.data); if(re.data)setResume(re.data);
    if(so.data?.length)setSectionOrder(so.data);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function saveSingle(table, data) {
    setSaving(true);
    try { await upsertSingle(table, data); showToast(`${table} saved`); }
    catch (err) { showToast(err.message, "error"); }
    finally { setSaving(false); }
  }

  async function saveList(table, items) {
    setSaving(true);
    try {
      for (const item of items) { if (item.id && typeof item.id === "number") await updateRow(table, item.id, item); else await insertRow(table, item); }
      showToast(`${table} saved`); loadData();
    } catch (err) { showToast(err.message, "error"); }
    finally { setSaving(false); }
  }

  async function saveSectionOrder() {
    setSaving(true);
    try { for (const s of sectionOrder) await supabase.from("section_order").upsert(s, { onConflict: "id" }); showToast("Section order saved"); }
    catch (err) { showToast(err.message, "error"); }
    finally { setSaving(false); }
  }

  async function removeItem(table, id, setter) {
    try { await deleteRow(table, id); setter((prev) => prev.filter((item) => item.id !== id)); showToast("Deleted"); }
    catch (err) { showToast(err.message, "error"); }
  }

  function renderContent() {
    switch (activeTab) {
      case "site": return siteConfig ? (<div>
        <Field label="Site Title" value={siteConfig.site_title} onChange={(v) => setSiteConfig({...siteConfig,site_title:v})} />
        <Field label="Site Subtitle" value={siteConfig.site_subtitle} onChange={(v) => setSiteConfig({...siteConfig,site_subtitle:v})} />
        <Field label="Meta Description" type="textarea" rows={3} value={siteConfig.meta_description} onChange={(v) => setSiteConfig({...siteConfig,meta_description:v})} />
        <SaveBtn onClick={() => saveSingle("site_config", siteConfig)} saving={saving} />
      </div>) : <p className="font-mono text-sm" style={{color:"var(--c-text-tertiary)"}}>No config found. Run schema.sql first.</p>;

      case "colors": return colors ? (<div>
        <p className="text-sm mb-6" style={{color:"var(--c-text-secondary)"}}>Customize the entire site color palette.</p>
        <div className="grid sm:grid-cols-2 gap-x-6">
          {["bg_primary","bg_secondary","bg_tertiary","border","text_primary","text_secondary","text_tertiary","accent_primary","accent_secondary","accent_tertiary","accent_danger"].map((k) => (
            <Field key={k} label={k.replace(/_/g," ")} type="color" value={colors[k]} onChange={(v) => setColors({...colors,[k]:v})} />
          ))}
          <Field label="Accent Primary Glow" value={colors.accent_primary_glow} onChange={(v) => setColors({...colors,accent_primary_glow:v})} placeholder="rgba(74,222,128,0.15)" />
        </div>
        <SaveBtn onClick={() => saveSingle("site_config", {...siteConfig,colors})} saving={saving} />
      </div>) : null;

      case "sections": return <SectionOrderEditor sections={sectionOrder} setSections={setSectionOrder} onSave={saveSectionOrder} saving={saving} />;

      case "hero": return hero ? (<div>
        <FileUploadField label="Photo" value={hero.photo_url} onChange={(v) => setHero({...hero,photo_url:v})} accept="image/*" folder="hero" showToast={showToast} />
        <Field label="Greeting" value={hero.greeting} onChange={(v) => setHero({...hero,greeting:v})} placeholder="public class" />
        <Field label="Name" value={hero.name} onChange={(v) => setHero({...hero,name:v})} />
        <Field label="Tagline Prefix" value={hero.tagline_prefix} onChange={(v) => setHero({...hero,tagline_prefix:v})} />
        <Field label="Tagline" value={hero.tagline} onChange={(v) => setHero({...hero,tagline:v})} />
        <Field label="Description" type="textarea" value={hero.description} onChange={(v) => setHero({...hero,description:v})} />
        <Field label="CTA Text" value={hero.cta_text} onChange={(v) => setHero({...hero,cta_text:v})} />
        <Field label="CTA Link" value={hero.cta_link} onChange={(v) => setHero({...hero,cta_link:v})} />
        <SaveBtn onClick={() => saveSingle("hero", hero)} saving={saving} />
      </div>) : null;

      case "about": return about ? (<div>
        <Field label="Title" value={about.title} onChange={(v) => setAbout({...about,title:v})} />
        <Field label="Bio" type="textarea" rows={8} value={about.bio} onChange={(v) => setAbout({...about,bio:v})} />
        <FileUploadField label="Profile Image" value={about.profile_image_url} onChange={(v) => setAbout({...about,profile_image_url:v})} accept="image/*" folder="about" showToast={showToast} />
        <JsonField label="Stats (JSON)" value={about.stats} onChange={(v) => setAbout({...about,stats:v})} />
        <SaveBtn onClick={() => saveSingle("about", about)} saving={saving} />
      </div>) : null;

      case "skills": return (<div>
        {skills.map((s,idx) => (<div key={s.id||idx} className="glass-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><GripVertical size={14} style={{color:"var(--c-text-tertiary)"}} /><span className="font-mono text-sm font-bold" style={{color:"var(--c-text-primary)"}}>{s.category||"New"}</span></div><button onClick={() => removeItem("skills",s.id,setSkills)}><Trash2 size={14} style={{color:"var(--c-accent-danger)"}} /></button></div>
          <Field label="Category" value={s.category} onChange={(v) => setSkills(skills.map((x,i)=>i===idx?{...x,category:v}:x))} />
          <Field label="Icon" value={s.icon} onChange={(v) => setSkills(skills.map((x,i)=>i===idx?{...x,icon:v}:x))} placeholder="code|layers|server|database|shield|git-branch" />
          <Field label="Sort Order" type="number" value={s.sort_order} onChange={(v) => setSkills(skills.map((x,i)=>i===idx?{...x,sort_order:parseInt(v)}:x))} />
          <ArrayField label="Items" value={s.items} onChange={(v) => setSkills(skills.map((x,i)=>i===idx?{...x,items:v}:x))} />
        </div>))}
        <div className="flex gap-3 mt-4"><AddBtn onClick={() => setSkills([...skills,{category:"",items:[],icon:"code",sort_order:skills.length+1}])} label="Add Skill" /><SaveBtn onClick={() => saveList("skills",skills)} saving={saving} /></div>
      </div>);

      case "experience": return (<div>
        {experience.map((e,idx) => (<div key={e.id||idx} className="glass-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3"><span className="font-mono text-sm font-bold" style={{color:"var(--c-text-primary)"}}>{e.role||"New"}</span><button onClick={() => removeItem("experience",e.id,setExperience)}><Trash2 size={14} style={{color:"var(--c-accent-danger)"}} /></button></div>
          <Field label="Role" value={e.role} onChange={(v) => setExperience(experience.map((x,i)=>i===idx?{...x,role:v}:x))} />
          <Field label="Company" value={e.company} onChange={(v) => setExperience(experience.map((x,i)=>i===idx?{...x,company:v}:x))} />
          <Field label="Location" value={e.location} onChange={(v) => setExperience(experience.map((x,i)=>i===idx?{...x,location:v}:x))} />
          <div className="grid grid-cols-2 gap-4"><Field label="Start" value={e.start_date} onChange={(v) => setExperience(experience.map((x,i)=>i===idx?{...x,start_date:v}:x))} /><Field label="End" value={e.end_date} onChange={(v) => setExperience(experience.map((x,i)=>i===idx?{...x,end_date:v}:x))} /></div>
          <Field label="Description" type="textarea" value={e.description} onChange={(v) => setExperience(experience.map((x,i)=>i===idx?{...x,description:v}:x))} />
          <ArrayField label="Tech Stack" value={e.tech_stack} onChange={(v) => setExperience(experience.map((x,i)=>i===idx?{...x,tech_stack:v}:x))} />
          <Field label="Sort Order" type="number" value={e.sort_order} onChange={(v) => setExperience(experience.map((x,i)=>i===idx?{...x,sort_order:parseInt(v)}:x))} />
        </div>))}
        <div className="flex gap-3 mt-4"><AddBtn onClick={() => setExperience([...experience,{role:"",company:"",location:"",start_date:"",end_date:"Present",description:"",tech_stack:[],sort_order:experience.length+1}])} label="Add Experience" /><SaveBtn onClick={() => saveList("experience",experience)} saving={saving} /></div>
      </div>);

      case "education": return (<div>
        {education.map((e,idx) => (<div key={e.id||idx} className="glass-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3"><span className="font-mono text-sm font-bold" style={{color:"var(--c-text-primary)"}}>{e.degree||"New"}</span><button onClick={() => removeItem("education",e.id,setEducation)}><Trash2 size={14} style={{color:"var(--c-accent-danger)"}} /></button></div>
          <Field label="Degree" value={e.degree} onChange={(v) => setEducation(education.map((x,i)=>i===idx?{...x,degree:v}:x))} />
          <Field label="University" value={e.university} onChange={(v) => setEducation(education.map((x,i)=>i===idx?{...x,university:v}:x))} />
          <Field label="Location" value={e.location} onChange={(v) => setEducation(education.map((x,i)=>i===idx?{...x,location:v}:x))} />
          <div className="grid grid-cols-2 gap-4"><Field label="Start" value={e.start_date} onChange={(v) => setEducation(education.map((x,i)=>i===idx?{...x,start_date:v}:x))} /><Field label="End" value={e.end_date} onChange={(v) => setEducation(education.map((x,i)=>i===idx?{...x,end_date:v}:x))} /></div>
          <Field label="Grade / CGPA" value={e.grade} onChange={(v) => setEducation(education.map((x,i)=>i===idx?{...x,grade:v}:x))} />
          <Field label="Description" type="textarea" value={e.description} onChange={(v) => setEducation(education.map((x,i)=>i===idx?{...x,description:v}:x))} />
          <Field label="Sort Order" type="number" value={e.sort_order} onChange={(v) => setEducation(education.map((x,i)=>i===idx?{...x,sort_order:parseInt(v)}:x))} />
        </div>))}
        <div className="flex gap-3 mt-4"><AddBtn onClick={() => setEducation([...education,{degree:"",university:"",location:"",start_date:"",end_date:"",grade:"",description:"",sort_order:education.length+1}])} label="Add Education" /><SaveBtn onClick={() => saveList("education",education)} saving={saving} /></div>
      </div>);

      case "projects": return (<div>
        {projects.map((p,idx) => (<div key={p.id||idx} className="glass-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3"><span className="font-mono text-sm font-bold" style={{color:"var(--c-text-primary)"}}>{p.title||"New"}</span><button onClick={() => removeItem("projects",p.id,setProjects)}><Trash2 size={14} style={{color:"var(--c-accent-danger)"}} /></button></div>
          <Field label="Title" value={p.title} onChange={(v) => setProjects(projects.map((x,i)=>i===idx?{...x,title:v}:x))} />
          <Field label="Description" type="textarea" value={p.description} onChange={(v) => setProjects(projects.map((x,i)=>i===idx?{...x,description:v}:x))} />
          <ArrayField label="Tech Stack" value={p.tech_stack} onChange={(v) => setProjects(projects.map((x,i)=>i===idx?{...x,tech_stack:v}:x))} />
          <Field label="GitHub URL" value={p.github_url} onChange={(v) => setProjects(projects.map((x,i)=>i===idx?{...x,github_url:v}:x))} />
          <Field label="Live URL" value={p.live_url} onChange={(v) => setProjects(projects.map((x,i)=>i===idx?{...x,live_url:v}:x))} />
          <FileUploadField label="Screenshot" value={p.screenshot_url} onChange={(v) => setProjects(projects.map((x,i)=>i===idx?{...x,screenshot_url:v}:x))} accept="image/*" folder="projects" showToast={showToast} />
          <div className="flex items-center gap-3 mb-4"><label className="font-mono text-xs uppercase tracking-wider" style={{color:"var(--c-text-tertiary)"}}>Featured</label><input type="checkbox" checked={p.featured||false} onChange={(e) => setProjects(projects.map((x,i)=>i===idx?{...x,featured:e.target.checked}:x))} /></div>
          <Field label="Sort Order" type="number" value={p.sort_order} onChange={(v) => setProjects(projects.map((x,i)=>i===idx?{...x,sort_order:parseInt(v)}:x))} />
        </div>))}
        <div className="flex gap-3 mt-4"><AddBtn onClick={() => setProjects([...projects,{title:"",description:"",tech_stack:[],github_url:"",live_url:"",screenshot_url:"",featured:false,sort_order:projects.length+1}])} label="Add Project" /><SaveBtn onClick={() => saveList("projects",projects)} saving={saving} /></div>
      </div>);

      case "resume": return (<div>
        <p className="text-sm mb-6" style={{color:"var(--c-text-secondary)"}}>Upload your resume PDF. Visitors can download it from the Resume section.</p>
        <FileUploadField label="Resume File (PDF)" value={resume?.file_url} onChange={(v) => setResume({...resume||{id:1},file_url:v})} accept=".pdf,application/pdf" folder="resume" showToast={showToast} />
        <Field label="Display File Name" value={resume?.file_name} onChange={(v) => setResume({...resume||{id:1},file_name:v})} placeholder="DhanushKarthik_Resume.pdf" />
        <Field label="Section Heading" value={resume?.heading} onChange={(v) => setResume({...resume||{id:1},heading:v})} />
        <Field label="Section Subtext" type="textarea" rows={2} value={resume?.subtext} onChange={(v) => setResume({...resume||{id:1},subtext:v})} />
        <SaveBtn onClick={() => saveSingle("resume", resume||{id:1})} saving={saving} />
      </div>);

      case "testimonials": return (<div>
        <p className="text-sm mb-4" style={{color:"var(--c-text-secondary)"}}>Toggle testimonials visibility in the Section Order tab.</p>
        {testimonials.map((t,idx) => (<div key={t.id||idx} className="glass-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3"><span className="font-mono text-sm font-bold" style={{color:"var(--c-text-primary)"}}>{t.name||"New"}</span><button onClick={() => removeItem("testimonials",t.id,setTestimonials)}><Trash2 size={14} style={{color:"var(--c-accent-danger)"}} /></button></div>
          <Field label="Name" value={t.name} onChange={(v) => setTestimonials(testimonials.map((x,i)=>i===idx?{...x,name:v}:x))} />
          <Field label="Role" value={t.role} onChange={(v) => setTestimonials(testimonials.map((x,i)=>i===idx?{...x,role:v}:x))} />
          <Field label="Company" value={t.company} onChange={(v) => setTestimonials(testimonials.map((x,i)=>i===idx?{...x,company:v}:x))} />
          <Field label="Quote" type="textarea" value={t.quote} onChange={(v) => setTestimonials(testimonials.map((x,i)=>i===idx?{...x,quote:v}:x))} />
          <FileUploadField label="Avatar" value={t.avatar_url} onChange={(v) => setTestimonials(testimonials.map((x,i)=>i===idx?{...x,avatar_url:v}:x))} accept="image/*" folder="testimonials" showToast={showToast} />
          <Field label="Sort Order" type="number" value={t.sort_order} onChange={(v) => setTestimonials(testimonials.map((x,i)=>i===idx?{...x,sort_order:parseInt(v)}:x))} />
        </div>))}
        <div className="flex gap-3 mt-4"><AddBtn onClick={() => setTestimonials([...testimonials,{name:"",role:"",company:"",quote:"",avatar_url:"",sort_order:testimonials.length+1}])} label="Add Testimonial" /><SaveBtn onClick={() => saveList("testimonials",testimonials)} saving={saving} /></div>
      </div>);

      case "social": return (<div>
        {socialLinks.map((l,idx) => (<div key={l.id||idx} className="glass-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3"><span className="font-mono text-sm font-bold" style={{color:"var(--c-text-primary)"}}>{l.platform||"New"}</span><button onClick={() => removeItem("social_links",l.id,setSocialLinks)}><Trash2 size={14} style={{color:"var(--c-accent-danger)"}} /></button></div>
          <Field label="Platform" value={l.platform} onChange={(v) => setSocialLinks(socialLinks.map((x,i)=>i===idx?{...x,platform:v}:x))} />
          <Field label="URL" value={l.url} onChange={(v) => setSocialLinks(socialLinks.map((x,i)=>i===idx?{...x,url:v}:x))} />
          <Field label="Icon" value={l.icon} onChange={(v) => setSocialLinks(socialLinks.map((x,i)=>i===idx?{...x,icon:v}:x))} placeholder="github|linkedin|mail|twitter" />
          <Field label="Sort Order" type="number" value={l.sort_order} onChange={(v) => setSocialLinks(socialLinks.map((x,i)=>i===idx?{...x,sort_order:parseInt(v)}:x))} />
        </div>))}
        <div className="flex gap-3 mt-4"><AddBtn onClick={() => setSocialLinks([...socialLinks,{platform:"",url:"",icon:"",sort_order:socialLinks.length+1}])} label="Add Link" /><SaveBtn onClick={() => saveList("social_links",socialLinks)} saving={saving} /></div>
      </div>);

      case "contact": return contact ? (<div>
        <Field label="Heading" value={contact.heading} onChange={(v) => setContact({...contact,heading:v})} />
        <Field label="Subtext" type="textarea" value={contact.subtext} onChange={(v) => setContact({...contact,subtext:v})} />
        <Field label="Email" value={contact.email} onChange={(v) => setContact({...contact,email:v})} />
        <div className="flex items-center gap-3 mb-4"><label className="font-mono text-xs uppercase tracking-wider" style={{color:"var(--c-text-tertiary)"}}>Show Form</label><input type="checkbox" checked={contact.show_form!==false} onChange={(e) => setContact({...contact,show_form:e.target.checked})} /></div>
        <SaveBtn onClick={() => saveSingle("contact", contact)} saving={saving} />
      </div>) : null;

      default: return null;
    }
  }

  const currentTab = TABS.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen flex" style={{background:"var(--c-bg-primary)"}}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <aside className={`${sidebarOpen?"w-64":"w-16"} transition-all duration-300 border-r flex flex-col shrink-0`} style={{background:"var(--c-bg-secondary)",borderColor:"var(--c-border)"}}>
        <div className="p-4 border-b flex items-center justify-between" style={{borderColor:"var(--c-border)"}}>
          {sidebarOpen && <span className="font-mono text-sm font-bold" style={{color:"var(--c-accent-primary)"}}>{"{"} DK CMS {"}"}</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1" style={{color:"var(--c-text-tertiary)"}}>{sidebarOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {TABS.map((tab) => {const Icon=tab.icon; return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 ${activeTab===tab.id?"border-r-2":""}`}
              style={{color:activeTab===tab.id?"var(--c-accent-primary)":"var(--c-text-secondary)",background:activeTab===tab.id?"var(--c-bg-tertiary)":"transparent",borderColor:activeTab===tab.id?"var(--c-accent-primary)":"transparent"}}>
              <Icon size={16} />{sidebarOpen && <span className="font-mono text-xs">{tab.label}</span>}
            </button>
          );})}
        </nav>
        <div className="p-4 border-t" style={{borderColor:"var(--c-border)"}}>
          <button onClick={() => {clearAuth();navigate("/cms");}} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg font-mono text-xs" style={{color:"var(--c-accent-danger)"}}>
            <LogOut size={14} />{sidebarOpen && "Sign Out"}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <header className="px-8 py-6 border-b" style={{borderColor:"var(--c-border)"}}>
          <div className="flex items-center gap-3">{currentTab && <currentTab.icon size={20} style={{color:"var(--c-accent-primary)"}} />}<h1 className="text-xl font-bold" style={{fontFamily:"'Space Grotesk',sans-serif",color:"var(--c-text-primary)"}}>{currentTab?.label||"Dashboard"}</h1></div>
        </header>
        <div className="p-8 max-w-3xl">{renderContent()}</div>
      </main>
    </div>
  );
}
