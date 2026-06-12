export interface Post {
    id: string;
    content: string;
    author_id: string;
    created_at: string;
    updated_at: string;
}
export declare function getPosts(limit?: number): Promise<Post[]>;
export declare function getPostsByAuthor(authorId: string): Promise<Post[]>;
export declare function createPost(authorId: string, content: string): Promise<Post>;
export declare function updatePost(postId: string, content: string): Promise<Post>;
export declare function deletePost(postId: string): Promise<void>;
import type { RealtimePayload } from './types';
export declare function subscribeToGeneralChat(callback: (payload: RealtimePayload<Post>) => void): import("@supabase/realtime-js").RealtimeChannel;
//# sourceMappingURL=db-posts.d.ts.map