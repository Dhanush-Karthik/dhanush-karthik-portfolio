-- ============================================
-- Portfolio v2 ("Stack Trace") additions
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================

-- Projects: URL slug + case-study fields
ALTER TABLE projects ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS year TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS case_study TEXT;
UPDATE projects
  SET slug = trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'))
  WHERE slug IS NULL OR slug = '';
CREATE UNIQUE INDEX IF NOT EXISTS projects_slug_key ON projects (slug);

-- Hero: transparent cutout + depth map for the 3D portrait
ALTER TABLE hero ADD COLUMN IF NOT EXISTS cutout_url TEXT;
ALTER TABLE hero ADD COLUMN IF NOT EXISTS depth_url TEXT;

-- Subdomains shown in the Network rack, sitemap and JSON-LD
CREATE TABLE IF NOT EXISTS subdomains (
  id SERIAL PRIMARY KEY,
  host TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  screenshot_url TEXT,
  status TEXT DEFAULT 'live',
  sort_order INTEGER DEFAULT 0,
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON subdomains;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON subdomains FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE subdomains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full subdomains" ON subdomains;
CREATE POLICY "Public full subdomains" ON subdomains FOR ALL USING (true) WITH CHECK (true);

INSERT INTO subdomains (host, title, description, tags, sort_order) VALUES
  ('blogs.dhanushkarthik.com', 'Blogs', 'Long-form notes on Java, Spring Boot, identity and backend system design.', '["writing","java","spring"]', 1)
ON CONFLICT (host) DO NOTHING;

-- New "network" frame in the section order, right after projects
INSERT INTO section_order (id, label, position, visible) VALUES ('network', 'Network', 7, true)
ON CONFLICT (id) DO NOTHING;
