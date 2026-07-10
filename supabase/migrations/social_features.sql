-- ============================================================================
-- Social Features: Profile Media (follows use JSONB in profiles.custom_theme)
-- ============================================================================

-- ============================================================================
-- PROFILE MEDIA TABLE (photos and GIFs under user profiles)
-- ============================================================================
create table public.profile_media (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'gif')),
  created_at timestamptz not null default now()
);

create index idx_profile_media_user_id on public.profile_media(user_id);

-- ============================================================================
-- RLS POLICIES: PROFILE MEDIA
-- ============================================================================
alter table public.profile_media enable row level security;

-- SELECT: everyone can read profile media (public profiles)
create policy "profile_media_select_public"
  on public.profile_media for select
  to public
  using (true);

-- INSERT: only owner can upload media
create policy "profile_media_insert_own"
  on public.profile_media for insert
  to authenticated
  with check (auth.uid()::text = user_id);

-- DELETE: only owner can delete own media
create policy "profile_media_delete_own"
  on public.profile_media for delete
  to authenticated
  using (auth.uid()::text = user_id);

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================
alter publication supabase_realtime add table public.profile_media;
