-- ============================================================================
-- Row Level Security (RLS) Policies for FTJM Chat
-- ============================================================================
-- This migration sets up complete RLS policies for all tables
-- Run this after your base schema is created

-- Helper function to check if user is admin
create or replace function public.is_admin(user_id uuid)
returns boolean as $$
begin
  return (
    select role = 'admin' 
    from public.profiles 
    where id = user_id
  );
end;
$$ language plpgsql security definer;

-- Helper function to get current user ID from Firebase header or auth.uid()
create or replace function public.get_current_user_id()
returns uuid as $$
begin
  -- Try auth.uid() first (Supabase auth)
  if auth.uid() is not null then
    return auth.uid();
  end if;
  
  -- Fallback for headers (can be customized per your Firebase integration)
  return null;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- PROFILES TABLE RLS
-- ============================================================================
alter table public.profiles enable row level security;

-- DROP existing policies if they exist
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "public_profiles_read" on public.profiles;
drop policy if exists "users_can_update_own_profile" on public.profiles;

-- SELECT: authenticated can read public profile fields for any user
create policy "profiles_select_public"
  on profiles for select
  to authenticated
  using (true);

-- INSERT: authenticated can only insert own profile
create policy "profiles_insert_own"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- UPDATE: authenticated can only update own profile
create policy "profiles_update_own"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================================
-- SETTINGS TABLE RLS
-- ============================================================================
alter table public.settings enable row level security;

drop policy if exists "settings_select_public" on public.settings;
drop policy if exists "settings_insert_admin_only" on public.settings;
drop policy if exists "settings_update_admin_only" on public.settings;
drop policy if exists "settings_delete_admin_only" on public.settings;

-- SELECT: public can read all settings
create policy "settings_select_public"
  on settings for select
  to public
  using (true);

-- INSERT: only admins can insert
create policy "settings_insert_admin_only"
  on settings for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

-- UPDATE: only admins can update
create policy "settings_update_admin_only"
  on settings for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- DELETE: only admins can delete
create policy "settings_delete_admin_only"
  on settings for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- ============================================================================
-- POSTS TABLE RLS
-- ============================================================================
alter table public.posts enable row level security;

drop policy if exists "posts_select_public" on public.posts;
drop policy if exists "posts_insert_authenticated" on public.posts;
drop policy if exists "posts_insert_anon" on public.posts;
drop policy if exists "posts_update_own_or_admin" on public.posts;
drop policy if exists "posts_delete_own_or_admin" on public.posts;

-- SELECT: public can read all posts
create policy "posts_select_public"
  on posts for select
  to public
  using (true);

-- INSERT: authenticated users can insert their own posts
create policy "posts_insert_authenticated"
  on posts for insert
  to authenticated
  with check (auth.uid() = author_id);

-- INSERT: anon can insert if author_id is not null
create policy "posts_insert_anon"
  on posts for insert
  to anon
  with check (author_id is not null);

-- UPDATE: only author or admin can update
create policy "posts_update_own_or_admin"
  on posts for update
  to authenticated
  using (auth.uid() = author_id or public.is_admin(auth.uid()))
  with check (auth.uid() = author_id or public.is_admin(auth.uid()));

-- DELETE: only author or admin can delete
create policy "posts_delete_own_or_admin"
  on posts for delete
  to authenticated
  using (auth.uid() = author_id or public.is_admin(auth.uid()));

-- ============================================================================
-- FORUM_THREADS TABLE RLS
-- ============================================================================
alter table public.forum_threads enable row level security;

drop policy if exists "forum_threads_select_public" on public.forum_threads;
drop policy if exists "forum_threads_insert_authenticated" on public.forum_threads;
drop policy if exists "forum_threads_insert_anon" on public.forum_threads;
drop policy if exists "forum_threads_update_own_or_admin" on public.forum_threads;
drop policy if exists "forum_threads_delete_own_or_admin" on public.forum_threads;

-- SELECT: public can read all threads
create policy "forum_threads_select_public"
  on forum_threads for select
  to public
  using (true);

