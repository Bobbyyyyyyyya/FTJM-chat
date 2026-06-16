// Database service for managing conversations (DMs)
import { supabase } from './supabase'
import type { RealtimePayload } from './types'

export interface Conversation {
  id: string
  title?: string
  is_group: boolean
  participants: string[]
  participant_names: string[]
  participant_photos: string[]
  last_message?: string
  last_message_at?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  text: string
  is_encrypted: boolean
  iv?: string
  deleted_at?: string
  created_at: string
}

export interface TypingStatus {
  conversation_id: string
  user_id: string
  is_typing: boolean
  last_updated: string
}

// Get all conversations for current user
export async function getConversations() {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching conversations:', error)
    throw error
  }

  return data as Conversation[]
}

// Get a single conversation with all messages
export async function getConversation(conversationId: string) {
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single()

  if (convError) {
    console.error('❌ Error fetching conversation:', convError)
    throw convError
  }

  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (msgError) {
    console.error('❌ Error fetching messages:', msgError)
    throw msgError
  }

  return {
    conversation: conversation as Conversation,
    messages: messages as Message[],
  }
}

// Create a new DM conversation (1-on-1 or group)
export async function createConversation(
  participants: string[],
  participantNames: string[],
  participantPhotos: string[],
  createdBy: string,
  title?: string
) {
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
    .single()

  if (error) {
    console.error('❌ Error creating conversation:', error)
    throw error
  }

  return data as Conversation
}

// Send a message in a conversation
export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  isEncrypted = false,
  iv?: string
) {
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
    .single()

  if (error) {
    console.error('❌ Error sending message:', error)
    throw error
  }

  return data as Message
}

// Delete a message (soft delete)
export async function deleteMessage(messageId: string) {
  const { data, error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)
    .select()
    .single()

  if (error) {
    console.error('❌ Error deleting message:', error)
    throw error
  }

  return data as Message
}

// Update typing status
export async function setTypingStatus(
  conversationId: string,
  userId: string,
  isTyping: boolean
) {
  const existing = await supabase
    .from('typing')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()

  const payload = {
    conversation_id: conversationId,
    user_id: userId,
    is_typing: isTyping,
    last_updated: new Date().toISOString(),
  }

  let query
  if (existing.data) {
    query = supabase
      .from('typing')
      .update(payload)
      .eq('id', existing.data.id)
  } else {
    query = supabase
      .from('typing')
      .insert({ ...payload, id: crypto.randomUUID() })
  }

  const { data, error } = await query.select().single()

  if (error) {
    console.error('❌ Error updating typing status:', error)
    throw error
  }

  return data as TypingStatus
}

// Get typing status for a conversation
export async function getTypingStatus(conversationId: string) {
  const { data, error } = await supabase
    .from('typing')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('is_typing', true)

  if (error) {
    console.error('❌ Error fetching typing status:', error)
    throw error
  }

  return data as TypingStatus[]
}

export function subscribeToMessages(
  conversationId: string,
  callback: (payload: RealtimePayload<Message>) => void
) {
  const topic = `messages-${conversationId}`
  const channel = supabase.channel(topic, { config: { private: true } })

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
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
    .subscribe()

  return channel
}

export function subscribeToTypingStatus(
  conversationId: string,
  callback: (typingUsers: TypingStatus[]) => void
) {
  const channel = supabase
    .channel(`typing-${conversationId}`, { config: { private: true } })
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'typing',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async () => {
        const users = await getTypingStatus(conversationId)
        callback(users)
      }
    )
    .subscribe()

  return channel
}
