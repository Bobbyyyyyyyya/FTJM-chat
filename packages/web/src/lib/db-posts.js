// Database service for managing posts (General Chat)
import { supabase } from './supabase';
// Get all posts (General Chat - public for everyone)
export async function getPosts(limit = 50) {
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) {
        console.error('❌ Error fetching posts:', error);
        throw error;
    }
    return data;
}
// Get posts by author
export async function getPostsByAuthor(authorId) {
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('author_id', authorId)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('❌ Error fetching posts by author:', error);
        throw error;
    }
    return data;
}
// Create a new post in general chat
export async function createPost(authorId, content) {
    const { data, error } = await supabase
        .from('posts')
        .insert({
        author_id: authorId,
        content,
    })
        .select()
        .single();
    if (error) {
        console.error('❌ Error creating post:', error);
        throw error;
    }
    return data;
}
// Update own post
export async function updatePost(postId, content) {
    const { data, error } = await supabase
        .from('posts')
        .update({
        content,
        updated_at: new Date().toISOString(),
    })
        .eq('id', postId)
        .select()
        .single();
    if (error) {
        console.error('❌ Error updating post:', error);
        throw error;
    }
    return data;
}
// Delete own post
export async function deletePost(postId) {
    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);
    if (error) {
        console.error('❌ Error deleting post:', error);
        throw error;
    }
}
export function subscribeToGeneralChat(callback) {
    const channel = supabase
        .channel('posts-general', { config: { private: true } })
        .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'posts',
    }, (payload) => {
        const p = {
            type: (payload.eventType || payload.type || '').toString().toUpperCase(),
            new: payload.new,
            old: payload.old,
            schema: payload.schema,
            table: payload.table,
            commit_timestamp: payload.commit_timestamp,
        };
        callback(p);
    })
        .subscribe();
    return channel;
}
//# sourceMappingURL=db-posts.js.map