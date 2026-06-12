-- ============================================================================
-- Additional Tables Schema for FTJM Chat
-- ============================================================================
-- These tables are referenced in RLS policies and need to be created
-- if they don't already exist in your database

-- Run this BEFORE rls_policies.sql

-- ============================================================================
-- POSTS TABLE
-- ============================================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  author_id uuid not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  constraint fk_posts_author foreign key (author_id) references profiles (id) on delete cascade
);

create index if not exists idx_posts_author_id on posts (author_id);
create index if not exists idx_posts_created_at on posts (created_at desc);

-- ============================================================================
-- FORUM_THREADS TABLE
-- ============================================================================
create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  author_id uuid not null,
  category text, -- e.g. 'general', 'support', 'announcements'
  is_pinned boolean default false,
  is_locked boolean default false,
  reply_count integer default 0,
  last_reply_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  constraint fk_forum_threads_author foreign key (author_id) references profiles (id) on delete cascade
);

create index if not exists idx_forum_threads_author_id on forum_threads (author_id);
create index if not exists idx_forum_threads_category on forum_threads (category);
create index if not exists idx_forum_threads_created_at on forum_threads (created_at desc);
create index if not exists idx_forum_threads_is_pinned on forum_threads (is_pinned);

-- ============================================================================
-- FORUM_COMMENTS TABLE
-- ============================================================================
create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  content text not null,
  author_id uuid not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  constraint fk_forum_comments_thread foreign key (thread_id) references forum_threads (id) on delete cascade,
  constraint fk_forum_comments_author foreign key (author_id) references profiles (id) on delete cascade
);

create index if not exists idx_forum_comments_thread_id on forum_comments (thread_id);
create index if not exists idx_forum_comments_author_id on forum_comments (author_id);
create index if not exists idx_forum_comments_created_at on forum_comments (created_at desc);

-- ============================================================================
-- REPORTS TABLE
-- ============================================================================
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  reported_user_id uuid,
  reported_post_id uuid,
  reported_comment_id uuid,
  reason text not null, -- e.g. 'spam', 'harassment', 'inappropriate'
  description text,
  status text default 'open', -- 'open', 'investigating', 'resolved', 'dismissed'
  admin_notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  constraint fk_reports_reporter foreign key (reporter_id) references profiles (id) on delete cascade,
  constraint fk_reports_reported_user foreign key (reported_user_id) references profiles (id) on delete set null,
  constraint fk_reports_reported_post foreign key (reported_post_id) references posts (id) on delete set null,
  constraint fk_reports_reported_comment foreign key (reported_comment_id) references forum_comments (id) on delete set null
);

create index if not exists idx_reports_reporter_id on reports (reporter_id);
create index if not exists idx_reports_status on reports (status);
create index if not exists idx_reports_created_at on reports (created_at desc);

-- ============================================================================
-- WHITELIST TABLE
-- ============================================================================
create table if not exists public.whitelist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  added_by uuid, -- who added this email
  created_at timestamp with time zone default now(),
  
  constraint fk_whitelist_added_by foreign key (added_by) references profiles (id) on delete set null
);

create index if not exists idx_whitelist_email on whitelist (email);

-- ============================================================================
-- End of Additional Tables
-- ============================================================================
