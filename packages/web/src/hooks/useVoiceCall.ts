import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getLocalStream,
  createPeerConnection,
  cleanupMediaStream,
  flushIceCandidates,
} from '@/lib/webrtc'
import type { RealtimeChannel } from '@supabase/supabase-js'

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
  const pendingOfferRef = useRef<string | null>(null)
  const outboundChannelRef = useRef<RealtimeChannel | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const callStateRef = useRef<CallState>('idle')

  activeCallRef.current = activeCall
  callStateRef.current = callState

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

  async function sendViaChannel(targetUserId: string, event: string, payload: Record<string, unknown>) {
    const ch = supabase.channel(`calls:${targetUserId}`, {
      config: { broadcast: { self: false, ack: true } },
    })
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.send({ type: 'broadcast', event, payload })
      }
    })
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
    outboundChannelRef.current = outboundChannel

    outboundChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await outboundChannel.send({
          type: 'broadcast',
          event: 'incoming_call',
          payload: callPayload,
        })

        setupPeerConnection(targetUserId, roomId, media)

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
    if (callStateRef.current !== 'ringing') return

    setCallState('calling')

    const media = await getMedia(call.isVideo)
    if (!media) {
      cleanup()
      return
    }

    const outboundChannel = supabase.channel(`calls:${call.callerId}`, {
      config: { broadcast: { self: false, ack: true } },
    })
    outboundChannelRef.current = outboundChannel

    outboundChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await outboundChannel.send({
          type: 'broadcast',
          event: 'call_accepted',
          payload: { roomId: call.roomId },
        })

        setupPeerConnection(call.callerId, call.roomId, media)

        const offerSdp = pendingOfferRef.current
        if (pcRef.current && offerSdp) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription({ type: 'offer', sdp: offerSdp }),
          )
          const leftover = flushIceCandidates(pcRef.current, pendingCandidates.current)
          pendingCandidates.current = leftover
          const answer = await pcRef.current.createAnswer()
          await pcRef.current.setLocalDescription(answer)
          await outboundChannel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { roomId: call.roomId, sdp: answer.sdp, from: userId, to: call.callerId },
          })
        }

        setCallState('connected')
        startTimer()
      }
    })
  }

  function setupPeerConnection(targetId: string, roomId: string, stream: MediaStream) {
    const pc = createPeerConnection(
      (rs) => setRemoteStream(rs),
      async (candidate) => {
        sendViaChannel(targetId, 'ice_candidate', { roomId, candidate, from: userId, to: targetId })
      },
      (state) => {
        if (state === 'disconnected' || state === 'failed') {
          if (callStateRef.current === 'connected') cleanup()
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
    sendViaChannel(target, 'call_ended', { roomId: call.roomId })
    cleanup()
  }

  function declineCall() {
    const call = activeCallRef.current
    if (!call || !userId) return
    sendViaChannel(call.callerId, 'call_ended', { roomId: call.roomId })
    setCallState('idle')
    setActiveCall(null)
  }

  function cleanup() {
    stopTimer()
    pcRef.current?.close()
    pcRef.current = null
    cleanupMediaStream(localStreamRef.current)
    localStreamRef.current = null
    outboundChannelRef.current = null
    setRemoteStream(null)
    setLocalStream(null)
    setCallState('idle')
    setActiveCall(null)
    setDuration(0)
    pendingCandidates.current = []
    pendingOfferRef.current = null
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
        if (callStateRef.current === 'ringing' && payload.sdp) {
          pendingOfferRef.current = payload.sdp
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
        if (call && payload.roomId === call.roomId) cleanup()
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
