import { useState, useEffect, useCallback } from 'react'

type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string; url: string }
  | { status: 'not-available' }
  | { status: 'error'; message: string }

export default function UpdateNotifier() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })

  useEffect(() => {
    if (!window.electron?.onUpdateStatus) return
    const cleanup = window.electron.onUpdateStatus((status, data) => {
      switch (status) {
        case 'checking':
          setState({ status: 'checking' })
          break
        case 'available':
          setState({ status: 'available', version: data?.version || '', url: data?.url || '' })
          break
        case 'not-available':
          setState({ status: 'not-available' })
          setTimeout(() => setState({ status: 'idle' }), 5000)
          break
        case 'error':
          setState({ status: 'error', message: data || 'Update check failed' })
          setTimeout(() => setState({ status: 'idle' }), 8000)
          break
      }
    })
    return cleanup
  }, [])

  const handleDownload = useCallback(() => {
    if (state.status === 'available' && state.url) {
      window.electron.openUpdateUrl(state.url)
    }
    setState({ status: 'idle' })
  }, [state])

  const handleDismiss = useCallback(() => {
    setState({ status: 'idle' })
  }, [])

  if (state.status === 'idle' || state.status === 'not-available') {
    return null
  }

  if (state.status === 'error') {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <div className="bg-gray-800 border border-red-700 rounded-lg shadow-2xl p-4 text-white">
          <div className="flex items-center gap-3">
            <span className="text-red-400 text-lg">⚠</span>
            <span className="text-sm">{state.message}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-4 text-white">
        {state.status === 'checking' && (
          <div className="flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span>Checking for updates...</span>
          </div>
        )}

        {state.status === 'available' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-blue-400 text-lg">↓</span>
              <span className="font-medium">v{state.version} available</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
              >
                Download
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
