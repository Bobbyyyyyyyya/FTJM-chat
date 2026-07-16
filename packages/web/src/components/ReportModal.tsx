import { useState } from 'react'
import { motion } from 'motion/react'
import { createReport, hasAlreadyReported } from '@/lib/db-reports'
import { REPORT_REASONS } from '@/lib/types'
import { toast } from 'sonner'

interface ReportModalProps {
  reporterId: string
  targetName: string
  reportedUserId?: string
  reportedPostId?: string
  onClose: () => void
}

export default function ReportModal({
  reporterId,
  targetName,
  reportedUserId,
  reportedPostId,
  onClose,
}: ReportModalProps) {
  const [reason, setReason] = useState<string>('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [alreadyReported, setAlreadyReported] = useState(false)

  const checkExisting = async () => {
    const exists = await hasAlreadyReported(reporterId, {
      reportedUserId,
      reportedPostId,
    })
    if (exists) {
      setAlreadyReported(true)
    }
  }

  // Check on mount
  useState(() => {
    checkExisting()
  })

  const handleSubmit = async () => {
    if (!reason || submitting) return
    setSubmitting(true)
    try {
      await createReport(reporterId, reason, {
        reportedUserId,
        reportedPostId,
        description: description.trim() || undefined,
      })
      toast.success('Report ingediend')
      onClose()
    } catch {
      toast.error('Er is iets misgegaan bij het rapporteren')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/20 dark:bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-surface rounded-3xl shadow-xl shadow-black/10 dark:shadow-black/50 border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">Report</p>
                <p className="text-xs text-muted truncate max-w-[200px]">{targetName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-muted text-muted hover:text-primary transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {alreadyReported ? (
          <div className="px-6 pb-6">
            <p className="text-sm text-muted text-center py-4">
              Je hebt dit item al gerapporteerd.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-surface-muted text-secondary hover:bg-surface-hover text-xs font-medium transition-all"
            >
              Sluiten
            </button>
          </div>
        ) : (
          <div className="px-6 pb-6 space-y-4">
            {/* Reason */}
            <div>
              <label className="text-xs font-medium text-secondary mb-1.5 block">Reden</label>
              <div className="grid grid-cols-1 gap-1.5">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition-all border ${
                      reason === r
                        ? 'bg-accent/10 border-accent/30 text-accent'
                        : 'bg-surface-muted border-border text-secondary hover:text-primary hover:border-border'
                    }`}
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-secondary mb-1.5 block">
                Extra details <span className="text-muted">(optioneel)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Vertel meer over het probleem..."
                rows={3}
                className="w-full text-xs bg-surface-muted rounded-xl px-3 py-2.5 border border-border focus:outline-none focus:border-accent transition-colors placeholder:text-muted resize-none text-primary"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-surface-muted text-secondary hover:bg-surface-hover text-xs font-medium transition-all"
              >
                Annuleren
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Versturen...' : 'Reporten'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
