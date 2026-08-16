/*
# Create product-images storage bucket

Creates a public Supabase Storage bucket for product photos with:
- Max file size: 5 MB
- Allowed types: JPEG, PNG, WebP, GIF
- Public read access (no auth required to view images)
- Anon + authenticated write access (single-tenant admin panel has no login)
*/

-- Create the bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'product-images',
  'product-images',
  true,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  5242880
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage.objects
DROP POLICY IF EXISTS "product_images_select" ON storage.objects;
CREATE POLICY "product_images_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_insert" ON storage.objects;
CREATE POLICY "product_images_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_update" ON storage.objects;
CREATE POLICY "product_images_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_delete" ON storage.objects;
CREATE POLICY "product_images_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'product-images');
