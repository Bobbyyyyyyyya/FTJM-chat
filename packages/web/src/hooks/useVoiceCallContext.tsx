import { createContext, useContext, type ReactNode } from 'react'
import type { CallState, CallData } from './useVoiceCall'

export interface VoiceCallContextValue {
  callState: CallState
  activeCall: CallData | null
  duration: number
  isMuted: boolean
  isVideoMuted: boolean
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  layout: 'large' | 'compact'
  startCall: (receiverId: string, receiverName: string, receiverAvatar: string, video: boolean) => void
  acceptCall: () => void
  endCall: () => void
  declineCall: () => void
  toggleMute: () => void
  toggleVideo: () => void
  setLayout: (layout: 'large' | 'compact') => void
  isScreenSharing: boolean
  isRemoteScreenSharing: boolean
  startScreenShare: () => void
  stopScreenShare: () => void
}

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null)

export function useVoiceCallContext() {
  const ctx = useContext(VoiceCallContext)
  if (!ctx) throw new Error('useVoiceCallContext must be used within VoiceCallProvider')
  return ctx
}

export function VoiceCallProvider({ value, children }: { value: VoiceCallContextValue; children: ReactNode }) {
  return (
    <VoiceCallContext.Provider value={value}>
      {children}
    </VoiceCallContext.Provider>
  )
}
