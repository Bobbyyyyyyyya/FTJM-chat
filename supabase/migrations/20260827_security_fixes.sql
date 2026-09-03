-- ============================================================================
-- Security Fixes Migration
-- ============================================================================

-- ============================================================================
-- FIX 1: Profile RLS - Prevent self-assigning role, admin_notes, is_blocked
-- ============================================================================

-- Drop the existing overly-permissive UPDATE policy
drop policy if exists "profiles_update_own" on public.profiles;

-- CREATE: Users can only update safe columns on their own profile
-- Restricted columns: role, admin_notes, is_blocked, id, created_at, updated_at
-- These can only be modified by admins via the admin function
create policy "profiles_update_own"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Prevent self-assigning privileged fields
    and role is distinct from 'admin'  -- cannot set self as admin
  );

-- Admin-only policy for updating restricted columns (role, admin_notes, is_blocked)
create policy "profiles_update_admin_restricted"
  on profiles for update
  to authenticated
  using (
    public.is_admin(auth.uid())
    or auth.uid() = id  -- own profile for non-restricted fields
  )
  with check (
    public.is_admin(auth.uid())
    or auth.uid() = id
  );

-- ============================================================================
-- FIX 2: Profile Media RLS - Owner-only updates
-- ============================================================================

-- Drop the overly-permissive UPDATE policy
drop policy if exists "profile_media_update_authenticated" on public.profile_media;

-- Only the media owner can update their own media records
create policy "profile_media_update_own"
  on public.profile_media for update
  to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- ============================================================================
-- FIX 3: Remove anon insert policies for posts and forum_threads
-- Anon users should not be able to create content with arbitrary author_id
-- ============================================================================

-- Drop anon insert policies
drop policy if exists "posts_insert_anon" on public.posts;
drop policy if exists "forum_threads_insert_anon" on public.forum_threads;

-- Also check for any other anon policies that might exist
drop policy if exists "comments_insert_anon" on public.comments;
drop policy if exists "forum_comments_insert_anon" on public.forum_comments;
