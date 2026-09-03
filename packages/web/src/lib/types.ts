/**
 * Type definitions for FTJM Chat Database
 * These types mirror your Supabase schema with RLS policies
 */

// ============================================================================
// AUTH & PROFILES
// ============================================================================

export interface Profile {
  id: string
  email?: string | null
  role?: 'user' | 'admin' | 'mod' | null
  original_name?: string | null
  public_key?: string | null
  display_name?: string | null
  name_locked_until?: string | null
  bio?: string | null
  bio_locked_until?: string | null
  photo_url?: string | null
  banner_url?: string | null
  notification_settings?: {
    sound?: boolean
    desktop?: boolean
    enable_sounds?: boolean
    notify_new_messages?: boolean
    notify_mentions?: boolean
    notify_new_posts?: boolean
    message_sound?: string
    post_sound?: string
    ringtone_url?: string
    sound_library?: Record<string, string>
  } | null
  custom_theme?: Record<string, unknown> | null
  use_custom_theme?: boolean
  custom_sounds?: Record<string, unknown> | null
  admin_notes?: string | null
  is_blocked?: boolean
  created_at: string
  updated_at: string
}

export interface Nickname {
  user_id: string
  nickname: string
  created_at: string
}

// ============================================================================
// GENERAL CHAT (PUBLIC - Everyone sees)
// ============================================================================

export interface Post {
  id: string
  content: string
  author_id: string
  created_at: string
  updated_at: string
}

// ============================================================================
// DIRECT MESSAGING (PRIVATE - Only participants)
// ============================================================================

export interface Conversation {
  id: string
  title?: string // Optional group chat name
  is_group: boolean
  participants: string[] // Array of user UUIDs
  participant_names: string[] // Matched with participants array
  participant_photos: string[] // Matched with participants array
  last_message?: string
  last_message_at?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  text: string
  is_encrypted: boolean
  iv?: string // Initialization vector for encryption
  deleted_at?: string // Soft delete timestamp
  created_at: string
}

export interface TypingStatus {
  conversation_id: string
  user_id: string
  is_typing: boolean
  last_updated: string
}

// ============================================================================
// NOTIFICATIONS (PRIVATE - Owner only)
// ============================================================================

export interface Notification {
  id: string
  user_id: string // Who receives the notification
  type: 'mention' | 'reply' | 'system' | 'dm' | 'follow' | 'upload_media'
  content: string
  resource_type?: 'post' | 'comment' | 'thread' | 'message' | 'profile_media'
  resource_id?: string // Links to post/comment/thread/message/media
  is_read: boolean
  created_at: string
}

// ============================================================================
// MODERATION
// ============================================================================

export interface Report {
  id: string
  reporter_id: string
  reported_user_id?: string
  reported_post_id?: string
  reported_comment_id?: string
  reason: string // 'spam', 'harassment', 'inappropriate', etc
  description?: string
  status: 'open' | 'investigating' | 'resolved' | 'dismissed'
  admin_notes?: string
  created_at: string
  updated_at: string
}

// ============================================================================
// SETTINGS (ADMIN ONLY)
// ============================================================================

export interface Settings {
  key: string // Unique key like 'maintenance_mode', 'max_users'
  value: any // JSON data
  updated_at: string
}

// ============================================================================
// SOCIAL (FOLLOWS + PROFILE MEDIA)
// ============================================================================

export interface Follow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
}

export interface ProfileMediaComment {
  id: string
  user_id: string
  name: string
  photo?: string
  text: string
  created_at: string
}

export interface ProfileMedia {
  id: string
  user_id: string
  media_url: string
  media_type: 'image' | 'gif' | 'video'
  likes: string[]
  comments: ProfileMediaComment[]
  created_at: string
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export type ChatTab = 'dm' | 'general' | 'feed' | 'forum' | 'settings' | 'games'

// ============================================================================
// REAL-TIME EVENTS
// ============================================================================

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE'

export interface RealtimePayload<T> {
  type: RealtimeEventType
  new?: T
  old?: T
  schema: string
  table: string
  commit_timestamp: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'inappropriate',
  'abuse',
  'other',
] as const
