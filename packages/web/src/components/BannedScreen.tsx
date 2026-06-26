import { motion } from 'motion/react'
import { useAuthStore } from '@/hooks/useAuth'

export default function BannedScreen() {
  const { bannedInfo, logout } = useAuthStore()

  if (!bannedInfo) return null

  const untilStr = bannedInfo.bannedUntil
    ? new Date(bannedInfo.bannedUntil).toLocaleDateString('nl-NL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-body">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 120, -60, 0], y: [0, -100, 80, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-60 -left-60 w-[800px] h-[800px] rounded-full blur-[150px] opacity-[0.08] dark:opacity-[0.12]"
          style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="bg-surface rounded-3xl shadow-2xl shadow-black/[0.04] dark:shadow-black/40 border border-border/50 p-8">
          <div className="text-center mb-7">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="inline-flex items-center justify-center"
            >
              <div className="mb-4 mx-auto w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center ring-2 ring-red-500/30">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </motion.div>
            <h1 className="text-xl font-bold text-primary tracking-tight">
              {untilStr ? 'Tijdelijk verbannen' : 'Verbannen'}
            </h1>
            {untilStr && (
              <p className="text-sm text-muted mt-1.5">
                Je toegang is beperkt tot <span className="text-red-400 font-medium">{untilStr}</span>
              </p>
            )}
          </div>

          {bannedInfo.banReason && (
            <div className="bg-surface-muted rounded-2xl px-4 py-3 mb-5">
              <p className="text-xs text-muted font-medium mb-1">Reden:</p>
              <p className="text-sm text-secondary">{bannedInfo.banReason}</p>
            </div>
          )}

          {bannedInfo.warnings.length > 0 && (
            <div className="space-y-2 mb-5">
              <p className="text-xs text-muted font-medium">
                Waarschuwing{bannedInfo.warnings.length > 1 ? 'en' : ''} ({bannedInfo.warnings.length}):
              </p>
              {bannedInfo.warnings.map((w, i) => (
                <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3">
                  <p className="text-sm text-amber-400">{w.message}</p>
                  {w.timestamp && (
                    <p className="text-xs text-muted mt-1">
                      {new Date(w.timestamp).toLocaleDateString('nl-NL', {
                        year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={logout}
            className="w-full bg-surface-muted hover:bg-surface-hover text-secondary font-medium py-2.5 rounded-2xl transition-all text-sm"
          >
            Uitloggen
          </button>
        </div>
      </motion.div>
    </div>
  )
}