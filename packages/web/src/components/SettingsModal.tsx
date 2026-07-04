import { useAuthStore } from '@/hooks/useAuth'
import SettingsContent, { applyCustomTheme, clearCustomTheme } from './SettingsContent'

export { applyCustomTheme, clearCustomTheme }

export default function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuthStore()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/20 dark:bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-surface rounded-3xl shadow-2xl shadow-black/10 dark:shadow-black/50 border border-border overflow-hidden max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-lg font-bold text-primary">Settings</h2>
          <button onClick={onClose} className="rounded-xl bg-surface-muted p-2 text-muted hover:bg-surface-hover hover:text-secondary transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <SettingsContent userId={user?.id || ''} onClose={onClose} />
      </div>
    </div>
  )
}
