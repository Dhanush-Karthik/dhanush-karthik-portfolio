-- ============================================
-- DK Portfolio — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Site Configuration (singleton)
CREATE TABLE IF NOT EXISTS site_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_title TEXT NOT NULL DEFAULT 'Dhanush Karthik',
  site_subtitle TEXT NOT NULL DEFAULT 'Java Backend Engineer',
  meta_description TEXT,
  colors JSONB NOT NULL DEFAULT '{
    "bg_primary": "#050a05",
    "bg_secondary": "#0a1a0a",
    "bg_tertiary": "#0f2a0f",
    "border": "#1a3a1a",
    "text_primary": "#e8f5e8",
    "text_secondary": "#94b894",
    "text_tertiary": "#5a7a5a",
    "accent_primary": "#4ade80",
    "accent_secondary": "#22d3ee",
    "accent_tertiary": "#fbbf24",
    "accent_danger": "#f87171",
    "accent_primary_glow": "rgba(74,222,128,0.15)"
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hero Section (singleton)
CREATE TABLE IF NOT EXISTS hero (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  greeting TEXT DEFAULT 'public class',
  name TEXT NOT NULL DEFAULT 'DhanushKarthik',
  tagline_prefix TEXT DEFAULT 'extends',
  tagline TEXT DEFAULT 'BackendEngineer',
  description TEXT,
  cta_text TEXT DEFAULT 'View My Work',
  cta_link TEXT DEFAULT '#projects',
  resume_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- About Section (singleton)
CREATE TABLE IF NOT EXISTS about (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  title TEXT DEFAULT 'About Me',
  bio TEXT,
  profile_image_url TEXT,
  stats JSONB DEFAULT '[
    {"label": "Years Experience", "value": "2+"},
    {"label": "Projects Delivered", "value": "10+"},
    {"label": "APIs Designed", "value": "50+"},
    {"label": "Cups of Coffee", "value": "∞"}
  ]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skills
CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  icon TEXT DEFAULT 'code',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Experience
CREATE TABLE IF NOT EXISTS experience (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  start_date TEXT,
  end_date TEXT DEFAULT 'Present',
  description TEXT,
  tech_stack JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  tech_stack JSONB DEFAULT '[]'::jsonb,
  github_url TEXT,
  live_url TEXT,
  featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social Links
CREATE TABLE IF NOT EXISTS social_links (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT DEFAULT 'link',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact (singleton)
CREATE TABLE IF NOT EXISTS contact (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  heading TEXT DEFAULT 'Let''s Connect',
  subtext TEXT,
  email TEXT,
  show_form BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Auto-update timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['site_config','hero','about','skills','experience','projects','social_links','contact']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;

-- ============================================
-- Row Level Security
-- Public read for all, authenticated write
-- ============================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['site_config','hero','about','skills','experience','projects','social_links','contact']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format(
      'DROP POLICY IF EXISTS "Public read %1$s" ON %1$I;
       CREATE POLICY "Public read %1$s" ON %1$I FOR SELECT USING (true);',
      t
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS "Auth write %1$s" ON %1$I;
       CREATE POLICY "Auth write %1$s" ON %1$I FOR ALL USING (auth.role() = ''authenticated'');',
      t
    );
  END LOOP;
END;
$$;

-- ============================================
-- Seed default data
-- ============================================
INSERT INTO site_config (id, site_title, site_subtitle, meta_description) VALUES (
  1,
  'Dhanush Karthik',
  'Java Backend Engineer',
  'Dhanush Karthik — Java Backend Engineer specializing in Spring Boot, Microservices, Keycloak, and REST APIs.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO hero (id, name, tagline, description) VALUES (
  1,
  'DhanushKarthik',
  'BackendEngineer',
  'Building robust, scalable backend systems with Java & Spring Boot. Specializing in microservices architecture, identity management, and API design.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO about (id, title, bio) VALUES (
  1,
  'About Me',
  'I''m a Java Backend Engineer at Grootan Technologies, where I architect and build production-grade backend systems. My day-to-day involves designing microservices, implementing secure authentication with Keycloak, and crafting clean REST APIs that teams actually enjoy working with.

I studied Computer Science at Sri Krishna College of Technology, where I fell in love with systems thinking and backend architecture. I believe great software is built on solid foundations — clean code, robust testing, and thoughtful API contracts.

When I''m not writing Java, I''m exploring new technologies, contributing to open-source projects, or diving into system design patterns.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO skills (category, items, icon, sort_order) VALUES
  ('Languages', '["Java", "SQL", "JavaScript", "TypeScript", "Python"]', 'code', 1),
  ('Frameworks', '["Spring Boot", "Spring Security", "Spring Cloud", "Hibernate", "JPA"]', 'layers', 2),
  ('Infrastructure', '["Docker", "Kubernetes", "AWS", "Nginx", "Linux"]', 'server', 3),
  ('Databases', '["MySQL", "PostgreSQL", "Redis", "MongoDB", "Elasticsearch"]', 'database', 4),
  ('Tools & Auth', '["Keycloak", "Git", "Maven", "Gradle", "Jenkins"]', 'shield', 5),
  ('Architecture', '["Microservices", "REST APIs", "Event-Driven", "CQRS", "Domain-Driven Design"]', 'git-branch', 6)
ON CONFLICT DO NOTHING;

INSERT INTO experience (role, company, location, start_date, end_date, description, tech_stack, sort_order) VALUES (
  'Java Full Stack Developer',
  'Grootan Technologies',
  'Salem, India',
  '2023',
  'Present',
  'Designing and building microservices architecture using Spring Boot. Implementing Keycloak-based IAM solutions for enterprise clients. Developing RESTful APIs and integrating with React frontends.',
  '["Java", "Spring Boot", "Keycloak", "React", "MySQL", "Docker"]',
  1
) ON CONFLICT DO NOTHING;

INSERT INTO projects (title, description, tech_stack, featured, sort_order) VALUES
  ('IAM Gateway Service', 'Enterprise identity and access management service built on Keycloak. Handles authentication, authorization, and SSO for multiple client applications with custom realm configurations.', '["Java", "Keycloak", "Spring Security", "OAuth2", "Docker"]', true, 1),
  ('Microservices Orchestrator', 'Event-driven microservices platform using Spring Cloud. Includes service discovery, API gateway, circuit breakers, and distributed tracing for production workloads.', '["Spring Cloud", "Eureka", "Zuul", "Kafka", "Resilience4j"]', true, 2),
  ('REST API Toolkit', 'Reusable Spring Boot starter library for rapid API development. Includes standardized error handling, pagination, filtering, audit logging, and OpenAPI documentation generation.', '["Java", "Spring Boot", "OpenAPI", "JUnit 5", "Maven"]', false, 3)
ON CONFLICT DO NOTHING;

INSERT INTO social_links (platform, url, icon, sort_order) VALUES
  ('LinkedIn', 'https://www.linkedin.com/in/dhanush-karthik/', 'linkedin', 1),
  ('GitHub', 'https://github.com/dhanushkarthik', 'github', 2),
  ('Email', 'mailto:hello@dhanushkarthik.dev', 'mail', 3)
ON CONFLICT DO NOTHING;

INSERT INTO contact (id, heading, subtext, email) VALUES (
  1,
  'Let''s Connect',
  'Got a project idea, a backend challenge, or just want to talk Java? Drop me a message.',
  'hello@dhanushkarthik.dev'
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Education
-- ============================================
CREATE TABLE IF NOT EXISTS education (
  id SERIAL PRIMARY KEY,
  degree TEXT NOT NULL,
  university TEXT NOT NULL,
  location TEXT,
  start_date TEXT,
  end_date TEXT,
  grade TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Testimonials
-- ============================================
CREATE TABLE IF NOT EXISTS testimonials (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  company TEXT,
  quote TEXT NOT NULL,
  avatar_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Section Order
-- ============================================
CREATE TABLE IF NOT EXISTS section_order (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add screenshot_url to projects if not exists
DO $$ BEGIN
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Triggers for new tables
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['education','testimonials','section_order']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at();', t, t);
  END LOOP;
END;
$$;

-- RLS for new tables
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['education','testimonials','section_order']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Public read %1$s" ON %1$I; CREATE POLICY "Public read %1$s" ON %1$I FOR SELECT USING (true);', t);
    EXECUTE format('DROP POLICY IF EXISTS "Auth write %1$s" ON %1$I; CREATE POLICY "Auth write %1$s" ON %1$I FOR ALL USING (true);', t);
  END LOOP;
END;
$$;

-- Seed education
INSERT INTO education (degree, university, location, start_date, end_date, grade, description, sort_order) VALUES (
  'B.Sc. Computer Science',
  'Sri Krishna College of Technology',
  'Coimbatore, India',
  '2019', '2023', '8.5 CGPA',
  'Specialized in software engineering, data structures, and distributed systems.',
  1
) ON CONFLICT DO NOTHING;

-- Seed testimonials
INSERT INTO testimonials (name, role, company, quote, sort_order) VALUES (
  'Jane Smith', 'Engineering Manager', 'TechCorp',
  'Dhanush is one of the most talented backend engineers I have worked with. His grasp of microservices and security is outstanding.',
  1
) ON CONFLICT DO NOTHING;

-- Seed section order
INSERT INTO section_order (id, label, position, visible) VALUES
  ('hero', 'Hero', 0, true),
  ('about', 'About', 1, true),
  ('skills', 'Skills', 2, true),
  ('experience', 'Experience', 3, true),
  ('education', 'Education', 4, true),
  ('projects', 'Projects', 5, true),
  ('testimonials', 'Testimonials', 6, false),
  ('contact', 'Contact', 7, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Resume (singleton)
-- ============================================
CREATE TABLE IF NOT EXISTS resume (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  file_url TEXT,
  file_name TEXT DEFAULT 'Resume.pdf',
  heading TEXT DEFAULT 'Download My Resume',
  subtext TEXT DEFAULT 'Get a detailed overview of my experience, skills, and qualifications.',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add photo_url to hero if not exists
DO $$ BEGIN
  ALTER TABLE hero ADD COLUMN IF NOT EXISTS photo_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Trigger for resume
DROP TRIGGER IF EXISTS set_updated_at ON resume;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON resume FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add resume to section_order seed
INSERT INTO section_order (id, label, position, visible) VALUES
  ('resume', 'Resume', 6, true)
ON CONFLICT (id) DO NOTHING;

-- Seed resume
INSERT INTO resume (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- FIX RLS: Open read+write for all tables
-- CMS auth is ENV-based, so anon key needs full access
-- ============================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'site_config','hero','about','skills','experience','projects',
    'social_links','contact','education','testimonials','section_order','resume'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Public read %1$s" ON %1$I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Auth write %1$s" ON %1$I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Public full %1$s" ON %1$I;', t);
    EXECUTE format(
      'CREATE POLICY "Public full %1$s" ON %1$I FOR ALL USING (true) WITH CHECK (true);',
      t
    );
  END LOOP;
END;
$$;
