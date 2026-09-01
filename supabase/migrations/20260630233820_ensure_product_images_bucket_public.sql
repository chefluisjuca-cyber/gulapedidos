-- Make product-images bucket public if not already
UPDATE storage.buckets SET public = true WHERE id = 'product-images';
