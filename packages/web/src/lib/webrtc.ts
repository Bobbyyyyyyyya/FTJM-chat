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
  sdp?: string
  candidate?: RTCIceCandidateInit
}

type SignalHandler = (signal: CallSignal) => void

const outgoingChannels = new Map<string, { channel: RealtimeChannel; ready: boolean; queue: CallSignal[] }>()

export function listenForSignals(userId: string, handler: SignalHandler) {
  console.log('[call] listenForSignals for', userId)
  const channel = supabase.channel(`calls-${userId}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(channel as any).on('broadcast', { event: 'signal' }, (payload: any) => {
    console.log('[call] received signal', payload)
    handler(payload.data ?? payload.payload)
  })
  channel.subscribe((status, err) => {
    console.log('[call] listener channel status:', status, err)
    if (status === 'CHANNEL_ERROR') {
      console.error('[call] Signal channel error for', userId, err)
    }
  })
  return channel
}

export function sendSignal(toUserId: string, signal: CallSignal) {
  console.log('[call] sendSignal to', toUserId, signal.type)

  // Use REST API for sending (more reliable than WebSocket push)
  const sendViaRest = () => {
    const ch = supabase.channel(`calls-${toUserId}`)
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await (ch as any).httpSend('signal', signal).catch((e: any) => {
          console.error('[call] httpSend failed, trying WebSocket:', e)
          ch.send({ type: 'broadcast', event: 'signal', payload: signal })
        })
        setTimeout(() => supabase.removeChannel(ch), 3000)
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[call] send REST channel error')
      }
    })
  }
  sendViaRest()
}

export function cleanupSignals() {
  // Any cleanup if needed
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
