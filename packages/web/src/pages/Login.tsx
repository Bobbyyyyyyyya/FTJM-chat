import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'motion/react'
import type { User } from '@ftjm/shared'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSignup, setIsSignup] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [profilePreview, setProfilePreview] = useState<User | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const { login, signup } = useAuthStore()

  useEffect(() => {
    if (!email.trim() || isSignup) {
      setProfilePreview(null)
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLookingUp(true)
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email.trim())
          .maybeSingle()
        setProfilePreview(data || null)
      } catch {
        setProfilePreview(null)
      } finally {
        setLookingUp(false)
      }
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [email, isSignup])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      if (isSignup) {
        await signup(email, password, displayName)
      } else {
        await login(email, password)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-body">
      {/* Gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 120, -60, 0], y: [0, -100, 80, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-60 -left-60 w-[800px] h-[800px] rounded-full blur-[150px] opacity-[0.08] dark:opacity-[0.12]"
          style={{ background: 'linear-gradient(135deg, rgb(var(--accent-from-rgb)), rgb(var(--accent-to-rgb)))' }}
        />
        <motion.div
          animate={{ x: [0, -80, 120, 0], y: [0, 80, -120, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-60 -right-60 w-[700px] h-[700px] rounded-full blur-[150px] opacity-[0.06] dark:opacity-[0.1]"
          style={{ background: 'linear-gradient(135deg, rgb(var(--accent-to-rgb)), rgb(var(--accent-from-rgb)))' }}
        />
      </div>

      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(var(--text)) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm"
      >
        <div className="bg-surface rounded-3xl shadow-2xl shadow-black/[0.04] dark:shadow-black/40 border border-border/50 p-8">
          {/* Brand */}
          <div className="text-center mb-7">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center justify-center"
            >
              <div className="h-14 w-14 rounded-2xl bg-[#0f172a] flex items-center justify-center shadow-lg mb-4 mx-auto overflow-hidden"
                style={{ boxShadow: '0 8px 32px rgb(var(--accent-rgb) / 0.25)' }}>
                <svg viewBox="0 0 512 512" className="h-10 w-10">
                  <defs>
                    <linearGradient id="loginAccent" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color="#2dd4bf"/>
                      <stop offset="100%" stop-color="#38bdf8"/>
                    </linearGradient>
                    <linearGradient id="loginFg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#ffffff"/>
                      <stop offset="100%" stop-color="#e2e8f0"/>
                    </linearGradient>
                  </defs>
                  <rect x="0" y="0" width="512" height="512" rx="88" fill="#0f172a"/>
                  <ellipse cx="256" cy="240" rx="140" ry="120" fill="url(#loginAccent)" opacity="0.12"/>
                  <rect x="172" y="380" width="168" height="6" rx="3" fill="url(#loginAccent)"/>
                  <g transform="translate(-4,-18)">
                    <path d="M186 148h156v48h-102v64h88v46h-88v106h-54V148z" fill="url(#loginFg)"/>
                    <path d="M186 148h156v48h-102v64h88v46h-88v106h-54V148z" fill="url(#loginAccent)" opacity="0.35" transform="translate(3,3)"/>
                  </g>
                </svg>
              </div>
            </motion.div>
            <h1 className="text-2xl font-bold text-primary tracking-tight">FTJM Chat</h1>
            <p className="text-sm text-muted mt-1.5">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-3 rounded-2xl mb-5 flex items-center gap-2.5"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {isSignup && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="block text-sm font-medium text-secondary mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input-field !py-2.5"
                    placeholder="Your name"
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field !py-2.5"
                placeholder="you@example.com"
                required
              />
            </div>

            {/* Profile preview */}
            {!isSignup && email.trim() && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface-muted"
              >
                {lookingUp ? (
                  <div className="h-10 w-10 rounded-full bg-surface-muted animate-pulse shrink-0" />
                ) : profilePreview ? (
                  <>
                    {profilePreview.photo_url ? (
                      <img src={profilePreview.photo_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-accent">
                          {(profilePreview.display_name || '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">
                        {profilePreview.display_name || profilePreview.email}
                      </p>
                      <p className="text-xs text-muted">{profilePreview.email}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted">No account found with this email</p>
                )}
              </motion.div>
            )}

            {(!isSignup && profilePreview) && (
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field !py-2.5"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            {isSignup && (
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field !py-2.5"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            <AnimatePresence mode="wait">
              {isSignup && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-2.5"
                >
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 rounded border-border text-accent focus:ring-accent/30 shrink-0"
                  />
                  <label htmlFor="terms" className="text-xs text-secondary leading-relaxed">
                    I agree to the{' '}
                    <a
                      href="https://ais-pre-3d4qy6xrtw5vtu4g3hs7yo-160997107127.europe-west3.run.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      Terms of Service
                    </a>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={isLoading || (isSignup && !agreedToTerms) || (!isSignup && !profilePreview)}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-accent text-white font-semibold py-2.5 rounded-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              style={{ boxShadow: '0 8px 32px rgb(var(--accent-rgb) / 0.25)' }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </span>
              ) : isSignup ? 'Sign Up' : 'Login'}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => { setIsSignup(!isSignup); setError(''); setProfilePreview(null); setPassword('') }}
              className="text-sm text-muted hover:text-accent transition-colors font-medium"
            >
              {isSignup
                ? 'Already have an account? Login'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
