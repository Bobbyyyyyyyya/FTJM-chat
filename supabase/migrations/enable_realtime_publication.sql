-- ============================================================================
-- Enable Realtime publication for postgres_changes subscriptions
-- ============================================================================
-- Run this AFTER create_additional_tables.sql and rls_policies.sql
-- This adds all tables used in the app to the supabase_realtime publication
-- so that Realtime postgres_changes subscriptions work correctly.

alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.typing;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.forum_threads;
alter publication supabase_realtime add table public.forum_comments;
