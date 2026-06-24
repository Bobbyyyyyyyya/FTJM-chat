import { create } from 'zustand'
import { User } from '@ftjm/shared'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  pendingUser: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  unlockWithPassword: (password: string) => Promise<void>
  lockApp: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  pendingUser: null,
  loading: true,

  checkAuth: async () => {
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      if (data.session?.user?.id) {
        try {
          await supabase.realtime.setAuth(data.session.access_token)
        } catch (e) {
          console.warn('[Auth] setRealtimeAuth failed:', e)
        }
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single()
        if (profileError) throw profileError
        set({ pendingUser: profile, loading: false })
      } else {
        set({ user: null, loading: false })
      }
    } catch (error) {
      console.error('Auth check error:', error)
      set({ user: null, loading: false })
    }
  },

  unlockWithPassword: async (password: string) => {
    const { pendingUser } = get()
    if (!pendingUser?.email) throw new Error('No pending user')
    set({ loading: true })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: pendingUser.email,
        password,
      })
      if (error) throw error
      try {
        await supabase.realtime.setAuth(data.session?.access_token)
      } catch (e) {
        console.warn('[Auth] setRealtimeAuth failed after unlock:', e)
      }
      set({ user: pendingUser, pendingUser: null, loading: false })
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  lockApp: () => {
    const { user } = get()
    set({ user: null, pendingUser: user, loading: false })
  },

  login: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      try {
        await supabase.realtime.setAuth(data.session?.access_token)
      } catch (e) {
        console.warn('[Auth] setRealtimeAuth failed after login:', e)
      }
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
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      try {
        await supabase.realtime.setAuth(data.session?.access_token)
      } catch (e) {
        console.warn('[Auth] setRealtimeAuth failed after signup:', e)
      }
      const { data: profile } = await supabase
        .from('profiles')
        .insert([{ id: data.user?.id, email, display_name: displayName }])
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
    const { error } = await supabase.auth.signOut()
    try {
      await supabase.realtime.setAuth()
    } catch (e) {
      console.warn('[Auth] Failed to clear realtime auth token on logout:', e)
    }
    set({ user: null, pendingUser: null, loading: false })
  },
}))
