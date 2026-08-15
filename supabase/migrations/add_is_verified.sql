-- ============================================================================
-- Add is_verified column to profiles table
-- ============================================================================

alter table public.profiles
add column if not exists is_verified boolean not null default false;

-- Mark zwedenguy@gmail.com as verified
update public.profiles
set is_verified = true
where email = 'zwedenguy@gmail.com';