-- INSERT: authenticated can insert their own threads
create policy "forum_threads_insert_authenticated"
  on forum_threads for insert
  to authenticated
  with check (auth.uid() = author_id);

-- INSERT: anon can insert if author_id is specified
create policy "forum_threads_insert_anon"
  on forum_threads for insert
  to anon
  with check (author_id is not null);

-- UPDATE: only author or admin can update
create policy "forum_threads_update_own_or_admin"
  on forum_threads for update
  to authenticated
  using (auth.uid() = author_id or public.is_admin(auth.uid()))
  with check (auth.uid() = author_id or public.is_admin(auth.uid()));

-- DELETE: only author or admin can delete
create policy "forum_threads_delete_own_or_admin"
  on forum_threads for delete
  to authenticated
  using (auth.uid() = author_id or public.is_admin(auth.uid()));

-- ============================================================================
-- FORUM_COMMENTS TABLE RLS
-- ============================================================================
alter table public.forum_comments enable row level security;

drop policy if exists "forum_comments_select_public" on public.forum_comments;
drop policy if exists "forum_comments_insert_authenticated" on public.forum_comments;
drop policy if exists "forum_comments_insert_anon" on public.forum_comments;
drop policy if exists "forum_comments_update_own" on public.forum_comments;
drop policy if exists "forum_comments_delete_own" on public.forum_comments;

-- SELECT: public can read all comments
create policy "forum_comments_select_public"
  on forum_comments for select
  to public
  using (true);

-- INSERT: authenticated can insert their own comments
create policy "forum_comments_insert_authenticated"
  on forum_comments for insert
  to authenticated
  with check (auth.uid() = author_id);

-- INSERT: anon can insert if author_id is specified
create policy "forum_comments_insert_anon"
  on forum_comments for insert
  to anon
  with check (author_id is not null);

-- UPDATE: only author can update
create policy "forum_comments_update_own"
  on forum_comments for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- DELETE: only author can delete
create policy "forum_comments_delete_own"
  on forum_comments for delete
  to authenticated
  using (auth.uid() = author_id);

-- ============================================================================
-- CONVERSATIONS TABLE RLS
-- ============================================================================
alter table public.conversations enable row level security;

drop policy if exists "conversations_select_participants" on public.conversations;
drop policy if exists "conversations_insert_participant" on public.conversations;
drop policy if exists "conversations_update_participant" on public.conversations;
drop policy if exists "conversations_delete_participant" on public.conversations;

-- SELECT: only participants can read
create policy "conversations_select_participants"
  on conversations for select
  to authenticated
  using (auth.uid() = any(participants));

-- INSERT: only participants can create
create policy "conversations_insert_participant"
  on conversations for insert
  to authenticated
  with check (auth.uid() = any(participants));

-- UPDATE: only participants can update
create policy "conversations_update_participant"
  on conversations for update
  to authenticated
  using (auth.uid() = any(participants))
  with check (auth.uid() = any(participants));

-- DELETE: only participants can delete
create policy "conversations_delete_participant"
  on conversations for delete
  to authenticated
  using (auth.uid() = any(participants));

-- ============================================================================
-- MESSAGES TABLE RLS
-- ============================================================================
alter table public.messages enable row level security;

drop policy if exists "messages_select_participants" on public.messages;
drop policy if exists "messages_insert_sender" on public.messages;
drop policy if exists "messages_update_sender" on public.messages;
drop policy if exists "messages_delete_sender" on public.messages;

-- SELECT: only conversation participants can read non-deleted messages
create policy "messages_select_participants"
  on messages for select
  to authenticated
  using (
    deleted_at is null
    and conversation_id in (
      select id from conversations 
      where auth.uid() = any(participants)
    )
  );

-- INSERT: sender must be participant and match user
create policy "messages_insert_sender"
  on messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and conversation_id in (
      select id from conversations
      where auth.uid() = any(participants)
    )
  );

