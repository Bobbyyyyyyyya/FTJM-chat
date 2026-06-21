-- ============================================================================
-- Add banner_url column to profiles table
-- ============================================================================

alter table public.profiles
add column if not exists banner_url text;
