import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type OnlineUsers = Set<string>

let channel: RealtimeChannel | null = null
let syncHandler: ((onlineUsers: OnlineUsers) => void) | null = null

export function subscribeToPresence(
  userId: string,
  onSync: (onlineUsers: OnlineUsers) => void,
) {
  syncHandler = onSync

  channel = supabase.channel('online-users', {
    config: {
      presence: {
        key: userId,
      },
    },
  })

  channel
    .on('presence', { event: 'sync' }, () => {
      if (!channel) return
      const state = channel.presenceState()
      const onlineIds = new Set(Object.keys(state)) as OnlineUsers
      syncHandler?.(onlineIds)
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && channel) {
        await channel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        })
      }
    })

  return () => {
    channel?.unsubscribe()
    channel = null
    syncHandler = null
  }
}
