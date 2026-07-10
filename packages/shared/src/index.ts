// Shared types for the application
export interface User {
  id: string;
  email?: string | null;
  role?: 'user' | 'admin' | 'mod' | null;
  original_name?: string | null;
  public_key?: string | null;
  display_name?: string | null;
  name_locked_until?: string | null;
  bio?: string | null;
  bio_locked_until?: string | null;
  photo_url?: string | null;
  notification_settings?: {
    sound?: boolean;
    desktop?: boolean;
  } | null;
  custom_theme?: Record<string, unknown> | null;
  use_custom_theme?: boolean;
  custom_sounds?: Record<string, unknown> | null;
  admin_notes?: string | null;
  is_blocked?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  title?: string;
  is_group: boolean;
  participants: string[];
  participant_names: string[];
  participant_photos: string[];
  last_message?: string;
  last_message_at?: string;
  created_by: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_photo?: string;
  text: string;
  is_encrypted: boolean;
  created_at: string;
  deleted_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'mention' | 'reply' | 'system' | 'dm' | 'follow' | 'upload_media';
  content: string;
  resource_type: string;
  resource_id: string;
  is_read: boolean;
  created_at: string;
}

export interface TypingStatus {
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface ProfileMedia {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'gif';
  created_at: string;
}