-- UPDATE: only sender can update, and only non-deleted messages
create policy "messages_update_sender"
  on messages for update
  to authenticated
  using (
    auth.uid() = sender_id
    and deleted_at is null
    and conversation_id in (
      select id from conversations
      where auth.uid() = any(participants)
    )
  )
  with check (
    auth.uid() = sender_id
    and conversation_id in (
      select id from conversations
      where auth.uid() = any(participants)
    )
  );

-- DELETE: only sender can delete non-deleted messages
create policy "messages_delete_sender"
  on messages for delete
  to authenticated
  using (
    auth.uid() = sender_id
    and deleted_at is null
    and conversation_id in (
      select id from conversations
      where auth.uid() = any(participants)
    )
  );

-- ============================================================================
-- TYPING TABLE RLS
-- ============================================================================
alter table public.typing enable row level security;

drop policy if exists "typing_select_participants" on public.typing;
drop policy if exists "typing_insert_own" on public.typing;
drop policy if exists "typing_update_own" on public.typing;
drop policy if exists "typing_delete_own" on public.typing;

-- SELECT: only conversation participants can read typing status
create policy "typing_select_participants"
  on typing for select
  to authenticated
  using (
    conversation_id in (
      select id from conversations
      where auth.uid() = any(participants)
    )
  );

-- INSERT: only user can insert their own typing status
create policy "typing_insert_own"
  on typing for insert
  to authenticated
  with check (auth.uid() = user_id);

-- UPDATE: only user can update their own typing status
create policy "typing_update_own"
  on typing for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: only user can delete their own typing status
create policy "typing_delete_own"
  on typing for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================================
-- NOTIFICATIONS TABLE RLS
-- ============================================================================
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_insert_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;

-- SELECT: can only read own notifications
create policy "notifications_select_own"
  on notifications for select
  to authenticated
  using (auth.uid() = user_id);

-- INSERT: can only insert notifications for self
create policy "notifications_insert_own"
  on notifications for insert
  to authenticated
  with check (auth.uid() = user_id);

-- UPDATE: only user can update their own notifications
create policy "notifications_update_own"
  on notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: only user can delete their own notifications
create policy "notifications_delete_own"
  on notifications for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================================
-- NICKNAMES TABLE RLS
-- ============================================================================
alter table public.nicknames enable row level security;

drop policy if exists "nicknames_select_public" on public.nicknames;
drop policy if exists "nicknames_insert_own" on public.nicknames;
drop policy if exists "nicknames_update_own" on public.nicknames;
drop policy if exists "nicknames_delete_own" on public.nicknames;

-- SELECT: public can read all nicknames
create policy "nicknames_select_public"
  on nicknames for select
  to public
  using (true);

-- INSERT: can only insert own nickname
create policy "nicknames_insert_own"
  on nicknames for insert
  to authenticated
  with check (auth.uid() = user_id);

-- UPDATE: can only update own nickname
create policy "nicknames_update_own"
  on nicknames for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: can only delete own nickname
create policy "nicknames_delete_own"
  on nicknames for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================================
-- REPORTS TABLE RLS
-- ============================================================================
alter table public.reports enable row level security;

drop policy if exists "reports_select_own" on public.reports;
drop policy if exists "reports_insert_own" on public.reports;

-- SELECT: can only read own reports
create policy "reports_select_own"
  on reports for select
  to authenticated
  using (auth.uid() = reporter_id);

-- INSERT: authenticated can insert report for self
create policy "reports_insert_own"
  on reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- ============================================================================
-- WHITELIST TABLE RLS
-- ============================================================================
alter table public.whitelist enable row level security;

drop policy if exists "whitelist_select_public" on public.whitelist;
drop policy if exists "whitelist_insert_public" on public.whitelist;
drop policy if exists "whitelist_delete_public" on public.whitelist;

-- SELECT: public can read all whitelist entries
create policy "whitelist_select_public"
  on whitelist for select
  to public
  using (true);

-- INSERT: public can insert if email is not null
create policy "whitelist_insert_public"
  on whitelist for insert
  to public
  with check (email is not null);

-- DELETE: public can delete
create policy "whitelist_delete_public"
  on whitelist for delete
  to public
  using (true);

-- ============================================================================
-- End of RLS Policies Migration
-- ============================================================================
