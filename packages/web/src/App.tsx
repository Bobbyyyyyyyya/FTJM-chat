import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { useAuthStore } from './hooks/useAuth'
import { useVoiceCall } from './hooks/useVoiceCall'
import { VoiceCallProvider } from './hooks/useVoiceCallContext'
import { usePresence } from './hooks/usePresence'
import LoginPage from './pages/Login'
import ChatPage from './pages/Chat'
import SessionLockScreen from './components/SessionLockScreen'
import BannedScreen from './components/BannedScreen'
import VoiceCallUI from './components/VoiceCallUI'
import UpdateNotifier from './components/UpdateNotifier'
import './App.css'

function App() {
  const { user, pendingUser, loading, bannedInfo, checkAuth } = useAuthStore()
  const [isInitialized, setIsInitialized] = useState(false)
  const activeIdentity = pendingUser || user
  const onlineUsers = usePresence(user?.id)

  const ringtoneUrl = (activeIdentity?.notification_settings as Record<string, unknown> | undefined)?.ringtone_url as string | undefined
  const voiceCall = useVoiceCall(
    activeIdentity?.id,
    activeIdentity?.display_name || 'Gebruiker',
    activeIdentity?.photo_url || undefined,
    ringtoneUrl,
  )
  const {
    callState,
    activeCall,
    duration,
    isMuted,
    isVideoMuted,
    localStream,
    remoteStream,
    layout,
    startCall,
    acceptCall,
    endCall,
    declineCall,
    toggleMute,
    toggleVideo,
    setLayout,
    isScreenSharing,
    isRemoteScreenSharing,
    startScreenShare,
    stopScreenShare,
  } = voiceCall

  // Notification for incoming calls (ringtone is managed inside useVoiceCall)
  useEffect(() => {
    if (callState === 'ringing') {
      if (activeCall) {
        const title = `Incoming call from ${activeCall.callerName}`
        const body = activeCall.isVideo ? 'Video call' : 'Voice call'
        if ((window as any).electron?.notify) {
          (window as any).electron.notify(title, body, 'critical')
        } else if (Notification.permission === 'granted') {
          new Notification(title, { body })
        }
      }
    }
    return undefined
  }, [callState, activeCall])

  // Handle notification click → focus window
  useEffect(() => {
    const cleanup = (window as any).electron?.onNotificationClicked?.((data: any) => {
      if ((window as any).electron?.showWindow) {
        (window as any).electron.showWindow()
      }
    })
    return () => cleanup?.()
  }, [])

  useEffect(() => {
    checkAuth().then(() => setIsInitialized(true))
  }, [checkAuth])

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  if (!isInitialized || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-body">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 80 80" className="w-full h-full animate-scale-in">
              <defs>
                <linearGradient id="f-bg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--surface))" />
                  <stop offset="100%" stopColor="rgb(var(--surface-muted))" />
                </linearGradient>
                <linearGradient id="f-accent" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--accent-from-rgb))" />
                  <stop offset="100%" stopColor="rgb(var(--accent-to-rgb))" />
                </linearGradient>
                <linearGradient id="f-shine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <clipPath id="f-clip">
                  <rect x="0" y="0" width="80" height="80" rx="20" />
                </clipPath>
              </defs>
              <rect x="0" y="0" width="80" height="80" rx="20" fill="url(#f-bg)" className="stroke-border" strokeWidth="1" />
              <g clipPath="url(#f-clip)">
                <rect className="f-shine-sweep" x="-40" y="0" width="40" height="80" fill="url(#f-shine)" />
              </g>
              <text
                x="40" y="54" textAnchor="middle"
                fontSize="42" fontWeight="700" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                fill="url(#f-accent)"
                className="f-letter"
              >
                F
              </text>
            </svg>
            <div className="absolute inset-0 rounded-2xl bg-accent/10 blur-xl animate-pulse-slow" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              <span className="f-dot w-1.5 h-1.5 rounded-full bg-accent" style={{ animationDelay: '0ms' }} />
              <span className="f-dot w-1.5 h-1.5 rounded-full bg-accent" style={{ animationDelay: '150ms' }} />
              <span className="f-dot w-1.5 h-1.5 rounded-full bg-accent" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const callContextValue = {
    callState,
    activeCall,
    duration,
    isMuted,
    isVideoMuted,
    localStream,
    remoteStream,
    layout,
    startCall,
    acceptCall,
    endCall,
    declineCall,
    toggleMute,
    toggleVideo,
    setLayout,
    isScreenSharing,
    isRemoteScreenSharing,
    startScreenShare,
    stopScreenShare,
  }

  if (bannedInfo) {
    return <BannedScreen />
  }

  return (
    <VoiceCallProvider value={callContextValue}>
      {pendingUser ? (
        <SessionLockScreen />
      ) : user ? (
        <ChatPage onlineUsers={onlineUsers} />
      ) : (
        <LoginPage />
      )}
      <VoiceCallUI
        callState={callState}
        activeCall={activeCall}
        duration={duration}
        isMuted={isMuted}
        isVideoMuted={isVideoMuted}
        localStream={localStream}
        remoteStream={remoteStream}
        layout={layout}
        onAccept={acceptCall}
        onEnd={endCall}
        onDecline={declineCall}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onSetLayout={setLayout}
        isScreenSharing={isScreenSharing}
        isRemoteScreenSharing={isRemoteScreenSharing}
        onToggleScreenShare={isScreenSharing ? stopScreenShare : startScreenShare}
      />
      <UpdateNotifier />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' },
        }}
      />
    </VoiceCallProvider>
  )
}

export default App
