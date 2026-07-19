import { create } from 'zustand'
import { User } from '@ftjm/shared'
import { supabase } from '@/lib/supabase'
import { authLimiter, enforceRateLimit } from '@/lib/rateLimiter'

export interface BanInfo {
  isBlocked: boolean
  bannedUntil: string | null
  banReason: string | null
  warnings: { message: string; timestamp: string }[]
}

const HW_BAN_LS = '__sys_hw_banned'
const HW_BAN_SS = '__sys_hw_banned'
const HW_BAN_COOKIE = '__sys_hw_banned'
const HW_BAN_TRACE_COOKIE = '__hw_ban_trace'
const HW_UUID_TOKEN_LS = 'hardware uuid-token'
const BAN_EXPIRY_DAYS = 3650

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Strict`
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function isHardwareBanned(): boolean {
  if (localStorage.getItem(HW_BAN_LS) === 'blocked') return true
  if (sessionStorage.getItem(HW_BAN_SS) === 'blocked') return true
  if (getCookie(HW_BAN_COOKIE) === 'blocked') return true
  if (getCookie(HW_BAN_TRACE_COOKIE) === 'blocked') return true
  if (localStorage.getItem(HW_UUID_TOKEN_LS) === 'blocked') return true
  return false
}

function persistHardwareBan() {
  localStorage.setItem(HW_BAN_LS, 'blocked')
  localStorage.setItem(HW_UUID_TOKEN_LS, 'blocked')
  sessionStorage.setItem(HW_BAN_SS, 'blocked')
  setCookie(HW_BAN_COOKIE, 'blocked', BAN_EXPIRY_DAYS)
  setCookie(HW_BAN_TRACE_COOKIE, 'blocked', BAN_EXPIRY_DAYS)
}

const MAC_BAN_REASON = 'Dit apparaat is geblokkeerd via MAC-adres filter.'

function getMacBanInfo(): BanInfo {
  return {
    isBlocked: true,
    bannedUntil: null,
    banReason: MAC_BAN_REASON,
    warnings: [],
  }
}

async function checkMacBan(): Promise<BanInfo | null> {
  if (!window.electron?.checkMacBanned) return null
  try {
    const result = await window.electron.checkMacBanned()
    if (result.banned) {
      persistHardwareBan()
      return getMacBanInfo()
    }
  } catch {}
  return null
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
      if (isHardwareBanned()) {
        set({ user: null, loading: false, bannedInfo: getMacBanInfo() })
        return
      }
      const macBan = await checkMacBan()
      if (macBan) {
        set({ user: null, loading: false, bannedInfo: macBan })
        return
      }
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
      enforceRateLimit(authLimiter, 'unlock', 'App ontgrendelen')
      if (isHardwareBanned()) {
        set({ user: null, pendingUser: null, loading: false, bannedInfo: getMacBanInfo() })
        return
      }
      const macBan = await checkMacBan()
      if (macBan) {
        set({ user: null, pendingUser: null, loading: false, bannedInfo: macBan })
        return
      }
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
      enforceRateLimit(authLimiter, 'login', 'Inloggen')
      if (isHardwareBanned()) {
        set({ bannedInfo: getMacBanInfo() })
        return
      }
      const macBan = await checkMacBan()
      if (macBan) {
        set({ bannedInfo: macBan })
        return
      }
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
      enforceRateLimit(authLimiter, 'signup', 'Registreren')
      if (isHardwareBanned()) {
        set({ bannedInfo: getMacBanInfo() })
        return
      }
      const macBan = await checkMacBan()
      if (macBan) {
        set({ bannedInfo: macBan })
        return
      }
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
