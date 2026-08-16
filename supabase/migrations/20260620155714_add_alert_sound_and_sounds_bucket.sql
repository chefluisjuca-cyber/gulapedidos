-- Add alert_sound_url to settings
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS alert_sound_url text NULL;

-- Sounds storage bucket
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'sounds',
  'sounds',
  true,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac'],
  5242880
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "sounds_select" ON storage.objects;
CREATE POLICY "sounds_select" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'sounds');

DROP POLICY IF EXISTS "sounds_insert" ON storage.objects;
CREATE POLICY "sounds_insert" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'sounds');

DROP POLICY IF EXISTS "sounds_update" ON storage.objects;
CREATE POLICY "sounds_update" ON storage.objects
  FOR UPDATE TO anon, authenticated USING (bucket_id = 'sounds');

DROP POLICY IF EXISTS "sounds_delete" ON storage.objects;
CREATE POLICY "sounds_delete" ON storage.objects
  FOR DELETE TO anon, authenticated USING (bucket_id = 'sounds');