import { create } from 'zustand'
import { User } from '@ftjm/shared'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  checkAuth: async () => {
    try {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user?.id) {
        // User is logged in, fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single()
        set({ user: profile || null, loading: false })
      } else {
        set({ user: null, loading: false })
      }
    } catch (error) {
      console.error('Auth check error:', error)
      set({ user: null, loading: false })
    }
  },

  login: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      set({ user: profile, loading: false })
    } catch (error) {
      console.error('Login error:', error)
      set({ loading: false })
      throw error
    }
  },

  signup: async (email: string, password: string, displayName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (error) throw error

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
        .single()

      set({ user: profile, loading: false })
    } catch (error) {
      console.error('Signup error:', error)
      set({ loading: false })
      throw error
    }
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, loading: false })
  },
}))
