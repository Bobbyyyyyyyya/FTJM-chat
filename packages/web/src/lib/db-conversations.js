// Database service for managing conversations (DMs)
import { supabase } from './supabase';
// Get all conversations for current user
export async function getConversations() {
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false });
    if (error) {
        console.error('❌ Error fetching conversations:', error);
        throw error;
    }
    return data;
}
// Get a single conversation with all messages
export async function getConversation(conversationId) {
    const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
    if (convError) {
        console.error('❌ Error fetching conversation:', convError);
        throw convError;
    }
    const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
    if (msgError) {
        console.error('❌ Error fetching messages:', msgError);
        throw msgError;
    }
    return {
        conversation: conversation,
        messages: messages,
    };
}
// Create a new DM conversation (1-on-1 or group)
export async function createConversation(participants, participantNames, participantPhotos, createdBy, title) {
    const { data, error } = await supabase
        .from('conversations')
        .insert({
        title,
        is_group: participants.length > 2,
        participants,
        participant_names: participantNames,
        participant_photos: participantPhotos,
        created_by: createdBy,
    })
        .select()
        .single();
    if (error) {
        console.error('❌ Error creating conversation:', error);
        throw error;
    }
    return data;
}
// Send a message in a conversation
export async function sendMessage(conversationId, senderId, text, isEncrypted = false, iv) {
    const { data, error } = await supabase
        .from('messages')
        .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        text,
        is_encrypted: isEncrypted,
        iv,
    })
        .select()
        .single();
    if (error) {
        console.error('❌ Error sending message:', error);
        throw error;
    }
    return data;
}
// Delete a message (soft delete)
export async function deleteMessage(messageId) {
    const { data, error } = await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId)
        .select()
        .single();
    if (error) {
        console.error('❌ Error deleting message:', error);
        throw error;
    }
    return data;
}
// Update typing status
export async function setTypingStatus(conversationId, userId, isTyping) {
    const existing = await supabase
        .from('typing')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();
    const payload = {
        conversation_id: conversationId,
        user_id: userId,
        is_typing: isTyping,
        last_updated: new Date().toISOString(),
    };
    let query;
    if (existing.data) {
        query = supabase
            .from('typing')
            .update(payload)
            .eq('id', existing.data.id);
    }
    else {
        query = supabase
            .from('typing')
            .insert({ ...payload, id: crypto.randomUUID() });
    }
    const { data, error } = await query.select().single();
    if (error) {
        console.error('❌ Error updating typing status:', error);
        throw error;
    }
    return data;
}
// Get typing status for a conversation
export async function getTypingStatus(conversationId) {
    const { data, error } = await supabase
        .from('typing')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_typing', true);
    if (error) {
        console.error('❌ Error fetching typing status:', error);
        throw error;
    }
    return data;
}
export function subscribeToMessages(conversationId, callback) {
    const topic = `messages-${conversationId}`;
    const channel = supabase.channel(topic, { config: { private: true } });
    console.log('[Realtime] creating message channel', {
        topic,
        conversationId,
        channelType: 'postgres_changes',
        private: true,
    });
    const subscribedChannel = channel
        .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
    }, (payload) => {
        console.log('[Realtime] messages payload', {
            topic,
            selectedConvId: conversationId,
            event: payload.eventType || payload.type,
            payload,
            new: Boolean(payload.new),
            old: Boolean(payload.old),
            commit_timestamp: payload.commit_timestamp,
            schema: payload.schema,
            table: payload.table,
        });
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
        .subscribe((status) => {
        console.log('[Realtime] messages channel status', {
            topic,
            status,
            channelState: channel?.state,
            channelId: channel?.id,
        });
    });
    console.debug('[Realtime] messages subscribe returned', {
        topic,
        subscribedChannel,
    });
    return subscribedChannel;
}
// Subscribe to real-time typing status
export function subscribeToTypingStatus(conversationId, callback) {
    const channel = supabase
        .channel(`typing-${conversationId}`, { config: { private: true } })
        .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'typing',
        filter: `conversation_id=eq.${conversationId}`,
    }, async () => {
        const users = await getTypingStatus(conversationId);
        callback(users);
    })
        .subscribe();
    return channel;
}
//# sourceMappingURL=db-conversations.js.map