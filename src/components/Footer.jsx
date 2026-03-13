import { Github, Linkedin, Mail, Twitter, ExternalLink } from "lucide-react";

const socialIconMap = { github: Github, linkedin: Linkedin, mail: Mail, email: Mail, twitter: Twitter, default: ExternalLink };

export default function Footer({ socialLinks, config }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t py-12 px-6" style={{ borderColor: "var(--c-border)", background: "var(--c-bg-secondary)" }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          {socialLinks.map((link) => {
            const Icon = socialIconMap[link.icon?.toLowerCase()] || socialIconMap.default;
            return (
              <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="transition-all duration-200 hover:scale-110" style={{ color: "var(--c-text-tertiary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--c-accent-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--c-text-tertiary)")}
                aria-label={link.platform}>
                <Icon size={20} />
              </a>
            );
          })}
        </div>
        <p className="font-mono text-xs" style={{ color: "var(--c-text-tertiary)" }}>
          <span style={{ color: "var(--c-accent-primary)" }}>©</span> {year} {config.site_title || "Dhanush Karthik"}. Built with React & caffeine.
        </p>
      </div>
    </footer>
  );
}
