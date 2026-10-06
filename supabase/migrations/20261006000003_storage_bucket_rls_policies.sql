-- ==============================================================================
-- THE PETAL & BLOOM ATELIER — STORAGE RLS POLICIES FOR ASSETS & PRODUCTS
-- Migration: 20261006000003_storage_bucket_rls_policies.sql
-- Description: Ensures 'site-assets' and 'product-images' storage buckets are public,
--              and sets up RLS policies on storage.objects allowing authenticated
--              admin uploads and updates.
-- ==============================================================================

-- 1. Ensure storage buckets exist and are marked public
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true), ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow public viewing of images in both buckets
DROP POLICY IF EXISTS "Public can view storage objects" ON storage.objects;
CREATE POLICY "Public can view storage objects"
ON storage.objects FOR SELECT
USING (bucket_id IN ('site-assets', 'product-images'));

-- 3. Allow authenticated users to upload files into buckets
DROP POLICY IF EXISTS "Authenticated users can upload site assets" ON storage.objects;
CREATE POLICY "Authenticated users can upload site assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('site-assets', 'product-images'));

-- 4. Allow authenticated users to update/overwrite files
DROP POLICY IF EXISTS "Authenticated users can update site assets" ON storage.objects;
CREATE POLICY "Authenticated users can update site assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('site-assets', 'product-images'))
WITH CHECK (bucket_id IN ('site-assets', 'product-images'));

-- 5. Allow authenticated users to delete files
DROP POLICY IF EXISTS "Authenticated users can delete site assets" ON storage.objects;
CREATE POLICY "Authenticated users can delete site assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id IN ('site-assets', 'product-images'));
