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

  let entry = outgoingChannels.get(toUserId)
  if (!entry) {
    console.log('[call] creating new outgoing channel for', toUserId)
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null
    const channel = supabase.channel(`calls-${toUserId}`)
    entry = { channel, ready: false, queue: [signal] }
    outgoingChannels.set(toUserId, entry)
    channel.subscribe((status) => {
      console.log('[call] outgoing channel status for', toUserId, status)
      if (status === 'SUBSCRIBED') {
        entry!.ready = true
        if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null }
        for (const s of entry!.queue) {
          channel.send({ type: 'broadcast', event: 'signal', payload: s })
        }
        entry!.queue = []
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[call] Send channel error for', toUserId)
        outgoingChannels.delete(toUserId)
      }
    })
    // Fallback if subscription takes too long
    fallbackTimer = setTimeout(() => {
      if (!entry!.ready) {
        console.log('[call] outgoing channel timeout, sending via temp channel')
        outgoingChannels.delete(toUserId)
        const tmp = supabase.channel(`calls-${toUserId}`)
        tmp.subscribe((s) => {
          if (s === 'SUBSCRIBED') {
            tmp.send({ type: 'broadcast', event: 'signal', payload: signal })
            setTimeout(() => supabase.removeChannel(tmp), 3000)
          }
        })
      }
    }, 4000)
  } else if (entry.ready) {
    entry.channel.send({ type: 'broadcast', event: 'signal', payload: signal })
  } else {
    console.log('[call] queuing signal for', toUserId, signal.type)
    entry.queue.push(signal)
  }
}

export function cleanupSignals() {
  for (const { channel } of outgoingChannels.values()) {
    supabase.removeChannel(channel)
  }
  outgoingChannels.clear()
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
