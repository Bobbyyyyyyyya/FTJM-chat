// Database service for managing profiles
import { supabase } from './supabase'

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

export interface Notification {
  id: string
  user_id: string
  type: 'mention' | 'reply' | 'system' | 'dm'
  content: string
  resource_type?: 'post' | 'comment' | 'thread' | 'message'
  resource_id?: string
  is_read: boolean
  created_at: string
}

export interface Nickname {
  user_id: string
  nickname: string
  created_at: string
}

// Get current user's profile
export async function getCurrentProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single()

  if (error) {
    console.error('❌ Error fetching current profile:', error)
    throw error
  }

  return data as Profile
}

// Get any public profile
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('❌ Error fetching profile:', error)
    return null
  }

  return data as Profile | null
}

// Update own profile (display_name, bio, photo, settings, theme)
export async function updateProfile(updates: Partial<Profile>) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('❌ Error updating profile:', error)
    throw error
  }

  return data as Profile
}

// ====== NOTIFICATIONS (Geluid/alerts bij nieuwe berichten) ======

// Get all unread notifications
export async function getNotifications(isRead?: boolean) {
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })

  if (isRead !== undefined) {
    query = query.eq('is_read', isRead)
  }

  const { data, error } = await query

  if (error) {
    console.error('❌ Error fetching notifications:', error)
    throw error
  }

  return data as Notification[]
}

// Mark notification as read
export async function markNotificationAsRead(notificationId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .select()
    .single()

  if (error) {
    console.error('❌ Error marking notification as read:', error)
    throw error
  }

  return data as Notification
}

// Create notification (usually called from backend/triggers)
export async function createNotification(
  userId: string,
  type: 'mention' | 'reply' | 'system' | 'dm',
  content: string,
  resourceType?: 'post' | 'comment' | 'thread' | 'message',
  resourceId?: string
) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      content,
      resource_type: resourceType,
      resource_id: resourceId,
    })
    .select()
    .single()

  if (error) {
    console.error('❌ Error creating notification:', error)
    throw error
  }

  return data as Notification
}

// Delete notification
export async function deleteNotification(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)

  if (error) {
    console.error('❌ Error deleting notification:', error)
    throw error
  }
}

// Subscribe to real-time notifications
export function subscribeToNotifications(
  callback: (notification: Notification) => void
) {
  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      },
      (payload: any) => {
        callback(payload.new as Notification)
      }
    )
    .subscribe()

  return channel
}

// ====== NICKNAMES (@mentions) ======

// Get nickname for a user
export async function getNickname(userId: string) {
  const { data, error } = await supabase
    .from('nicknames')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // No nickname found
    }
    console.error('❌ Error fetching nickname:', error)
    throw error
  }

  return data as Nickname | null
}

// Set own nickname (for @mentions)
export async function setNickname(userId: string, nickname: string) {
  const { data, error } = await supabase
    .from('nicknames')
    .upsert({
      user_id: userId,
      nickname,
    })
    .select()
    .single()

  if (error) {
    console.error('❌ Error setting nickname:', error)
    throw error
  }

  return data as Nickname
}

// Delete own nickname
export async function deleteNickname(userId: string) {
  const { error } = await supabase
    .from('nicknames')
    .delete()
    .eq('user_id', userId)

  if (error) {
    console.error('❌ Error deleting nickname:', error)
    throw error
  }
}

// Get all nicknames (for @mentions autocomplete)
export async function getAllNicknames() {
  const { data, error } = await supabase
    .from('nicknames')
    .select('*')

  if (error) {
    console.error('❌ Error fetching nicknames:', error)
    throw error
  }

  return data as Nickname[]
}
