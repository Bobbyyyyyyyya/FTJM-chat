// Export all database services
export * from './db-conversations'
export * from './db-posts'
export * from './db-profiles'
export * from './db-forum'

import { supabase } from './supabase'

/**
 * RLS Policy Reference (for developers)
 *
 * 📚 PROFILES (Own profile only)
 *   - SELECT: authenticated, own id only
 *   - INSERT: authenticated, own id only
 *   - UPDATE: authenticated, own id only
 *
 * 💬 POSTS (General Chat - Public)
 *   - SELECT: public (everyone)
 *   - INSERT: authenticated (own author_id)
 *   - UPDATE: authenticated (own or admin)
 *   - DELETE: authenticated (own or admin)
 *
 * 🔒 CONVERSATIONS (DMs - Participants only)
 *   - SELECT: authenticated, only if in participants array
 *   - INSERT: authenticated, only if you're in participants
 *   - UPDATE: authenticated, only if participant
 *   - DELETE: authenticated, only if participant
 *
 * 💬 MESSAGES (DM Messages - Participants only)
 *   - SELECT: authenticated, only if participant and not deleted
 *   - INSERT: authenticated, sender_id must be you
 *   - UPDATE: authenticated, sender_id must be you
 *   - DELETE: authenticated, sender_id must be you
 *
 * ⌨️ TYPING (Live typing indicator)
 *   - SELECT: authenticated, only if in conversation
 *   - INSERT: authenticated, user_id must be you
 *   - UPDATE: authenticated, user_id must be you
 *   - DELETE: authenticated, user_id must be you
 *
 * 🔔 NOTIFICATIONS (Alerts - Private)
 *   - SELECT: authenticated, own notifications only
 *   - INSERT: authenticated, for own user_id
 *   - UPDATE: authenticated, own only
 *   - DELETE: authenticated, own only
 *
 * 📢 FORUM_THREADS (Public discussions)
 *   - SELECT: public
 *   - INSERT: authenticated (own author_id)
 *   - UPDATE: authenticated (own or admin)
 *   - DELETE: authenticated (own or admin)
 *
 * 💬 FORUM_COMMENTS (Public thread replies)
 *   - SELECT: public
 *   - INSERT: authenticated (own author_id)
 *   - UPDATE: authenticated (own only)
 *   - DELETE: authenticated (own only)
 *
 * 📝 SETTINGS (Admin controlled)
 *   - SELECT: public
 *   - INSERT: authenticated (admin only)
 *   - UPDATE: authenticated (admin only)
 *   - DELETE: authenticated (admin only)
 *
 * 📎 NICKNAMES (@mention support)
 *   - SELECT: public
 *   - INSERT: authenticated (own user_id)
 *   - UPDATE: authenticated (own only)
 *   - DELETE: authenticated (own only)
 *
 * 📋 REPORTS (Issue reports)
 *   - SELECT: authenticated (own reports only)
 *   - INSERT: authenticated (own reporter_id)
 *   - DELETE: disabled
 *
 * ✅ WHITELIST (Beta access)
 *   - SELECT: public
 *   - INSERT: public (if email NOT NULL)
 *   - DELETE: public
 */

// Re-export main client
export { supabase }

// Type-safe RLS check helpers
export async function checkCanAccessConversation(
  conversationId: string,
  userId: string
) {
  try {
    const { data } = await supabase
      .from('conversations')
      .select('participants')
      .eq('id', conversationId)
      .single()

    return data?.participants?.includes(userId) ?? false
  } catch {
    return false
  }
}

export async function checkCanEditProfile(userId: string, currentUserId: string) {
  return userId === currentUserId
}

export async function checkCanEditPost(
  postId: string,
  currentUserId: string
) {
  try {
    const { data } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single()

    return data?.author_id === currentUserId
  } catch {
    return false
  }
}

export async function checkCanSendMessage(
  conversationId: string,
  userId: string
) {
  return checkCanAccessConversation(conversationId, userId)
}
