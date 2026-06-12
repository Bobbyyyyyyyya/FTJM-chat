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
    updated_at: string;
}
export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    text: string;
    is_encrypted: boolean;
    iv?: string;
    deleted_at?: string;
    created_at: string;
}
export interface TypingStatus {
    conversation_id: string;
    user_id: string;
    is_typing: boolean;
    last_updated: string;
}
export declare function getConversations(): Promise<Conversation[]>;
export declare function getConversation(conversationId: string): Promise<{
    conversation: Conversation;
    messages: Message[];
}>;
export declare function createConversation(participants: string[], participantNames: string[], participantPhotos: string[], createdBy: string, title?: string): Promise<Conversation>;
export declare function sendMessage(conversationId: string, senderId: string, text: string, isEncrypted?: boolean, iv?: string): Promise<Message>;
export declare function deleteMessage(messageId: string): Promise<Message>;
export declare function setTypingStatus(conversationId: string, userId: string, isTyping: boolean): Promise<TypingStatus>;
export declare function getTypingStatus(conversationId: string): Promise<TypingStatus[]>;
import type { RealtimePayload } from './types';
export declare function subscribeToMessages(conversationId: string, callback: (payload: RealtimePayload<Message>) => void): import("@supabase/realtime-js").RealtimeChannel;
export declare function subscribeToTypingStatus(conversationId: string, callback: (typingUsers: TypingStatus[]) => void): import("@supabase/realtime-js").RealtimeChannel;
//# sourceMappingURL=db-conversations.d.ts.map