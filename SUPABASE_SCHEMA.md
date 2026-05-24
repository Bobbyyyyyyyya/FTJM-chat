# FTJM Chat - Supabase Database Schema

## Setup Instructions

1. Create a new Supabase project
2. Go to SQL Editor
3. Run the SQL scripts below to set up the database

## SQL Schema

### Enable Extensions

```sql
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";
```

### Auth & Profile Tables

```sql
-- User ID Mapping (Firebase UID mapping)
create table if not exists public.user_id_map (
  firebase_uid text primary key,
  email text not null unique,
  updated_at timestamp with time zone default now()
);

-- Profiles
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  bio text,
  photo_url text,
  notification_settings jsonb default '{"sound": true, "desktop": true}',
  thema text default 'dark',
  role text default 'user',
  public_key text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  constraint fk_profiles_auth foreign key (id) references auth.users (id) on delete cascade
);

-- Nicknames
create table if not exists public.nicknames (
  user_id uuid primary key references profiles (id) on delete cascade,
  nickname text not null unique,
  created_at timestamp with time zone default now()
);
```

### Conversation & Messages Tables

```sql
-- Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  is_group boolean default false,
  participants uuid[] not null,
  participant_names text[] not null,
  participant_photos text[],
  last_message text,
  last_message_at timestamp with time zone,
  created_by uuid not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  constraint fk_conversations_created_by foreign key (created_by) references profiles (id) on delete cascade
);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  sender_id uuid not null,
  text text not null,
  is_encrypted boolean default false,
  iv text,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  
  constraint fk_messages_conversation foreign key (conversation_id) references conversations (id) on delete cascade,
  constraint fk_messages_sender foreign key (sender_id) references profiles (id) on delete cascade
);

-- Typing Status
create table if not exists public.typing (
  conversation_id uuid not null,
  user_id uuid not null,
  is_typing boolean default true,
  last_updated timestamp with time zone default now(),
  
  primary key (conversation_id, user_id),
  constraint fk_typing_conversation foreign key (conversation_id) references conversations (id) on delete cascade,
  constraint fk_typing_user foreign key (user_id) references profiles (id) on delete cascade
);
```

### Notifications Table

```sql
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null, -- 'mention', 'reply', 'system', 'dm'
  content text not null,
  resource_type text, -- 'post', 'comment', 'thread', 'message'
  resource_id uuid,
  is_read boolean default false,
  created_at timestamp with time zone default now(),
  
  constraint fk_notifications_user foreign key (user_id) references profiles (id) on delete cascade
);
```

### Settings Table

```sql
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default now()
);
```

## Indexes

```sql
-- Conversation indexes
create index if not exists idx_conversations_participants 
  on conversations using gin (participants);

create index if not exists idx_conversations_created_by 
  on conversations (created_by);

-- Message indexes
create index if not exists idx_messages_conversation_id 
  on messages (conversation_id);

create index if not exists idx_messages_sender_id 
  on messages (sender_id);

create index if not exists idx_messages_created_at 
  on messages (created_at desc);

-- Notification indexes
create index if not exists idx_notifications_user_id 
  on notifications (user_id);

create index if not exists idx_notifications_is_read 
  on notifications (is_read);

-- Profile indexes
create index if not exists idx_profiles_email 
  on profiles (email);

create index if not exists idx_profiles_display_name 
  on profiles using gin (display_name gin_trgm_ops);
```

## Row Level Security (RLS)

```sql
-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.conversations enable row level security;
alter table public.notifications enable row level security;

-- Profiles: Users can read all, but update only their own
create policy "public_profiles_read" 
  on profiles for select to authenticated using (true);

create policy "users_can_update_own_profile" 
  on profiles for update to authenticated 
  using (auth.uid() = id) 
  with check (auth.uid() = id);

-- Messages: Users can read messages in conversations they're in
create policy "users_can_read_messages" 
  on messages for select to authenticated 
  using (
    conversation_id in (
      select id from conversations 
      where auth.uid() = any(participants)
    )
  );

create policy "users_can_send_messages" 
  on messages for insert to authenticated 
  with check (
    auth.uid() = sender_id and
    conversation_id in (
      select id from conversations 
      where auth.uid() = any(participants)
    )
  );

-- Conversations: Users can read conversations they're in
create policy "users_can_read_conversations" 
  on conversations for select to authenticated 
  using (auth.uid() = any(participants));

-- Notifications: Users can only read their own
create policy "users_can_read_own_notifications" 
  on notifications for select to authenticated 
  using (auth.uid() = user_id);
```

## Real-time Subscriptions

Enable real-time for these tables in Supabase dashboard:
- messages
- typing
- notifications
- conversations

## Environment Setup

Add to your `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
