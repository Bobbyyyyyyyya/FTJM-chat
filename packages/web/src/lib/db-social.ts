import { supabase } from './supabase'
import type { ProfileMedia } from './types'
import { createNotification, getProfile, updateProfile } from './db-profiles'
import { socialLimiter, uploadLimiter, enforceRateLimit } from './rateLimiter'

async function getCustomTheme(userId: string): Promise<Record<string, unknown>> {
  const profile = await getProfile(userId)
  return { ...(profile?.custom_theme || {}) }
}

async function getFollowingList(userId: string): Promise<string[]> {
  const theme = await getCustomTheme(userId)
  return (theme.following as string[]) || []
}

async function setFollowingList(userId: string, following: string[]): Promise<void> {
  const profile = await getProfile(userId)
  const customTheme = { ...(profile?.custom_theme || {}), following }
  await updateProfile(userId, { custom_theme: customTheme as Record<string, unknown> })
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) {
    console.warn('Cannot follow yourself')
    return
  }
  enforceRateLimit(socialLimiter, `follow:${followerId}`, 'Volgen')
  const following = await getFollowingList(followerId)
  if (!following.includes(followingId)) {
    following.push(followingId)
  }
  await setFollowingList(followerId, following)

  const followerProfile = await getProfile(followerId)
  const displayName = followerProfile?.display_name || 'Someone'
  await createNotification(
    followingId,
    'follow',
    `${displayName} is je nu aan het volgen`
  )
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const following = await getFollowingList(followerId)
  const updated = following.filter((id) => id !== followingId)
  await setFollowingList(followerId, updated)
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const following = await getFollowingList(followerId)
  return following.includes(followingId)
}

export async function getFollowerCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .contains('custom_theme', { following: [userId] })

  if (error) {
    console.error('Error getting follower count:', error)
    return 0
  }

  return count || 0
}

export async function getFollowingCount(userId: string): Promise<number> {
  const following = await getFollowingList(userId)
  return following.length
}

export async function getFollowingIds(userId: string): Promise<string[]> {
  return getFollowingList(userId)
}

export async function getFollowers(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .contains('custom_theme', { following: [userId] })

  if (error) {
    console.error('Error getting followers:', error)
    return []
  }

  return (data as { id: string }[]).map((p) => p.id)
}

// ============================================================================
// PROFILE MEDIA
// ============================================================================

export async function getProfileMedia(userId: string): Promise<ProfileMedia[]> {
  const { data, error } = await supabase
    .from('profile_media')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching profile media:', error)
    return []
  }

  return data as ProfileMedia[]
}

export async function uploadProfileMedia(
  userId: string,
  mediaUrl: string,
  mediaType: 'image' | 'gif'
): Promise<ProfileMedia> {
  enforceRateLimit(uploadLimiter, `upload:${userId}`, 'Media uploaden')
  const { data, error } = await supabase
    .from('profile_media')
    .insert({ user_id: userId, media_url: mediaUrl, media_type: mediaType, likes: [], comments: [] })
    .select()
    .single()

  if (error) {
    console.error('Error uploading profile media:', error)
    throw error
  }

  const followers = await getFollowers(userId)
  const profile = await getProfile(userId)
  const displayName = profile?.display_name || 'Someone'

  await Promise.all(
    followers.map((fid) =>
      createNotification(
        fid,
        'upload_media',
        `${displayName} heeft nieuwe media geüpload`,
        'profile_media',
        data.id
      )
    )
  )

  return data as ProfileMedia
}

export async function deleteProfileMedia(mediaId: string): Promise<void> {
  const { error } = await supabase
    .from('profile_media')
    .delete()
    .eq('id', mediaId)

  if (error) {
    console.error('Error deleting profile media:', error)
    throw error
  }
}

// ============================================================================
// LIKES
// ============================================================================

