// Database service for managing posts (General Chat)
import { supabase } from './supabase'
import type { RealtimePayload } from './types'

export interface Post {
  id: string
  content: string
  author_id: string
  created_at: string
  updated_at: string
}

// Get all posts (General Chat - public for everyone)
export async function getPosts(limit = 50) {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('❌ Error fetching posts:', error)
    throw error
  }

  return data as Post[]
}

// Get posts by author
export async function getPostsByAuthor(authorId: string) {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching posts by author:', error)
    throw error
  }

  return data as Post[]
}

// Create a new post in general chat
export async function createPost(
  authorId: string,
  content: string
) {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId,
      content,
    })
    .select()
    .single()

  if (error) {
    console.error('❌ Error creating post:', error)
    throw error
  }

  return data as Post
}

// Update own post
export async function updatePost(
  postId: string,
  content: string
) {
  const { data, error } = await supabase
    .from('posts')
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .select()
    .single()

  if (error) {
    console.error('❌ Error updating post:', error)
    throw error
  }

  return data as Post
}

// Delete own post
export async function deletePost(postId: string) {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)

  if (error) {
    console.error('❌ Error deleting post:', error)
    throw error
  }
}

export function subscribeToGeneralChat(
  callback: (payload: RealtimePayload<Post>) => void
) {
  const channel = supabase
    .channel('posts-general')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'posts',
      },
      (payload: any) => {
        const eventType = (payload.eventType || payload.type || '').toString().toUpperCase()
        if (!eventType || !['INSERT', 'UPDATE', 'DELETE'].includes(eventType)) return
        callback({
          type: eventType as any,
          new: payload.new,
          old: payload.old,
          schema: payload.schema,
          table: payload.table,
          commit_timestamp: payload.commit_timestamp,
        })
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('❌ General chat realtime subscription error')
      }
    })

  return channel
}
