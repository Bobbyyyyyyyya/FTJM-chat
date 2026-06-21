import { supabase } from './supabase'

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
}

export interface CallSignal {
  type: 'offer' | 'answer' | 'ice-candidate' | 'end' | 'missed' | 'ringing'
  from: string
  to: string
  sdp?: string
  candidate?: RTCIceCandidateInit
}

type SignalHandler = (signal: CallSignal) => void

export function listenForSignals(userId: string, handler: SignalHandler) {
  const channel = supabase.channel(`calls-${userId}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(channel as any).on('broadcast', { event: 'signal' }, (payload: any) => {
    handler(payload.data ?? payload.payload)
  })
  channel.subscribe()
  return channel
}

export function sendSignal(toUserId: string, signal: CallSignal) {
  const channel = supabase.channel(`calls-${toUserId}`)
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.send({ type: 'broadcast', event: 'signal', payload: signal })
      setTimeout(() => supabase.removeChannel(channel), 2000)
    }
  })
}

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
