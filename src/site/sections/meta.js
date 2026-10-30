// Stack-frame metadata for each CMS section id. Line numbers follow the CMS order at render time.
export const SECTION_META = {
  hero: { file: "Hero", method: "whoami", cmd: "whoami", dir: "", nav: "home", variant: "paper" },
  about: { file: "About", method: "about", cmd: "cat about.md", dir: "about", nav: "about", variant: "paper" },
  skills: { file: "Skills", method: "skills", cmd: "mvn dependency:tree", dir: "skills", nav: "skills", variant: "term" },
  experience: { file: "Experience", method: "experience", cmd: "git log --graph", dir: "experience", nav: "experience", variant: "paper" },
  education: { file: "Education", method: "education", cmd: "cat education.log", dir: "education", nav: "education", variant: "paper" },
  projects: { file: "Projects", method: "projects", cmd: "ls ~/deploy", dir: "deploy", nav: "projects", variant: "paper" },
  network: { file: "Network", method: "network", cmd: "cat /etc/hosts", dir: "etc/hosts", nav: "network", variant: "term" },
  resume: { file: "Resume", method: "resume", cmd: "curl -O resume.pdf", dir: "resume", nav: "resume", variant: "term" },
  testimonials: { file: "Testimonials", method: "praise", cmd: 'grep -r "praise"', dir: "praise", nav: "praise", variant: "paper" },
  contact: { file: "Contact", method: "contact", cmd: "mail dhanush", dir: "contact", nav: "contact", variant: "term" },
};

export function traceFor(id, line) {
  const m = SECTION_META[id];
  return m ? `at dk.Portfolio.${m.method}(${m.file}.java:${line})` : "";
}
