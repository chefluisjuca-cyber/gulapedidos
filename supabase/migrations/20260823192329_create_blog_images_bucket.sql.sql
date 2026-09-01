/*
# Create blog-images storage bucket

1. New Storage Bucket
- `blog-images` — public bucket for blog post cover images and in-article images.
  - Public read access (blog content is public).
  - Authenticated users can upload (CMS is protected by auth).

2. Security
- Bucket is public for reads.
- INSERT/UPDATE/DELETE restricted to authenticated users only.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
DROP POLICY IF EXISTS "public_read_blog_images" ON storage.objects;
CREATE POLICY "public_read_blog_images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'blog-images');

-- Authenticated can upload
DROP POLICY IF EXISTS "auth_insert_blog_images" ON storage.objects;
CREATE POLICY "auth_insert_blog_images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'blog-images');

-- Authenticated can update
DROP POLICY IF EXISTS "auth_update_blog_images" ON storage.objects;
CREATE POLICY "auth_update_blog_images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'blog-images')
WITH CHECK (bucket_id = 'blog-images');

-- Authenticated can delete
DROP POLICY IF EXISTS "auth_delete_blog_images" ON storage.objects;
CREATE POLICY "auth_delete_blog_images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'blog-images');