export async function likeMedia(mediaId: string, userId: string): Promise<void> {
  enforceRateLimit(socialLimiter, `like:${userId}`, 'Likes')
  const { data: media, error: fetchError } = await supabase
    .from('profile_media')
    .select('likes')
    .eq('id', mediaId)
    .single()

  if (fetchError) {
    console.error('Error fetching media for like:', fetchError)
    return
  }

  const likes: string[] = (media?.likes as string[]) || []
  if (likes.includes(userId)) return

  const { error } = await supabase
    .from('profile_media')
    .update({ likes: [...likes, userId] })
    .eq('id', mediaId)

  if (error) console.error('Error liking media:', error)
}

export async function unlikeMedia(mediaId: string, userId: string): Promise<void> {
  const { data: media, error: fetchError } = await supabase
    .from('profile_media')
    .select('likes')
    .eq('id', mediaId)
    .single()

  if (fetchError) {
    console.error('Error fetching media for unlike:', fetchError)
    return
  }

  const likes: string[] = (media?.likes as string[]) || []
  const updated = likes.filter((id) => id !== userId)

  const { error } = await supabase
    .from('profile_media')
    .update({ likes: updated })
    .eq('id', mediaId)

  if (error) console.error('Error unliking media:', error)
}

// ============================================================================
// COMMENTS
// ============================================================================

export async function addComment(
  mediaId: string,
  userId: string,
  name: string,
  text: string,
  photo?: string
): Promise<void> {
  enforceRateLimit(socialLimiter, `comment:${userId}`, 'Reacties plaatsen')
  const { data: media, error: fetchError } = await supabase
    .from('profile_media')
    .select('comments')
    .eq('id', mediaId)
    .single()

  if (fetchError) {
    console.error('Error fetching media for comment:', fetchError)
    return
  }

  const comments: any[] = (media?.comments as any[]) || []
  const newComment = {
    id: crypto.randomUUID(),
    user_id: userId,
    name,
    photo: photo || null,
    text,
    created_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('profile_media')
    .update({ comments: [...comments, newComment] })
    .eq('id', mediaId)

  if (error) console.error('Error adding comment:', error)
}

export async function deleteComment(mediaId: string, commentId: string): Promise<void> {
  const { data: media, error: fetchError } = await supabase
    .from('profile_media')
    .select('comments')
    .eq('id', mediaId)
    .single()

  if (fetchError) {
    console.error('Error fetching media for comment delete:', fetchError)
    return
  }

  const comments: any[] = (media?.comments as any[]) || []
  const updated = comments.filter((c: any) => c.id !== commentId)

  const { error } = await supabase
    .from('profile_media')
    .update({ comments: updated })
    .eq('id', mediaId)

  if (error) console.error('Error deleting comment:', error)
}

// ============================================================================
// FEED (media from followed users + own)
// ============================================================================

export async function getFeedMedia(userId: string, limit = 50, offset = 0): Promise<ProfileMedia[]> {
  const followingIds = await getFollowingIds(userId)
  const ids = [...new Set([...followingIds, userId])]

  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('profile_media')
    .select('*')
    .in('user_id', ids)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching feed:', error)
    return []
  }

  return data as ProfileMedia[]
}

// ============================================================================
// REALTIME SUBSCRIPTIONS
// ============================================================================

export function subscribeToProfileMedia(
  userId: string,
  callback: (payload: { type: 'INSERT' | 'DELETE'; new?: ProfileMedia; old?: ProfileMedia }) => void
) {
  const channel = supabase
    .channel('profile-media-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'profile_media', filter: `user_id=eq.${userId}` },
      (payload: any) => callback({ type: 'INSERT', new: payload.new as ProfileMedia })
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'profile_media', filter: `user_id=eq.${userId}` },
      (payload: any) => callback({ type: 'DELETE', old: payload.old as ProfileMedia })
    )
    .subscribe()

  return channel
}

export function subscribeToFeed(
  followingIds: string[],
  callback: (payload: { type: 'INSERT'; new: ProfileMedia }) => void
) {
  if (followingIds.length === 0) return null

  const channel = supabase
    .channel('feed-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'profile_media' },
      (payload: any) => {
        const media = payload.new as ProfileMedia
        if (followingIds.includes(media.user_id)) {
          callback({ type: 'INSERT', new: media })
        }
      }
    )
    .subscribe()

  return channel
}
