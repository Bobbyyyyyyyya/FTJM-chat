/**
 * Type definitions for FTJM Chat Database
 * These types mirror your Supabase schema with RLS policies
 */
export interface Profile {
    id: string;
    email?: string | null;
    role?: 'user' | 'admin' | 'mod' | null;
    original_name?: string | null;
    public_key?: string | null;
    display_name?: string | null;
    name_locked_until?: string | null;
    bio?: string | null;
    bio_locked_until?: string | null;
    photo_url?: string | null;
    notification_settings?: {
        sound?: boolean;
        desktop?: boolean;
    } | null;
    custom_theme?: Record<string, unknown> | null;
    use_custom_theme?: boolean;
    custom_sounds?: Record<string, unknown> | null;
    admin_notes?: string | null;
    is_blocked?: boolean;
    created_at: string;
    updated_at: string;
}
export interface Nickname {
    user_id: string;
    nickname: string;
    created_at: string;
}
export interface Post {
    id: string;
    content: string;
    author_id: string;
    created_at: string;
    updated_at: string;
}
export interface ForumThread {
    id: string;
    title: string;
    content: string;
    author_id: string;
    category?: string;
    is_pinned: boolean;
    is_locked: boolean;
    reply_count: number;
    last_reply_at?: string;
    created_at: string;
    updated_at: string;
}
export interface ForumComment {
    id: string;
    thread_id: string;
    content: string;
    author_id: string;
    created_at: string;
    updated_at: string;
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
export interface Notification {
    id: string;
    user_id: string;
    type: 'mention' | 'reply' | 'system' | 'dm';
    content: string;
    resource_type?: 'post' | 'comment' | 'thread' | 'message';
    resource_id?: string;
    is_read: boolean;
    created_at: string;
}
export interface Report {
    id: string;
    reporter_id: string;
    reported_user_id?: string;
    reported_post_id?: string;
    reported_comment_id?: string;
    reason: string;
    description?: string;
    status: 'open' | 'investigating' | 'resolved' | 'dismissed';
    admin_notes?: string;
    created_at: string;
    updated_at: string;
}
export interface Whitelist {
    id: string;
    email: string;
    added_by?: string;
    created_at: string;
}
export interface Settings {
    key: string;
    value: any;
    updated_at: string;
}
export type ChatTab = 'dm' | 'general' | 'forum';
export interface ChatMessage {
    id: string;
    sender_id: string;
    sender_name: string;
    sender_photo?: string;
    text: string;
    timestamp: string;
    is_own: boolean;
}
export interface ChatState {
    activeTab: ChatTab;
    selectedConvId: string | null;
    messages: Message[];
    typingUsers: string[];
    isLoading: boolean;
    error?: string;
}
export interface ProfileUpdate {
    display_name?: string;
    bio?: string;
    photo_url?: string;
    thema?: 'dark' | 'light';
    notification_settings?: {
        sound?: boolean;
        desktop?: boolean;
    };
}
export interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    success: boolean;
}
export interface PaginatedResponse<T> {
    data: T[];
    count: number;
    total: number;
    page: number;
    pageSize: number;
}
export interface PermissionCheck {
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
}
export interface ConversationPermissions {
    canRead: boolean;
    canSendMessage: boolean;
    canDeleteMessage: boolean;
    canSeeTyping: boolean;
}
export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';
export interface RealtimePayload<T> {
    type: RealtimeEventType;
    new?: T;
    old?: T;
    schema: string;
    table: string;
    commit_timestamp: string;
}
export interface SubscriptionCallbacks<T> {
    onInsert?: (data: T) => void;
    onUpdate?: (data: T) => void;
    onDelete?: (data: T) => void;
    onError?: (error: Error) => void;
}
export declare const ROLES: {
    readonly USER: "user";
    readonly MOD: "mod";
    readonly ADMIN: "admin";
};
export declare const NOTIFICATION_TYPES: {
    readonly MENTION: "mention";
    readonly REPLY: "reply";
    readonly SYSTEM: "system";
    readonly DM: "dm";
};
export declare const REPORT_STATUS: {
    readonly OPEN: "open";
    readonly INVESTIGATING: "investigating";
    readonly RESOLVED: "resolved";
    readonly DISMISSED: "dismissed";
};
export declare const REPORT_REASONS: readonly ["spam", "harassment", "inappropriate", "abuse", "other"];
export declare const THEMES: {
    readonly DARK: "dark";
    readonly LIGHT: "light";
};
export type Theme = typeof THEMES[keyof typeof THEMES];
export type Role = typeof ROLES[keyof typeof ROLES];
export type ReportStatus = typeof REPORT_STATUS[keyof typeof REPORT_STATUS];
export type ReportReason = typeof REPORT_REASONS[number];
//# sourceMappingURL=types.d.ts.map