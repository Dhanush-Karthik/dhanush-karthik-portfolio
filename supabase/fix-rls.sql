-- ============================================
-- FIX RLS: Allow public read AND write for all tables
-- Since CMS auth is handled via ENV password on frontend,
-- Supabase anon key needs full access.
-- Run this AFTER schema.sql if you get RLS errors.
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
