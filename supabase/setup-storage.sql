-- ============================================
-- Supabase Storage Setup
-- Run this in SQL Editor to create the storage bucket
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio-assets',
  'portfolio-assets',
  true,
  10485760,  -- 10MB max
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','application/pdf'];

-- Allow public read
CREATE POLICY "Public read assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'portfolio-assets');

-- Allow public upload (CMS auth is ENV-based)
CREATE POLICY "Public upload assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'portfolio-assets');

-- Allow public update
CREATE POLICY "Public update assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'portfolio-assets');

-- Allow public delete
CREATE POLICY "Public delete assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'portfolio-assets');
