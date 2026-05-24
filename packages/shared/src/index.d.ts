export interface User {
    id: string;
    email: string;
    display_name: string;
    bio?: string;
    photo_url?: string;
    created_at: string;
}
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
}
export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_name: string;
    sender_photo?: string;
    text: string;
    is_encrypted: boolean;
    created_at: string;
    deleted_at?: string;
}
export interface Notification {
    id: string;
    user_id: string;
    type: 'mention' | 'reply' | 'system' | 'dm';
    content: string;
    resource_type: string;
    resource_id: string;
    is_read: boolean;
    created_at: string;
}
export interface TypingStatus {
    conversation_id: string;
    user_id: string;
    is_typing: boolean;
}
//# sourceMappingURL=index.d.ts.map