// Database service for managing forum (threads and comments)
import { supabase } from './supabase';
// ====== THREADS ======
// Get all forum threads
export async function getForumThreads(category, limit = 50) {
    let query = supabase
        .from('forum_threads')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
    if (category) {
        query = query.eq('category', category);
    }
    const { data, error } = await query;
    if (error) {
        console.error('❌ Error fetching forum threads:', error);
        throw error;
    }
    return data;
}
// Get single thread with comments
export async function getForumThread(threadId) {
    const { data: thread, error: threadError } = await supabase
        .from('forum_threads')
        .select('*')
        .eq('id', threadId)
        .single();
    if (threadError) {
        console.error('❌ Error fetching thread:', threadError);
        throw threadError;
    }
    const { data: comments, error: commentsError } = await supabase
        .from('forum_comments')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
    if (commentsError) {
        console.error('❌ Error fetching comments:', commentsError);
        throw commentsError;
    }
    return {
        thread: thread,
        comments: comments,
    };
}
// Create forum thread
export async function createForumThread(authorId, title, content, category) {
    const { data, error } = await supabase
        .from('forum_threads')
        .insert({
        author_id: authorId,
        title,
        content,
        category,
        is_pinned: false,
        is_locked: false,
        reply_count: 0,
    })
        .select()
        .single();
    if (error) {
        console.error('❌ Error creating forum thread:', error);
        throw error;
    }
    return data;
}
// Update own forum thread
export async function updateForumThread(threadId, title, content) {
    const { data, error } = await supabase
        .from('forum_threads')
        .update({
        title,
        content,
        updated_at: new Date().toISOString(),
    })
        .eq('id', threadId)
        .select()
        .single();
    if (error) {
        console.error('❌ Error updating forum thread:', error);
        throw error;
    }
    return data;
}
// Delete own forum thread
export async function deleteForumThread(threadId) {
    const { error } = await supabase
        .from('forum_threads')
        .delete()
        .eq('id', threadId);
    if (error) {
        console.error('❌ Error deleting forum thread:', error);
        throw error;
    }
}
// ====== COMMENTS ======
// Post a comment on a forum thread
export async function postForumComment(threadId, authorId, content) {
    const { data, error } = await supabase
        .from('forum_comments')
        .insert({
        thread_id: threadId,
        author_id: authorId,
        content,
    })
        .select()
        .single();
    if (error) {
        console.error('❌ Error posting forum comment:', error);
        throw error;
    }
    // Increment reply count on thread
    const { data: thread } = await supabase
        .from('forum_threads')
        .select('reply_count')
        .eq('id', threadId)
        .single();
    if (thread) {
        await supabase
            .from('forum_threads')
            .update({
            reply_count: (thread.reply_count || 0) + 1,
            last_reply_at: new Date().toISOString(),
        })
            .eq('id', threadId);
    }
    return data;
}
// Update own forum comment
export async function updateForumComment(commentId, content) {
    const { data, error } = await supabase
        .from('forum_comments')
        .update({
        content,
        updated_at: new Date().toISOString(),
    })
        .eq('id', commentId)
        .select()
        .single();
    if (error) {
        console.error('❌ Error updating forum comment:', error);
        throw error;
    }
    return data;
}
// Delete own forum comment
export async function deleteForumComment(commentId, threadId) {
    const { error } = await supabase
        .from('forum_comments')
        .delete()
        .eq('id', commentId);
    if (error) {
        console.error('❌ Error deleting forum comment:', error);
        throw error;
    }
    // Decrement reply count on thread
    const { data: thread } = await supabase
        .from('forum_threads')
        .select('reply_count')
        .eq('id', threadId)
        .single();
    if (thread) {
        await supabase
            .from('forum_threads')
            .update({
            reply_count: Math.max(0, (thread.reply_count || 1) - 1),
        })
            .eq('id', threadId);
    }
}
// Subscribe to real-time forum updates
export function subscribeToForumThread(threadId, callback) {
    const channel = supabase
        .channel(`forum-comments-${threadId}`)
        .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'forum_comments',
        filter: `thread_id=eq.${threadId}`,
    }, (payload) => {
        callback(payload.new);
    })
        .subscribe();
    return channel;
}
//# sourceMappingURL=db-forum.js.map