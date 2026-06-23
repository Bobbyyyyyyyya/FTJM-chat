import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { useAuthStore } from './hooks/useAuth'
import { usePresence } from './hooks/usePresence'
import LoginPage from './pages/Login'
import ChatPage from './pages/Chat'
import UpdateNotifier from './components/UpdateNotifier'
import './App.css'

function App() {
  const { user, loading, checkAuth } = useAuthStore()
  const [isInitialized, setIsInitialized] = useState(false)
  const onlineUsers = usePresence(user?.id)

  useEffect(() => {
    // Check if user is already logged in
    checkAuth().then(() => setIsInitialized(true))
  }, [checkAuth])

  if (!isInitialized || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-body">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#0f172a] flex items-center justify-center shadow-lg animate-pulse-slow overflow-hidden">
            <svg viewBox="0 0 512 512" className="h-8 w-8">
              <defs>
                <linearGradient id="loadAccent" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#2dd4bf"/>
                  <stop offset="100%" stop-color="#38bdf8"/>
                </linearGradient>
                <linearGradient id="loadFg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#ffffff"/>
                  <stop offset="100%" stop-color="#e2e8f0"/>
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="512" height="512" rx="88" fill="#0f172a"/>
              <ellipse cx="256" cy="240" rx="140" ry="120" fill="url(#loadAccent)" opacity="0.12"/>
              <rect x="172" y="380" width="168" height="6" rx="3" fill="url(#loadAccent)"/>
              <g transform="translate(-4,-18)">
                <path d="M186 148h156v48h-102v64h88v46h-88v106h-54V148z" fill="url(#loadFg)"/>
                <path d="M186 148h156v48h-102v64h88v46h-88v106h-54V148z" fill="url(#loadAccent)" opacity="0.35" transform="translate(3,3)"/>
              </g>
            </svg>
          </div>
          <div className="text-primary text-sm font-medium">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <>
      {user ? <ChatPage onlineUsers={onlineUsers} /> : <LoginPage />}
      <UpdateNotifier />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' },
        }}
      />
    </>
  )
}

export default App
