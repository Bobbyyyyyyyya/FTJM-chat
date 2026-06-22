import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getLocalStream,
  createPeerConnection,
  cleanupMediaStream,
  flushIceCandidates,
} from '@/lib/webrtc'

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected'

export interface CallData {
  roomId: string
  callerId: string
  callerName: string
  callerAvatar?: string
  receiverId: string
  isVideo: boolean
}

export function useVoiceCall(
  userId: string | undefined,
  userName: string,
  userAvatar?: string,
) {
  const [callState, setCallState] = useState<CallState>('idle')
  const [activeCall, setActiveCall] = useState<CallData | null>(null)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [layout, setLayout] = useState<'large' | 'compact'>('large')

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const activeCallRef = useRef<CallData | null>(null)
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  activeCallRef.current = activeCall

  async function getMedia(isVideo: boolean): Promise<MediaStream | null> {
    try {
      const stream = await getLocalStream(isVideo)
      localStreamRef.current = stream
      setLocalStream(stream)
      return stream
    } catch {
      console.error('Fout bij laden microfoon/camera')
      return null
    }
  }

  function startTimer() {
    clearInterval(timerRef.current!)
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1)
    }, 1000)
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  async function startCall(
    targetUserId: string,
    targetName: string,
    targetAvatar: string,
    isVideo: boolean,
  ) {
    if (!userId) return
    setCallState('calling')

    const roomId = `room_${Math.random().toString(36).substring(2, 11)}`
    const callPayload: CallData = {
      roomId,
      callerId: userId,
      callerName: userName,
      callerAvatar: userAvatar,
      receiverId: targetUserId,
      isVideo,
    }

    setActiveCall(callPayload)
    const media = await getMedia(isVideo)
    if (!media) {
      cleanup()
      return
    }

    const outboundChannel = supabase.channel(`calls:${targetUserId}`, {
      config: { broadcast: { self: false, ack: true } },
    })
    outboundChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await outboundChannel.send({
          type: 'broadcast',
          event: 'incoming_call',
          payload: callPayload,
        })
        await setupPeerConnection(targetUserId, roomId, media)

        const offer = await pcRef.current!.createOffer()
        await pcRef.current!.setLocalDescription(offer)
        await outboundChannel.send({
          type: 'broadcast',
          event: 'offer',
          payload: { roomId, sdp: offer.sdp, from: userId, to: targetUserId },
        })
      }
    })
  }

  async function acceptCall() {
    const call = activeCallRef.current
    if (!call || !userId) return
    setCallState('calling')

    const media = await getMedia(call.isVideo)
    if (!media) {
      cleanup()
      return
    }

    const outboundChannel = supabase.channel(`calls:${call.callerId}`, {
      config: { broadcast: { self: false, ack: true } },
    })
    outboundChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await outboundChannel.send({
          type: 'broadcast',
          event: 'call_accepted',
          payload: { roomId: call.roomId },
        })

        await setupPeerConnection(call.callerId, call.roomId, media)
        setCallState('connected')
        startTimer()
      }
    })
  }

  async function setupPeerConnection(targetId: string, roomId: string, stream: MediaStream) {
    const pc = createPeerConnection(
      (rs) => {
        setRemoteStream(rs)
      },
      async (candidate) => {
        const ch = supabase.channel(`calls:${targetId}`, {
          config: { broadcast: { self: false, ack: true } },
        })
        await ch.send({
          type: 'broadcast',
          event: 'ice_candidate',
          payload: { roomId, candidate, from: userId, to: targetId },
        })
      },
      (state) => {
        if (state === 'disconnected' || state === 'failed') {
          cleanup()
        }
      },
    )
    pcRef.current = pc
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
  }

  function endCall() {
    const call = activeCallRef.current
    if (!call || !userId) return
    const target = call.callerId === userId ? call.receiverId : call.callerId
    supabase.channel(`calls:${target}`, {
      config: { broadcast: { self: false, ack: true } },
    }).send({
      type: 'broadcast',
      event: 'call_ended',
      payload: { roomId: call.roomId },
    })
    cleanup()
  }

  function declineCall() {
    const call = activeCallRef.current
    if (!call || !userId) return
    supabase.channel(`calls:${call.callerId}`, {
      config: { broadcast: { self: false, ack: true } },
    }).send({
      type: 'broadcast',
      event: 'call_ended',
      payload: { roomId: call.roomId },
    })
    setCallState('idle')
    setActiveCall(null)
  }

  function cleanup() {
    stopTimer()
    pcRef.current?.close()
    pcRef.current = null
    cleanupMediaStream(localStreamRef.current)
    localStreamRef.current = null
    setRemoteStream(null)
    setLocalStream(null)
    setCallState('idle')
    setActiveCall(null)
    setDuration(0)
    pendingCandidates.current = []
  }

  function toggleMute() {
    const stream = localStreamRef.current
    if (!stream) return
    const audio = stream.getAudioTracks()[0]
    if (audio) {
      audio.enabled = !audio.enabled
      setIsMuted(!audio.enabled)
    }
  }

  function toggleVideo() {
    const stream = localStreamRef.current
    if (!stream) return
    const video = stream.getVideoTracks()[0]
    if (video) {
      video.enabled = !video.enabled
      setIsVideoMuted(!video.enabled)
    }
  }

  // Listen for incoming calls
  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`calls:${userId}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: 'incoming_call' }, ({ payload }) => {
        const data = payload as CallData
        if (data.receiverId !== userId) return
        setActiveCall(data)
        setCallState('ringing')
      })
      .on('broadcast', { event: 'call_accepted' }, async ({ payload }) => {
        const call = activeCallRef.current
        if (!call || payload.roomId !== call.roomId) return
        setCallState('connected')
        startTimer()
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        const call = activeCallRef.current
        if (!call || payload.roomId !== call.roomId) return
        if (pcRef.current && payload.sdp) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }),
          )
          const leftover = flushIceCandidates(pcRef.current, pendingCandidates.current)
          pendingCandidates.current = leftover
          const answer = await pcRef.current.createAnswer()
          await pcRef.current.setLocalDescription(answer)
          supabase.channel(`calls:${payload.from}`, {
            config: { broadcast: { self: false, ack: true } },
          }).send({
            type: 'broadcast',
            event: 'answer',
            payload: { roomId: call.roomId, sdp: answer.sdp, from: userId, to: payload.from },
          })
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        const call = activeCallRef.current
        if (!call || payload.roomId !== call.roomId) return
        if (pcRef.current && payload.sdp) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }),
          )
          const leftover = flushIceCandidates(pcRef.current, pendingCandidates.current)
          pendingCandidates.current = leftover
        }
      })
      .on('broadcast', { event: 'ice_candidate' }, async ({ payload }) => {
        const call = activeCallRef.current
        if (!call || payload.roomId !== call.roomId) return
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {})
        } else if (payload.candidate) {
          pendingCandidates.current.push(payload.candidate)
        }
      })
      .on('broadcast', { event: 'call_ended' }, ({ payload }) => {
        const call = activeCallRef.current
        if (call && payload.roomId === call.roomId) {
          cleanup()
        }
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [userId])

  return {
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
  }
}
