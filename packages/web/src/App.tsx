import { useEffect, useState } from 'react'
import { useAuthStore } from './hooks/useAuth'
import LoginPage from './pages/Login'
import ChatPage from './pages/Chat'
import './App.css'

function App() {
  const { user, loading } = useAuthStore()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Check if user is already logged in
    setIsInitialized(true)
  }, [])

  if (!isInitialized || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return user ? <ChatPage /> : <LoginPage />
}

export default App
