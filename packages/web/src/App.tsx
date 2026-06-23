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
          <div className="h-10 w-10 rounded-2xl bg-gradient-accent flex items-center justify-center shadow-lg animate-pulse-slow">
            <span className="text-lg font-bold text-white">F</span>
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
