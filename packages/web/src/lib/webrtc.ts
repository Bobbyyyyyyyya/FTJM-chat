import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
}

export interface CallSignal {
  type: 'offer' | 'answer' | 'ice-candidate' | 'end' | 'missed' | 'ringing'
  from: string
  to: string
  conversationId: string
  sdp?: string
  candidate?: RTCIceCandidateInit
}

type SignalHandler = (signal: CallSignal) => void

// ── Receive channel (always listening on own UID) ──

export function subscribeToCallChannel(
  userId: string,
  handler: SignalHandler,
) {
  const channel = supabase.channel(`calls:${userId}`, {
    config: { broadcast: { self: false } },
  })

  channel
    .on('broadcast', { event: 'call_signal' }, ({ payload }) => {
      handler(payload as CallSignal)
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error(`[call] Receive channel error for ${userId}`)
      }
    })

  return () => {
    channel.unsubscribe()
  }
}

// ── Send channels (one per target, created on demand) ──

const sendChannels = new Map<string, RealtimeChannel>()

function getSendChannel(targetId: string): RealtimeChannel {
  let ch = sendChannels.get(targetId)
  if (ch) return ch

  ch = supabase.channel(`calls:${targetId}`, {
    config: { broadcast: { self: false } },
  })
  ch.subscribe((status) => {
    if (status === 'CHANNEL_ERROR') {
      console.error(`[call] Send channel error for ${targetId}`)
      sendChannels.delete(targetId)
    }
  })
  sendChannels.set(targetId, ch)
  return ch
}

export function sendCallSignal(targetId: string, signal: CallSignal) {
  const ch = getSendChannel(targetId)
  ;(ch as any).httpSend('call_signal', signal)
}

export function cleanupSendChannel(targetId: string) {
  const ch = sendChannels.get(targetId)
  if (ch) {
    ch.unsubscribe()
    sendChannels.delete(targetId)
  }
}

export function cleanupAllSendChannels() {
  sendChannels.forEach((ch) => ch.unsubscribe())
  sendChannels.clear()
}

// ── Group call support ──

export function subscribeToGroupCallChannel(
  roomId: string,
  handler: SignalHandler,
) {
  const channel = supabase.channel(`group_calls:${roomId}`, {
    config: { broadcast: { self: false } },
  })

  channel
    .on('broadcast', { event: 'group_call_signal' }, ({ payload }) => {
      handler(payload as CallSignal)
    })
    .subscribe()

  return () => {
    channel.unsubscribe()
  }
}

export function sendGroupCallSignal(roomId: string, signal: CallSignal) {
  const ch = supabase.channel(`group_calls:${roomId}`)
  ;(ch as any).httpSend('group_call_signal', signal)
}

// ── Media & peer connection ──

export async function getLocalStream(video = false): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: { echoCancellation: true, noiseSuppression: true },
  }
  if (video) {
    constraints.video = {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 },
    }
  }
  return navigator.mediaDevices.getUserMedia(constraints)
}

export function createPeerConnection(
  onRemoteStream: (stream: MediaStream) => void,
  onIceCandidate: (candidate: RTCIceCandidateInit) => void,
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection(RTC_CONFIG)

  pc.onicecandidate = (e) => {
    if (e.candidate) onIceCandidate(e.candidate.toJSON())
  }

  pc.ontrack = (e) => {
    onRemoteStream(e.streams[0])
  }

  if (onConnectionStateChange) {
    pc.onconnectionstatechange = () => onConnectionStateChange(pc.connectionState)
  }

  return pc
}

export function flushIceCandidates(
  pc: RTCPeerConnection,
  candidates: RTCIceCandidateInit[],
): RTCIceCandidateInit[] {
  const failed: RTCIceCandidateInit[] = []
  for (const c of candidates) {
    pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => failed.push(c))
  }
  return failed
}

export function cleanupMediaStream(stream: MediaStream | null) {
  if (!stream) return
  stream.getTracks().forEach((t) => t.stop())
}
