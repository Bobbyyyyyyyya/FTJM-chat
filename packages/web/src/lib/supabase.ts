import { createClient } from '@supabase/supabase-js'
import { egressLimiter } from './rateLimiter'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is required. Check your .env.local file')
}

if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY is required. Check your .env.local file')
}

function getAccessToken(): string {
  try {
    const storageKey = `sb-${supabaseUrl.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '')}-auth-token`
    const raw = localStorage.getItem(storageKey)
    if (!raw) return ''
    const session = JSON.parse(raw)
    return session?.access_token ?? ''
  } catch {
    return ''
  }
}

const originalFetch = window.fetch.bind(window)
window.fetch = async (...args) => {
  if (!egressLimiter.tryAcquire('egress-global')) {
    console.warn('⚠️ Egress rate limit reached, allowing request anyway')
  }
  return originalFetch(...args)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    accessToken: async () => getAccessToken(),
  },
})
