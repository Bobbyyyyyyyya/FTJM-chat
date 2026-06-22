import { useEffect, useState } from 'react'
import { subscribeToPresence, type OnlineUsers } from '@/lib/presence'

export function usePresence(userId: string | undefined) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUsers>(new Set())

  useEffect(() => {
    if (!userId) return
    const unsubscribe = subscribeToPresence(userId, setOnlineUsers)
    return unsubscribe
  }, [userId])

  return onlineUsers
}
