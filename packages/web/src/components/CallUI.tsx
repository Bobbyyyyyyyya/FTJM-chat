import { useRef, useEffect } from 'react'

interface CallUIProps {
  callState: 'calling' | 'ringing' | 'connected' | 'ended'
  remoteStream: MediaStream | null
  localStream: MediaStream | null
  remoteName: string
  video: boolean
  onEnd: () => void
  onAnswer: () => void
  onDecline: () => void
  onToggleMute: () => void
  muted: boolean
}

export default function CallUI({
  callState,
  remoteStream,
  localStream,
  remoteName,
  video,
  onEnd,
  onAnswer,
  onDecline,
  onToggleMute,
  muted,
}: CallUIProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  if (callState === 'ended') return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      {/* Remote video */}
      {video && remoteStream ? (
        <video ref={remoteVideoRef} autoPlay playsInline className="flex-1 w-full object-cover" />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className={`h-24 w-24 rounded-full bg-accent flex items-center justify-center text-4xl font-bold text-white ${callState === 'ringing' ? 'animate-pulse shadow-[0_0_0_8px_rgba(255,255,255,0.15)]' : ''}`}>
            {remoteName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Local PiP */}
      {video && localStream && (
        <div className="absolute top-4 right-4 w-36 h-48 rounded-2xl overflow-hidden border-2 border-white/30 shadow-lg">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </div>
      )}

      {/* Status */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center">
        <p className="text-white font-semibold text-lg">{remoteName}</p>
        <p className="text-white/60 text-sm">
          {callState === 'calling' && 'Calling...'}
          {callState === 'ringing' && 'Incoming call...'}
          {callState === 'connected' && (video ? 'Connected' : 'Voice call')}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 py-8 bg-gradient-to-t from-black/60 to-transparent">
        {callState === 'ringing' ? (
          <>
            <button onClick={onAnswer}
              className="h-14 w-14 rounded-full bg-accent hover:bg-accent-hover flex items-center justify-center transition-all active:scale-90">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
            <button onClick={onDecline}
              className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all active:scale-90">
              <svg className="w-6 h-6 text-white rotate-135" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <button onClick={onToggleMute}
              className={`h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                muted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'
              }`}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {muted ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                )}
              </svg>
            </button>
            <button onClick={onEnd}
              className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all active:scale-90">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
