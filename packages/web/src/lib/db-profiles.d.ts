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
export interface Nickname {
    user_id: string;
    nickname: string;
    created_at: string;
}
export declare function getCurrentProfile(): Promise<Profile>;
export declare function getProfile(userId: string): Promise<Profile | null>;
export declare function updateProfile(updates: Partial<Profile>): Promise<Profile>;
export declare function getNotifications(isRead?: boolean): Promise<Notification[]>;
export declare function markNotificationAsRead(notificationId: string): Promise<Notification>;
export declare function createNotification(userId: string, type: 'mention' | 'reply' | 'system' | 'dm', content: string, resourceType?: 'post' | 'comment' | 'thread' | 'message', resourceId?: string): Promise<Notification>;
export declare function deleteNotification(notificationId: string): Promise<void>;
export declare function subscribeToNotifications(callback: (notification: Notification) => void): import("@supabase/realtime-js").RealtimeChannel;
export declare function getNickname(userId: string): Promise<Nickname | null>;
export declare function setNickname(userId: string, nickname: string): Promise<Nickname>;
export declare function deleteNickname(userId: string): Promise<void>;
export declare function getAllNicknames(): Promise<Nickname[]>;
//# sourceMappingURL=db-profiles.d.ts.map