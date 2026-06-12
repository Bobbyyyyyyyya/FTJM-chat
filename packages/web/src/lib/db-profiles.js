// Database service for managing profiles
import { supabase } from './supabase';
// Get current user's profile
export async function getCurrentProfile() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .single();
    if (error) {
        console.error('❌ Error fetching current profile:', error);
        throw error;
    }
    return data;
}
// Get any public profile
export async function getProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) {
        console.error('❌ Error fetching profile:', error);
        return null; // Return null instead of throwing - permission denied is expected
    }
    return data;
}
// Update own profile (display_name, bio, photo, settings, theme)
export async function updateProfile(updates) {
    const { data, error } = await supabase
        .from('profiles')
        .update({
        ...updates,
        updated_at: new Date().toISOString(),
    })
        .select()
        .single();
    if (error) {
        console.error('❌ Error updating profile:', error);
        throw error;
    }
    return data;
}
// ====== NOTIFICATIONS (Geluid/alerts bij nieuwe berichten) ======
// Get all unread notifications
export async function getNotifications(isRead) {
    let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
    if (isRead !== undefined) {
        query = query.eq('is_read', isRead);
    }
    const { data, error } = await query;
    if (error) {
        console.error('❌ Error fetching notifications:', error);
        throw error;
    }
    return data;
}
// Mark notification as read
export async function markNotificationAsRead(notificationId) {
    const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .select()
        .single();
    if (error) {
        console.error('❌ Error marking notification as read:', error);
        throw error;
    }
    return data;
}
// Create notification (usually called from backend/triggers)
export async function createNotification(userId, type, content, resourceType, resourceId) {
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
        .single();
    if (error) {
        console.error('❌ Error creating notification:', error);
        throw error;
    }
    return data;
}
// Delete notification
export async function deleteNotification(notificationId) {
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
    if (error) {
        console.error('❌ Error deleting notification:', error);
        throw error;
    }
}
// Subscribe to real-time notifications
export function subscribeToNotifications(callback) {
    const channel = supabase
        .channel('notifications')
        .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
    }, (payload) => {
        callback(payload.new);
    })
        .subscribe();
    return channel;
}
// ====== NICKNAMES (@mentions) ======
// Get nickname for a user
export async function getNickname(userId) {
    const { data, error } = await supabase
        .from('nicknames')
        .select('*')
        .eq('user_id', userId)
        .single();
    if (error) {
        if (error.code === 'PGRST116') {
            return null; // No nickname found
        }
        console.error('❌ Error fetching nickname:', error);
        throw error;
    }
    return data;
}
// Set own nickname (for @mentions)
export async function setNickname(userId, nickname) {
    const { data, error } = await supabase
        .from('nicknames')
        .upsert({
        user_id: userId,
        nickname,
    })
        .select()
        .single();
    if (error) {
        console.error('❌ Error setting nickname:', error);
        throw error;
    }
    return data;
}
// Delete own nickname
export async function deleteNickname(userId) {
    const { error } = await supabase
        .from('nicknames')
        .delete()
        .eq('user_id', userId);
    if (error) {
        console.error('❌ Error deleting nickname:', error);
        throw error;
    }
}
// Get all nicknames (for @mentions autocomplete)
export async function getAllNicknames() {
    const { data, error } = await supabase
        .from('nicknames')
        .select('*');
    if (error) {
        console.error('❌ Error fetching nicknames:', error);
        throw error;
    }
    return data;
}
//# sourceMappingURL=db-profiles.js.map