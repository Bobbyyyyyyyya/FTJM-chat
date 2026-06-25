import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Minimize2,
  Maximize2,
  PictureInPicture2,
} from 'lucide-react'
import type { CallState, CallData } from '@/hooks/useVoiceCall'

interface VoiceCallUIProps {
  callState: CallState
  activeCall: CallData | null
  duration: number
  isMuted: boolean
  isVideoMuted: boolean
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  layout: 'large' | 'compact'
  onAccept: () => void
  onEnd: () => void
  onDecline: () => void
  onToggleMute: () => void
  onToggleVideo: () => void
  onSetLayout: (layout: 'large' | 'compact') => void
}

export default function VoiceCallUI({
  callState,
  activeCall,
  duration,
  isMuted,
  isVideoMuted,
  localStream,
  remoteStream,
  layout,
  onAccept,
  onEnd,
  onDecline,
  onToggleMute,
  onToggleVideo,
  onSetLayout,
}: VoiceCallUIProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const [pipActive, setPipActive] = useState(false)

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  // Exit PiP when call ends
  useEffect(() => {
    if (callState !== 'connected' && pipActive) {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {})
      }
      setPipActive(false)
    }
  }, [callState, pipActive])

  // Listen for PiP close
  useEffect(() => {
    const handleLeavePip = () => setPipActive(false)
    const video = remoteVideoRef.current
    if (video) {
      video.addEventListener('leavepictureinpicture', handleLeavePip)
    }
    return () => {
      if (video) {
        video.removeEventListener('leavepictureinpicture', handleLeavePip)
      }
    }
  }, [remoteStream])

  async function handleTogglePip() {
    if (pipActive) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      }
      setPipActive(false)
    } else if (remoteVideoRef.current) {
      try {
        await remoteVideoRef.current.requestPictureInPicture()
        setPipActive(true)
      } catch {
        console.warn('PiP not supported')
      }
    }
  }

  if (callState === 'idle' || !activeCall) return null

  const isIncoming = callState === 'ringing'
  const isOutgoing = callState === 'calling'
  const isConnected = callState === 'connected'
  const pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled

  return (
    <>
      {isConnected && remoteStream && (
        activeCall.isVideo && remoteStream.getVideoTracks().length > 0 ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`fixed inset-0 w-full h-full object-cover z-[199] ${pipActive ? 'hidden' : ''}`}
          />
        ) : (
          <audio ref={remoteAudioRef} autoPlay playsInline />
        )
      )}
      <AnimatePresence>
      {layout === 'large' && !pipActive ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-[#07070d] flex flex-col items-center justify-between p-8 overflow-hidden select-none"
        >
          {/* Ambient glow */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <motion.div
              animate={{ x: [0, 45, -30, 0], y: [0, -50, 30, 0], scale: [1, 1.2, 0.9, 1] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
              className={`absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[130px] opacity-[0.16] ${
                isIncoming ? 'bg-fuchsia-600' : isOutgoing ? 'bg-sky-600' : 'bg-emerald-600'
              }`}
            />
            <motion.div
              animate={{ x: [0, -40, 50, 0], y: [0, 60, -40, 0], scale: [1, 0.9, 1.1, 1] }}
              transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
              className={`absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-[130px] opacity-[0.12] ${
                isIncoming ? 'bg-purple-600' : isOutgoing ? 'bg-blue-600' : 'bg-teal-600'
              }`}
            />
          </div>

          {/* Central content */}
          <div className="relative z-20 flex flex-col items-center justify-center flex-1 w-full max-w-md my-auto gap-8">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="w-32 h-32 md:w-40 md:h-40 rounded-full p-[3px] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 shadow-2xl"
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-neutral-900 flex items-center justify-center">
                {activeCall.callerAvatar ? (
                  <img src={activeCall.callerAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-light tracking-wide text-white">
                    {activeCall.callerName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            </motion.div>

            <div className="text-center">
              <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
                {activeCall.callerName}
              </h1>
              {isConnected ? (
                <div className="text-4xl font-light font-mono text-white tracking-widest mt-2">
                  {Math.floor(duration / 60).toString().padStart(2, '0')}
                  :{(duration % 60).toString().padStart(2, '0')}
                </div>
              ) : (
                <p className="text-xs font-light text-white/40 tracking-widest uppercase mt-1">
                  {isIncoming ? 'Incoming call' : 'Connecting...'}
                </p>
              )}
            </div>
          </div>

          {/* Local PiP */}
          {isConnected && activeCall.isVideo && localStream && (
            <div className="absolute top-4 right-4 z-30 w-36 h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
          )}

          {/* Action buttons */}
          <div className="relative z-20 w-full flex flex-col items-center gap-6 pb-6">
            <div className="flex items-center justify-center gap-8">
              {isConnected && (
                <>
                  <button onClick={onToggleMute}
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 ${
                      isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'
                    }`}>
                    {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
                  </button>
                  <button onClick={onToggleVideo}
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 ${
                      isVideoMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'
                    }`}>
                    {isVideoMuted ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
                  </button>
                </>
              )}
              {isIncoming ? (
                <>
                  <button onClick={onAccept}
                    className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg transition-all active:scale-90">
                    <Phone className="w-6 h-6" />
                  </button>
                  <button onClick={onDecline}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all active:scale-90">
                    <PhoneOff className="w-6 h-6" />
                  </button>
                </>
              ) : (
                <button onClick={onEnd}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all active:scale-90">
                  <PhoneOff className="w-6 h-6" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isConnected && pipSupported && (
                <button onClick={handleTogglePip}
                  className="flex items-center gap-2 text-white/30 hover:text-white/60 text-xs px-4 py-2 rounded-full border border-white/5 bg-white/[0.02] transition-all">
                  <PictureInPicture2 className="w-3.5 h-3.5" />
                  <span>PiP</span>
                </button>
              )}
              <button onClick={() => onSetLayout('compact')}
                className="flex items-center gap-2 text-white/30 hover:text-white/60 text-xs px-4 py-2 rounded-full border border-white/5 bg-white/[0.02] transition-all">
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Minimize</span>
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
      {layout === 'compact' || pipActive ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 30 }}
          className="fixed bottom-6 right-6 z-[200] w-80 bg-neutral-950/85 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-800 flex items-center justify-center shrink-0">
              {activeCall.callerAvatar ? (
                <img src={activeCall.callerAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-white">
                  {activeCall.callerName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-white truncate">
                {activeCall.callerName}
              </h3>
              <p className="text-[10px] text-neutral-500 uppercase font-mono">
                {isConnected
                  ? `${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`
                  : isIncoming ? 'Incoming call' : 'Calling...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isConnected && pipSupported && (
              <button onClick={handleTogglePip}
                className={`p-2 rounded-full transition-all ${pipActive ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-white bg-transparent'}`}>
                <PictureInPicture2 className="w-4 h-4" />
              </button>
            )}
            {isConnected && (
              <button onClick={onToggleMute}
                className={`p-2 rounded-full transition-all ${isMuted ? 'bg-red-500 text-white' : 'text-neutral-400 hover:text-white bg-transparent'}`}>
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            {!pipActive && (
              <button onClick={() => onSetLayout('large')}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg bg-transparent transition-all">
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onEnd}
              className="p-2.5 bg-red-500 text-white rounded-full flex items-center justify-center transition-all active:scale-90">
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
    </>
  )
}
