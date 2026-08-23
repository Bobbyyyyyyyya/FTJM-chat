import { createClient } from '@supabase/supabase-js'

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

const REQUEST_TIMEOUT_MS = 10000

function timedFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const signal = init?.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal

  return fetch(url, { ...init, signal }).finally(() => clearTimeout(timer))
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: {
    fetch: timedFetch,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    accessToken: async () => getAccessToken(),
  },
})
