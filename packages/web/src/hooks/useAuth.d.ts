import { User } from '@ftjm/shared';
interface AuthState {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, displayName: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}
export declare const useAuthStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AuthState>>;
export {};
//# sourceMappingURL=useAuth.d.ts.map