import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import {
  getLocalStream,
  createPeerConnection,
  cleanupMediaStream,
  flushIceCandidates,
} from '@/lib/webrtc'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { playSyntheticSound } from '@/utils/helpers'

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
  ringtoneUrl?: string,
) {
  const [callState, setCallState] = useState<CallState>('idle')
  const [activeCall, setActiveCall] = useState<CallData | null>(null)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [layout, setLayout] = useState<'large' | 'compact'>('large')
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const activeCallRef = useRef<CallData | null>(null)
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([])
  const pendingOfferRef = useRef<string | null>(null)
  const outboundRef = useRef<RealtimeChannel | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const callStateRef = useRef<CallState>('idle')
  const screenStreamRef = useRef<MediaStream | null>(null)
  const originalCameraTrackRef = useRef<MediaStreamTrack | null>(null)
  const incomingSoundRef = useRef<{ stop: () => void } | null>(null)
  const dialingSoundRef = useRef<{ stop: () => void } | null>(null)
  const endCallSoundRef = useRef<{ stop: () => void } | null>(null)

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

  function setupPeerConnection(
    targetId: string,
    roomId: string,
    stream: MediaStream,
    channel: RealtimeChannel,
  ) {
    const pc = createPeerConnection(
      (rs) => setRemoteStream(rs),
      async (candidate) => {
        const msgId = `candidate_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        await channel.send({
          type: 'broadcast',
          event: 'ice_candidate',
          payload: {
            candidate: {
              candidate: candidate.candidate,
              sdpMLineIndex: candidate.sdpMLineIndex,
              sdpMid: candidate.sdpMid,
              usernameFragment: candidate.usernameFragment,
            },
            msgId,
            senderId: userId,
            targetId,
          },
        })
      },
      (state) => {
        console.log('[call] connection state:', state)
        if (state === 'failed') {
          if (callStateRef.current === 'connected') cleanup()
        }
      },
    )
    pcRef.current = pc
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
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

    const ch = supabase.channel(`calls:${targetUserId}`, {
      config: { broadcast: { self: false } },
    })
    outboundRef.current = ch

    ch.subscribe(async (status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('❌ Call outbound channel error (startCall)')
      }
      if (status !== 'SUBSCRIBED') return
      await ch.send({
        type: 'broadcast',
        event: 'incoming_call',
        payload: callPayload,
      })

      setupPeerConnection(targetUserId, roomId, media, ch)

      const offer = await pcRef.current!.createOffer()
      await pcRef.current!.setLocalDescription(offer)
      await ch.send({
        type: 'broadcast',
        event: 'offer',
        payload: { roomId, sdp: offer.sdp, from: userId, to: targetUserId },
      })
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

    const ch = supabase.channel(`calls:${call.callerId}`, {
      config: { broadcast: { self: false } },
    })
    outboundRef.current = ch

    ch.subscribe(async (status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('❌ Call outbound channel error (acceptCall)')
      }
      if (status !== 'SUBSCRIBED') return
      setupPeerConnection(call.callerId, call.roomId, media, ch)

      const offerSdp = pendingOfferRef.current
      if (pcRef.current && offerSdp) {
        await pcRef.current.setRemoteDescription(
          new RTCSessionDescription({ type: 'offer', sdp: offerSdp }),
        )
        const leftover = flushIceCandidates(pcRef.current, pendingCandidates.current)
        pendingCandidates.current = leftover
        const answer = await pcRef.current.createAnswer()
        await pcRef.current.setLocalDescription(answer)
        const msgId = `answer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        await ch.send({
          type: 'broadcast',
          event: 'answer',
          payload: {
            sdp: answer.sdp,
            msgId,
            senderId: userId,
            targetId: call.callerId,
            answer: { sdp: answer.sdp, type: 'answer' },
          },
        })
      }

      setCallState('connected')
      startTimer()
    })
  }

  function sendHangup(ch: RealtimeChannel, roomId: string) {
    const ts = Date.now()
    const r = Math.random().toString(36).substring(2, 7)
    ch.send({ type: 'broadcast', event: 'ended', payload: { msgId: `ended_${ts}_${r}`, senderId: userId } })
    ch.send({ type: 'broadcast', event: 'hangup', payload: { msgId: `hangup_${ts}_${r}`, senderId: userId } })
    ch.send({ type: 'broadcast', event: 'call_ended', payload: { msgId: `call_ended_${ts}_${r}`, senderId: userId } })
  }

  function endCall() {
    const call = activeCallRef.current
    if (!call || !userId) return
    if (outboundRef.current) {
      sendHangup(outboundRef.current, call.roomId)
    } else {
      const target = call.callerId === userId ? call.receiverId : call.callerId
      const ch = supabase.channel(`calls:${target}`, { config: { broadcast: { self: false } } })
      ch.subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        sendHangup(ch, call.roomId)
        ch.unsubscribe()
      })
    }
    cleanup()
  }

  function declineCall() {
    const call = activeCallRef.current
    if (!call || !userId) return
    const ch = supabase.channel(`calls:${call.callerId}`, {
      config: { broadcast: { self: false } },
    })
    ch.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      sendHangup(ch, call.roomId)
      ch.unsubscribe()
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
    outboundRef.current?.unsubscribe()
    outboundRef.current = null
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    originalCameraTrackRef.current = null
    setRemoteStream(null)
    setLocalStream(null)
    setCallState('idle')
    setActiveCall(null)
    setDuration(0)
    setIsScreenSharing(false)
    setIsRemoteScreenSharing(false)
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

  async function startScreenShare() {
    if (callState !== 'connected' || !activeCall || !userId) return
    try {
      let stream: MediaStream | null = null
      // Electron: use desktopCapturer via IPC + getUserMedia
      if ((window as any).electron?.getScreenSources) {
        const sources = await (window as any).electron.getScreenSources()
        if (sources.length === 0) throw new Error('Geen schermbronnen gevonden')
        const source = sources[0]
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
            },
          } as any,
        })
      }
      // Browser fallback
      if (!stream) {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      }
      if (!stream) throw new Error('Kon geen schermstream krijgen')
      screenStreamRef.current = stream
      setIsScreenSharing(true)
      const screenTrack = stream.getVideoTracks()[0]
      screenTrack.onended = () => stopScreenShare()
      const pc = pcRef.current
      const outbound = outboundRef.current
      if (pc) {
        const senders = pc.getSenders()
        const videoSender = senders.find((s) => s.track?.kind === 'video')
        if (videoSender) {
          const camTrack = localStreamRef.current?.getVideoTracks()[0]
          if (camTrack) originalCameraTrackRef.current = camTrack
          await videoSender.replaceTrack(screenTrack)
          const audioTrack = localStreamRef.current?.getAudioTracks()[0]
          const newStream = new MediaStream([screenTrack])
          if (audioTrack) newStream.addTrack(audioTrack)
          setLocalStream(newStream)
          localStreamRef.current = newStream
        } else {
          pc.addTrack(screenTrack, stream)
          const audioTrack = localStreamRef.current?.getAudioTracks()[0]
          const newStream = new MediaStream([screenTrack])
          if (audioTrack) newStream.addTrack(audioTrack)
          setLocalStream(newStream)
          localStreamRef.current = newStream
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          const targetId = activeCall.callerId === userId ? activeCall.receiverId : activeCall.callerId
          if (outbound) {
            await outbound.send({
              type: 'broadcast',
              event: 'offer',
              payload: { roomId: activeCall.roomId, sdp: offer.sdp, from: userId, to: targetId },
            })
          }
        }
        const targetId = activeCall.callerId === userId ? activeCall.receiverId : activeCall.callerId
        if (outbound) {
          await outbound.send({
            type: 'broadcast',
            event: 'screenshare_status',
            payload: { isScreenSharing: true, senderId: userId },
          })
        }
      }
      toast.success('Scherm delen gestart')
    } catch (err) {
      console.error('Screen share error:', err)
      setIsScreenSharing(false)
      toast.error('Scherm delen mislukt of geannuleerd')
    }
  }

  async function stopScreenShare() {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    setIsScreenSharing(false)
    const pc = pcRef.current
    const outbound = outboundRef.current
    if (pc) {
      const senders = pc.getSenders()
      const videoSender = senders.find((s) => s.track?.kind === 'video')
      const originalTrack = originalCameraTrackRef.current
      if (videoSender && originalTrack && originalTrack.readyState === 'live') {
        await videoSender.replaceTrack(originalTrack)
        const audioTrack = localStreamRef.current?.getAudioTracks()[0]
        const newStream = new MediaStream([originalTrack])
        if (audioTrack) newStream.addTrack(audioTrack)
        setLocalStream(newStream)
        localStreamRef.current = newStream
      } else {
        if (videoSender) pc.removeTrack(videoSender)
        const audioTrack = localStreamRef.current?.getAudioTracks()[0]
        if (audioTrack) {
          const audioOnly = new MediaStream([audioTrack])
          setLocalStream(audioOnly)
          localStreamRef.current = audioOnly
        }
      }
      const targetId = activeCallRef.current?.callerId === userId
        ? activeCallRef.current?.receiverId
        : activeCallRef.current?.callerId
      if (targetId && outbound) {
        await outbound.send({
          type: 'broadcast',
          event: 'screenshare_status',
          payload: { isScreenSharing: false, senderId: userId },
        })
      }
    }
    originalCameraTrackRef.current = null
    toast.info('Scherm delen beëindigd')
  }

  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`calls:${userId}`, {
      config: { broadcast: { self: false } },
    })

    function handleAnswer(sdp: string) {
      if (!pcRef.current || !sdp) return
      if (pcRef.current.signalingState !== 'have-local-offer') {
        console.log('[call] skip answer, wrong state:', pcRef.current.signalingState)
        return
      }
      pcRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }))
        .then(() => {
          const leftover = flushIceCandidates(pcRef.current!, pendingCandidates.current)
          pendingCandidates.current = leftover
        })
        .catch((err) => console.error('[call] setRemoteDescription error:', err))
      setCallState('connected')
      startTimer()
    }
    function handleCandidate(candidate: unknown) {
      if (!candidate) return
      if (pcRef.current && pcRef.current.remoteDescription) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(candidate as RTCIceCandidateInit))
          .catch((err) => console.warn('[call] addIceCandidate error:', err))
      } else {
        pendingCandidates.current.push(candidate as RTCIceCandidateInit)
      }
    }

    channel
      .on('broadcast', { event: '*' }, ({ payload, event: eventName }) => {
        console.log(`[call] broadcast event ontvangen: "${eventName}"`, payload)
      })
      .on('broadcast', { event: 'call_offer' }, ({ payload }) => {
        const data = payload as Record<string, unknown>
        console.log('[call] call_offer ontvangen:', data.callerName, 'userId:', userId)
        if (!data.callerId || data.callerId === userId) {
          console.log('[call] self/skip')
          return
        }
        if (callStateRef.current !== 'idle') {
          console.log('[call] niet idle (state:', callStateRef.current, '), skip')
          return
        }
        const roomId = (data.roomId as string) || (data.msgId as string) || ''
        if (!roomId) {
          console.warn('[call] call_offer zonder roomId/msgId, skip')
          return
        }
        const callData: CallData = {
          roomId,
          callerId: data.callerId as string,
          callerName: data.callerName as string,
          callerAvatar: data.callerAvatar as string,
          receiverId: userId,
          isVideo: (data.isVideo as boolean) || false,
        }
        if ((data.offer as Record<string, unknown>)?.sdp) {
          pendingOfferRef.current = (data.offer as Record<string, unknown>).sdp as string
        }
        toast.success(`Inkomend gesprek van: ${data.callerName}`, { duration: 5000 })
        setActiveCall(callData)
        setCallState('ringing')
      })
      .on('broadcast', { event: 'incoming_call' }, ({ payload }) => {
        const data = payload as Record<string, unknown>
        console.log('[call] incoming_call ontvangen:', data.callerName, 'userId:', userId)
        if (!data.callerId || data.callerId === userId) {
          console.log('[call] self/skip')
          return
        }
        if (callStateRef.current !== 'idle') {
          console.log('[call] niet idle (state:', callStateRef.current, '), skip')
          return
        }
        const roomId = (data.roomId as string) || (data.msgId as string) || ''
        if (!roomId) {
          console.warn('[call] incoming_call zonder roomId/msgId, skip')
          return
        }
        const callData: CallData = {
          roomId,
          callerId: data.callerId as string,
          callerName: data.callerName as string,
          callerAvatar: data.callerAvatar as string,
          receiverId: userId,
          isVideo: (data.isVideo as boolean) || false,
        }
        if ((data.offer as Record<string, unknown>)?.sdp) {
          pendingOfferRef.current = (data.offer as Record<string, unknown>).sdp as string
        }
        toast.success(`Inkomend gesprek van: ${data.callerName}`, {
          duration: 5000,
        })
        setActiveCall(callData)
        setCallState('ringing')
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        const call = activeCallRef.current
        console.log('[call] offer ontvangen, roomId:', payload.roomId, 'activeCall?.roomId:', call?.roomId, 'state:', callStateRef.current)
        if (!call || payload.roomId !== call.roomId) return
        if (!payload.sdp) return
        if (callStateRef.current === 'ringing') {
          toast.info('RTC sdp-aanbod (offer) ontvangen van beller...', {
            duration: 4000,
          })
          pendingOfferRef.current = payload.sdp
        }
        // Handle renegotiation during connected call (e.g. screen share)
        if (callStateRef.current === 'connected' && pcRef.current) {
          try {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription({ type: 'offer', sdp: payload.sdp })
            )
            const answer = await pcRef.current.createAnswer()
            await pcRef.current.setLocalDescription(answer)
            const targetId = activeCallRef.current!.callerId === userId
              ? activeCallRef.current!.receiverId
              : activeCallRef.current!.callerId
            const outbound = outboundRef.current
            if (targetId && outbound) {
              await outbound.send({
                type: 'broadcast',
                event: 'answer',
                payload: {
                  sdp: answer.sdp,
                  msgId: `answer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  senderId: userId,
                  targetId,
                  answer: { sdp: answer.sdp, type: 'answer' },
                },
              })
            }
          } catch (err) {
            console.error('[call] renegotiation error:', err)
          }
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (!activeCallRef.current) return
        const sdp = payload.sdp || (payload.answer as Record<string, unknown>)?.sdp as string
        handleAnswer(sdp)
      })
      .on('broadcast', { event: 'call_answer' }, async ({ payload }) => {
        if (!activeCallRef.current) return
        const sdp = (payload.answer as Record<string, unknown>)?.sdp as string
        handleAnswer(sdp)
      })
      .on('broadcast', { event: 'ice_candidate' }, async ({ payload }) => {
        if (!activeCallRef.current) return
        handleCandidate(payload.candidate)
      })
      .on('broadcast', { event: 'candidate' }, async ({ payload }) => {
        if (!activeCallRef.current) return
        handleCandidate(payload.candidate)
      })
      .on('broadcast', { event: 'call_candidate' }, async ({ payload }) => {
        if (!activeCallRef.current) return
        handleCandidate(payload.candidate)
      })
      .on('broadcast', { event: 'ended' }, () => {
        console.log('[call] ended ontvangen')
        if (activeCallRef.current) cleanup()
      })
      .on('broadcast', { event: 'hangup' }, () => {
        console.log('[call] hangup ontvangen')
        if (activeCallRef.current) cleanup()
      })
      .on('broadcast', { event: 'call_ended' }, () => {
        console.log('[call] call_ended ontvangen')
        if (activeCallRef.current) cleanup()
      })
      .on('broadcast', { event: 'screenshare_status' }, ({ payload }) => {
        const data = payload as Record<string, unknown>
        if (data.senderId === userId) return
        const sharing = !!data.isScreenSharing
        setIsRemoteScreenSharing(sharing)
        if (sharing) {
          toast.info('Beller deelt nu het scherm', { duration: 4000 })
        } else {
          toast.info('Beller is gestopt met scherm delen', { duration: 4000 })
        }
      })
      .subscribe((status) => {
        console.log('[call] listener channel status:', status)
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Call listener channel error')
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [userId])

  // Manage call sounds based on callState
  const prevCallStateRef = useRef<CallState>('idle')
  useEffect(() => {
    const prev = prevCallStateRef.current
    prevCallStateRef.current = callState

    // Stop incoming ringtone
    if (incomingSoundRef.current) {
      incomingSoundRef.current.stop()
      incomingSoundRef.current = null
    }

    // Stop dialing sound
    if (dialingSoundRef.current) {
      dialingSoundRef.current.stop()
      dialingSoundRef.current = null
    }

    if (callState === 'ringing') {
      // Incoming call — play ringtone from profile or fallback to synthetic
      if (ringtoneUrl) {
        const audio = new Audio(ringtoneUrl)
        audio.loop = true
        audio.volume = 0.5
        audio.play().catch(() => {
          incomingSoundRef.current = playSyntheticSound('ringing')
        })
        incomingSoundRef.current = { stop: () => audio.pause() }
      } else {
        incomingSoundRef.current = playSyntheticSound('ringing')
      }
    } else if (callState === 'calling') {
      // Outgoing call — play dialing sound (repeating)
      dialingSoundRef.current = playSyntheticSound('dialing')
    } else if (callState === 'connected' && prev === 'ringing') {
      // Answered — play short connected tone
      playSyntheticSound('end_call')
    } else if (callState === 'idle' && prev !== 'idle' && prev !== 'calling') {
      // Call ended — play end tone
      const end = playSyntheticSound('end_call')
      endCallSoundRef.current = end
      setTimeout(() => { endCallSoundRef.current = null }, 500)
    }

    return () => {
      incomingSoundRef.current?.stop()
      incomingSoundRef.current = null
      dialingSoundRef.current?.stop()
      dialingSoundRef.current = null
      endCallSoundRef.current?.stop()
      endCallSoundRef.current = null
    }
  }, [callState, ringtoneUrl])

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
    isScreenSharing,
    isRemoteScreenSharing,
    startScreenShare,
    stopScreenShare,
  }
}
