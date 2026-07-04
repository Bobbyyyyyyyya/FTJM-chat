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
// FORUM (PUBLIC - Everyone sees)
// ============================================================================

export interface ForumThread {
  id: string
  title: string
  content: string
  author_id: string
  category?: string
  is_pinned: boolean
  is_locked: boolean
  reply_count: number
  last_reply_at?: string
  created_at: string
  updated_at: string
}

export interface ForumComment {
  id: string
  thread_id: string
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
  type: 'mention' | 'reply' | 'system' | 'dm'
  content: string
  resource_type?: 'post' | 'comment' | 'thread' | 'message'
  resource_id?: string // Links to post/comment/thread/message
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

export interface Whitelist {
  id: string
  email: string
  added_by?: string // Who added this email
  created_at: string
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
// HELPER TYPES
// ============================================================================

export type ChatTab = 'dm' | 'general' | 'forum' | 'settings' | 'games'

export interface ChatMessage {
  id: string
  sender_id: string
  sender_name: string
  sender_photo?: string
  text: string
  timestamp: string
  is_own: boolean // For UI convenience
}

export interface ChatState {
  activeTab: ChatTab
  selectedConvId: string | null
  messages: Message[]
  typingUsers: string[]
  isLoading: boolean
  error?: string
}

export interface ProfileUpdate {
  display_name?: string
  bio?: string
  photo_url?: string
  thema?: 'dark' | 'light'
  notification_settings?: {
    sound?: boolean
    desktop?: boolean
  }
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  total: number
  page: number
  pageSize: number
}

// ============================================================================
// RLS PERMISSION CHECKS
// ============================================================================

export interface PermissionCheck {
  canRead: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

export interface ConversationPermissions {
  canRead: boolean
  canSendMessage: boolean
  canDeleteMessage: boolean
  canSeeTyping: boolean
}

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

export interface SubscriptionCallbacks<T> {
  onInsert?: (data: T) => void
  onUpdate?: (data: T) => void
  onDelete?: (data: T) => void
  onError?: (error: Error) => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const ROLES = {
  USER: 'user',
  MOD: 'mod',
  ADMIN: 'admin',
} as const

export const NOTIFICATION_TYPES = {
  MENTION: 'mention',
  REPLY: 'reply',
  SYSTEM: 'system',
  DM: 'dm',
} as const

export const REPORT_STATUS = {
  OPEN: 'open',
  INVESTIGATING: 'investigating',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
} as const

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'inappropriate',
  'abuse',
  'other',
] as const

export const THEMES = {
  DARK: 'dark',
  LIGHT: 'light',
} as const

export type Theme = typeof THEMES[keyof typeof THEMES]
export type Role = typeof ROLES[keyof typeof ROLES]
export type ReportStatus = typeof REPORT_STATUS[keyof typeof REPORT_STATUS]
export type ReportReason = typeof REPORT_REASONS[number]
