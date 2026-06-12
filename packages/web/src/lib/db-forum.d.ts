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
export declare function getForumThreads(category?: string, limit?: number): Promise<ForumThread[]>;
export declare function getForumThread(threadId: string): Promise<{
    thread: ForumThread;
    comments: ForumComment[];
}>;
export declare function createForumThread(authorId: string, title: string, content: string, category?: string): Promise<ForumThread>;
export declare function updateForumThread(threadId: string, title: string, content: string): Promise<ForumThread>;
export declare function deleteForumThread(threadId: string): Promise<void>;
export declare function postForumComment(threadId: string, authorId: string, content: string): Promise<ForumComment>;
export declare function updateForumComment(commentId: string, content: string): Promise<ForumComment>;
export declare function deleteForumComment(commentId: string, threadId: string): Promise<void>;
export declare function subscribeToForumThread(threadId: string, callback: (comment: ForumComment) => void): import("@supabase/realtime-js").RealtimeChannel;
//# sourceMappingURL=db-forum.d.ts.map