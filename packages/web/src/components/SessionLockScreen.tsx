import { useState } from 'react'
import { motion } from 'motion/react'
import { useAuthStore } from '@/hooks/useAuth'

export default function SessionLockScreen() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { pendingUser, unlockWithPassword, logout, passwordExpired } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await unlockWithPassword(password)
    } catch (err: any) {
      setError(err.message || 'Incorrect password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-body">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 120, -60, 0], y: [0, -100, 80, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-60 -left-60 w-[800px] h-[800px] rounded-full blur-[150px] opacity-[0.08] dark:opacity-[0.12]"
          style={{ background: 'linear-gradient(135deg, rgb(var(--accent-from-rgb)), rgb(var(--accent-to-rgb)))' }}
        />
      </div>
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
          <div className="text-center mb-7">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center justify-center"
            >
              <div className="mb-4 mx-auto">
                {pendingUser?.photo_url ? (
                  <img
                    src={pendingUser.photo_url}
                    alt={pendingUser.display_name || ''}
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-accent/30"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center ring-2 ring-accent/30">
                    <span className="text-2xl font-bold text-accent">
                      {(pendingUser?.display_name || '?')[0].toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
            <h1 className="text-2xl font-bold text-primary tracking-tight">
              Welcome back{pendingUser?.display_name ? `, ${pendingUser.display_name}` : ''}
            </h1>
            <p className="text-sm text-muted mt-1.5">
              {passwordExpired
                ? 'Your password has expired. Please set a new one.'
                : 'Enter your password to unlock'}
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-3 rounded-2xl mb-5 flex items-center gap-2.5"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field !py-2.5"
                placeholder="••••••••"
                required
                autoFocus
              />
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
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
                  Unlocking...
                </span>
              ) : 'Unlock'}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={logout}
              className="text-sm text-muted hover:text-accent transition-colors font-medium"
            >
              Switch account
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
