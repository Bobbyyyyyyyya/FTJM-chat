import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
export const useAuthStore = create((set) => ({
    user: null,
    loading: true,
    login: async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error)
                throw error;
            // Fetch user profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();
            set({ user: profile });
        }
        catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },
    signup: async (email, password, displayName) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error)
                throw error;
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
            set({ user: profile });
        }
        catch (error) {
            console.error('Signup error:', error);
            throw error;
        }
    },
    logout: async () => {
        await supabase.auth.signOut();
        set({ user: null });
    },
}));
//# sourceMappingURL=useAuth.js.map