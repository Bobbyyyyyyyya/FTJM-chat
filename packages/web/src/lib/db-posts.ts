// Database service for managing posts (General Chat)
import { supabase } from './supabase'

export interface Post {
  id: string
  title: string
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
  title: string,
  content: string
) {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId,
      title,
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
  title: string,
  content: string
) {
  const { data, error } = await supabase
    .from('posts')
    .update({
      title,
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

// Subscribe to real-time posts (General Chat updates)
export function subscribeToGeneralChat(
  callback: (post: Post) => void
) {
  const subscription = supabase
    .from('posts')
    .on('*', (payload) => {
      callback(payload.new as Post)
    })
    .subscribe()

  return subscription
}
