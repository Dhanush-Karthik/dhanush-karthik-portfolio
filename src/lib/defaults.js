export const defaultConfig = {
  id: 1,
  site_title: "Dhanush Karthik",
  site_subtitle: "Java Backend Engineer",
  meta_description: "Dhanush Karthik — Java Backend Engineer specializing in Spring Boot, Microservices, Keycloak, and REST APIs.",
  colors: {
    bg_primary: "#050a05", bg_secondary: "#0a1a0a", bg_tertiary: "#0f2a0f",
    border: "#1a3a1a", text_primary: "#e8f5e8", text_secondary: "#94b894",
    text_tertiary: "#5a7a5a", accent_primary: "#4ade80", accent_secondary: "#22d3ee",
    accent_tertiary: "#fbbf24", accent_danger: "#f87171",
    accent_primary_glow: "rgba(74,222,128,0.15)",
  },
};

export const defaultHero = {
  id: 1, greeting: "public class", name: "DhanushKarthik",
  tagline_prefix: "extends", tagline: "BackendEngineer",
  description: "Building robust, scalable backend systems with Java & Spring Boot. Specializing in microservices architecture, identity management, and API design.",
  cta_text: "View My Work", cta_link: "#projects", resume_url: "#", photo_url: "",
};

export const defaultAbout = {
  id: 1, title: "About Me",
  bio: "I'm a Java Backend Engineer at Grootan Technologies, where I architect and build production-grade backend systems. My day-to-day involves designing microservices, implementing secure authentication with Keycloak, and crafting clean REST APIs that teams actually enjoy working with.\n\nI studied Computer Science at Sri Krishna College of Technology, where I fell in love with systems thinking and backend architecture. I believe great software is built on solid foundations — clean code, robust testing, and thoughtful API contracts.\n\nWhen I'm not writing Java, I'm exploring new technologies, contributing to open-source projects, or diving into system design patterns.",
  profile_image_url: "",
  stats: [
    { label: "Years Experience", value: "2+" },
    { label: "Projects Delivered", value: "10+" },
    { label: "APIs Designed", value: "50+" },
    { label: "Cups of Coffee", value: "∞" },
  ],
};

export const defaultSkills = [
  { id: 1, category: "Languages", items: ["Java", "SQL", "JavaScript", "TypeScript", "Python"], icon: "code", sort_order: 1 },
  { id: 2, category: "Frameworks", items: ["Spring Boot", "Spring Security", "Spring Cloud", "Hibernate", "JPA"], icon: "layers", sort_order: 2 },
  { id: 3, category: "Infrastructure", items: ["Docker", "Kubernetes", "AWS", "Nginx", "Linux"], icon: "server", sort_order: 3 },
  { id: 4, category: "Databases", items: ["MySQL", "PostgreSQL", "Redis", "MongoDB", "Elasticsearch"], icon: "database", sort_order: 4 },
  { id: 5, category: "Tools & Auth", items: ["Keycloak", "Git", "Maven", "Gradle", "Jenkins"], icon: "shield", sort_order: 5 },
  { id: 6, category: "Architecture", items: ["Microservices", "REST APIs", "Event-Driven", "CQRS", "Domain-Driven Design"], icon: "git-branch", sort_order: 6 },
];

export const defaultExperience = [
  { id: 1, role: "Java Full Stack Developer", company: "Grootan Technologies", location: "Salem, India", start_date: "2023", end_date: "Present", description: "Designing and building microservices architecture using Spring Boot. Implementing Keycloak-based IAM solutions for enterprise clients. Developing RESTful APIs and integrating with React frontends.", tech_stack: ["Java", "Spring Boot", "Keycloak", "React", "MySQL", "Docker"], sort_order: 1 },
];

export const defaultEducation = [
  { id: 1, degree: "B.Sc. Computer Science", university: "Sri Krishna College of Technology", location: "Coimbatore, India", start_date: "2019", end_date: "2023", grade: "8.5 CGPA", description: "Specialized in software engineering, data structures, and distributed systems.", sort_order: 1 },
];

export const defaultProjects = [
  { id: 1, title: "IAM Gateway Service", description: "Enterprise identity and access management service built on Keycloak. Handles authentication, authorization, and SSO for multiple client applications with custom realm configurations.", tech_stack: ["Java", "Keycloak", "Spring Security", "OAuth2", "Docker"], github_url: "", live_url: "", screenshot_url: "", featured: true, sort_order: 1 },
  { id: 2, title: "Microservices Orchestrator", description: "Event-driven microservices platform using Spring Cloud. Includes service discovery, API gateway, circuit breakers, and distributed tracing for production workloads.", tech_stack: ["Spring Cloud", "Eureka", "Zuul", "Kafka", "Resilience4j"], github_url: "", live_url: "", screenshot_url: "", featured: true, sort_order: 2 },
  { id: 3, title: "REST API Toolkit", description: "Reusable Spring Boot starter library for rapid API development. Includes standardized error handling, pagination, filtering, audit logging, and OpenAPI documentation generation.", tech_stack: ["Java", "Spring Boot", "OpenAPI", "JUnit 5", "Maven"], github_url: "", live_url: "", screenshot_url: "", featured: false, sort_order: 3 },
];

export const defaultTestimonials = [
  { id: 1, name: "Jane Smith", role: "Engineering Manager", company: "TechCorp", quote: "Dhanush is one of the most talented backend engineers I've worked with. His grasp of microservices and security is outstanding.", avatar_url: "", sort_order: 1 },
];

export const defaultSocialLinks = [
  { id: 1, platform: "LinkedIn", url: "https://www.linkedin.com/in/dhanush-karthik/", icon: "linkedin", sort_order: 1 },
  { id: 2, platform: "GitHub", url: "https://github.com/dhanushkarthik", icon: "github", sort_order: 2 },
  { id: 3, platform: "Email", url: "mailto:hello@dhanushkarthik.dev", icon: "mail", sort_order: 3 },
];

export const defaultContact = {
  id: 1, heading: "Let's Connect",
  subtext: "Got a project idea, a backend challenge, or just want to talk Java? Drop me a message.",
  email: "hello@dhanushkarthik.dev", show_form: true,
};

export const defaultResume = {
  id: 1, file_url: "", file_name: "Resume.pdf",
  heading: "Download My Resume",
  subtext: "Get a detailed overview of my experience, skills, and qualifications.",
};

export const defaultSectionOrder = [
  { id: "hero", label: "Hero", position: 0, visible: true },
  { id: "about", label: "About", position: 1, visible: true },
  { id: "skills", label: "Skills", position: 2, visible: true },
  { id: "experience", label: "Experience", position: 3, visible: true },
  { id: "education", label: "Education", position: 4, visible: true },
  { id: "projects", label: "Projects", position: 5, visible: true },
  { id: "resume", label: "Resume", position: 6, visible: true },
  { id: "testimonials", label: "Testimonials", position: 7, visible: false },
  { id: "contact", label: "Contact", position: 8, visible: true },
];
