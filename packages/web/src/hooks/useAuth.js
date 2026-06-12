import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
export const useAuthStore = create((set) => ({
    user: null,
    loading: true,
    checkAuth: async () => {
        try {
            const { data, error } = await supabase.auth.getSession();
            console.debug('[Auth] getSession result', { data, error });
            if (error) {
                throw error;
            }
            if (data.session?.user?.id) {
                // Ensure Realtime client has the current access token
                console.debug('[Auth] checkAuth setRealtimeAuth', {
                    userId: data.session.user.id,
                    hasToken: Boolean(data.session.access_token),
                    accessToken: data.session.access_token?.slice(0, 24),
                    supabaseClient: {
                        hasAuth: Boolean(supabase?.auth),
                        hasFrom: typeof supabase?.from,
                    },
                });
                if (!supabase || typeof supabase.from !== 'function') {
                    throw new Error('Supabase client is not initialized or invalid');
                }
                try {
                    const result = await supabase.realtime.setAuth(data.session.access_token);
                    console.debug('[Auth] setRealtimeAuth completed', {
                        userId: data.session.user.id,
                        tokenPresent: Boolean(data.session.access_token),
                        result,
                    });
                }
                catch (e) {
                    console.warn('Failed to set realtime auth token:', e);
                }
                // User is logged in, fetch profile
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.session.user.id)
                    .single();
                console.debug('[Auth] profile fetch after checkAuth', { profile, profileError });
                if (profileError) {
                    throw profileError;
                }
                set({ user: profile || null, loading: false });
            }
            else {
                set({ user: null, loading: false });
            }
        }
        catch (error) {
            console.error('Auth check error:', error);
            set({ user: null, loading: false });
        }
    },
    login: async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            console.debug('[Auth] signInWithPassword result', { data, error });
            if (error)
                throw error;
            // Set realtime auth token after login so channels use same user
            console.debug('[Auth] login setRealtimeAuth', {
                userId: data.user?.id,
                hasToken: Boolean(data.session?.access_token),
                accessToken: data.session?.access_token?.slice(0, 24),
            });
            try {
                const result = await supabase.realtime.setAuth(data.session?.access_token);
                console.debug('[Auth] login setRealtimeAuth completed', {
                    userId: data.user?.id,
                    tokenPresent: Boolean(data.session?.access_token),
                    result,
                });
            }
            catch (e) {
                console.warn('Failed to set realtime auth token after login:', e);
            }
            // Fetch user profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();
            set({ user: profile, loading: false });
        }
        catch (error) {
            console.error('Login error:', error);
            set({ loading: false });
            throw error;
        }
    },
    signup: async (email, password, displayName) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });
            console.debug('[Auth] signUp result', { data, error });
            if (error)
                throw error;
            // If signup returns a session, set realtime auth
            console.debug('[Auth] signup setRealtimeAuth', {
                userId: data.user?.id,
                hasToken: Boolean(data.session?.access_token),
                accessToken: data.session?.access_token?.slice(0, 24),
            });
            try {
                const result = await supabase.realtime.setAuth(data.session?.access_token);
                console.debug('[Auth] signup setRealtimeAuth completed', { result });
            }
            catch (e) {
                console.warn('Failed to set realtime auth token after signup:', e);
            }
            // Create profile
            const { data: profile } = await supabase
                .from('profiles')
                .insert([
                {
                    id: data.user?.id,
                    email,
                    display_name: displayName,
                },
            ])
                .select()
                .single();
            set({ user: profile, loading: false });
        }
        catch (error) {
            console.error('Signup error:', error);
            set({ loading: false });
            throw error;
        }
    },
    logout: async () => {
        console.debug('[Auth] logout start');
        const { error } = await supabase.auth.signOut();
        console.debug('[Auth] signOut result', { error });
        try {
            const result = await supabase.realtime.setAuth();
            console.debug('[Auth] cleared realtime auth token', { result });
        }
        catch (e) {
            console.warn('Failed to clear realtime auth token on logout:', e);
        }
        set({ user: null, loading: false });
    },
}));
//# sourceMappingURL=useAuth.js.map