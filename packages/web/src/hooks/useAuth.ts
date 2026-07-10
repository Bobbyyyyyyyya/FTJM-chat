import { create } from 'zustand'
import { User } from '@ftjm/shared'
import { supabase } from '@/lib/supabase'

export interface BanInfo {
  isBlocked: boolean
  bannedUntil: string | null
  banReason: string | null
  warnings: { message: string; timestamp: string }[]
}

function parseAdminNotes(profile: Record<string, unknown> | null): BanInfo | null {
  if (!profile) return null
  const notes = profile.admin_notes
  if (typeof notes === 'string' && notes.trim()) {
    try {
      const parsed = JSON.parse(notes)
      const rawWarnings = Array.isArray(parsed.warnings) ? parsed.warnings : []
      const warnings = rawWarnings.map((w: unknown) => {
        if (typeof w === 'string') return { message: w, timestamp: '' }
        if (w && typeof w === 'object') {
          const obj = w as Record<string, unknown>
          return { message: String(obj.message || obj.reason || w), timestamp: String(obj.timestamp || '') }
        }
        return { message: String(w), timestamp: '' }
      })
      if (profile.is_blocked) {
        return {
          isBlocked: true,
          bannedUntil: parsed.banned_until || null,
          banReason: parsed.ban_reason || null,
          warnings,
        }
      }
      if (parsed.banned_until) {
        const until = new Date(parsed.banned_until)
        if (until > new Date()) {
          return {
            isBlocked: true,
            bannedUntil: parsed.banned_until,
            banReason: parsed.ban_reason || null,
            warnings,
          }
        }
      }
    } catch {}
  }
  return null
}

interface AuthState {
  user: User | null
  pendingUser: User | null
  loading: boolean
  bannedInfo: BanInfo | null
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  unlockWithPassword: (password: string) => Promise<void>
  lockApp: () => void
  dismissBan: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  pendingUser: null,
  loading: true,
  bannedInfo: null,

  checkAuth: async () => {
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.warn('[Auth] getSession error, clearing stale session:', error.message)
        await supabase.auth.signOut()
        set({ user: null, loading: false })
        return
      }
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
        const banned = parseAdminNotes(profile)
        if (banned) {
          await supabase.auth.signOut()
          set({ user: null, pendingUser: null, loading: false, bannedInfo: banned })
          return
        }
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', pendingUser.id)
        .single()
      const banned = parseAdminNotes(profile)
      if (banned) {
        await supabase.auth.signOut()
        set({ user: null, pendingUser: null, loading: false, bannedInfo: banned })
        return
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
      const banned = parseAdminNotes(profile)
      if (banned) {
        await supabase.auth.signOut()
        set({ user: null, pendingUser: null, loading: false, bannedInfo: banned })
        return
      }
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
    set({ user: null, pendingUser: null, loading: false, bannedInfo: null })
  },

  dismissBan: () => {
    set({ bannedInfo: null })
  },
}))
