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
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
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
          style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' },
        }}
      />
    </>
  )
}

export default App
