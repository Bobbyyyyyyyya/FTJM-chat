import { create } from 'zustand'
import { User } from '@ftjm/shared'
import { supabase } from '@/lib/supabase'

const PASSWORD_EXPIRY_DAYS = 30

interface AuthState {
  user: User | null
  pendingUser: User | null
  passwordExpired: boolean
  verified: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  unlockWithPassword: (password: string) => Promise<void>
  changeExpiredPassword: (newPassword: string) => Promise<void>
  lockApp: () => void
}

function isPasswordExpired(profile: User | null): boolean {
  if (!profile?.password_changed_at) return true
  const changed = new Date(profile.password_changed_at).getTime()
  const now = Date.now()
  const diffDays = (now - changed) / (1000 * 60 * 60 * 24)
  return diffDays >= PASSWORD_EXPIRY_DAYS
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  pendingUser: null,
  passwordExpired: false,
  verified: false,
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
        const expired = isPasswordExpired(profile)
        if (expired) {
          set({ pendingUser: profile, passwordExpired: true, verified: false, loading: false })
        } else {
          set({ user: profile, loading: false })
        }
      } else {
        set({ user: null, loading: false })
      }
    } catch (error) {
      console.error('Auth check error:', error)
      set({ user: null, loading: false })
    }
  },

  unlockWithPassword: async (password: string) => {
    const { pendingUser, passwordExpired } = get()
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
      if (passwordExpired) {
        set({ verified: true, loading: false })
      } else {
        set({ user: pendingUser, pendingUser: null, verified: false, loading: false })
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  changeExpiredPassword: async (newPassword: string) => {
    const { pendingUser } = get()
    if (!pendingUser) throw new Error('No pending user')
    set({ loading: true })
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      const now = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ password_changed_at: now })
        .eq('id', pendingUser.id)
      if (updateError) console.warn('[Auth] Failed to update password_changed_at:', updateError)
      set({
        user: { ...pendingUser, password_changed_at: now },
        pendingUser: null,
        passwordExpired: false,
        verified: false,
        loading: false,
      })
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  lockApp: () => {
    const { user } = get()
    set({ user: null, pendingUser: user, passwordExpired: false, verified: false, loading: false })
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
      const expired = isPasswordExpired(profile)
      if (expired) {
        set({ pendingUser: profile, passwordExpired: true, verified: true, loading: false })
      } else {
        set({ user: profile, loading: false })
      }
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
      const now = new Date().toISOString()
      const { data: profile } = await supabase
        .from('profiles')
        .insert([{ id: data.user?.id, email, display_name: displayName, password_changed_at: now }])
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
    set({ user: null, pendingUser: null, passwordExpired: false, verified: false, loading: false })
  },
}))
