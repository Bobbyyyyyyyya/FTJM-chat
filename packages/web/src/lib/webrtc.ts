import { sendCallSignal, pollCallSignals, deleteCallSignal } from './db-conversations'
import type { Message } from './types'

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

let signalHandler: SignalHandler | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let lastPollTime: string | null = null
let pollConversationId: string | null = null
let pollUserId: string | null = null

export function startPollingSignals(
  conversationId: string,
  userId: string,
  handler: SignalHandler,
) {
  signalHandler = handler
  pollConversationId = conversationId
  pollUserId = userId

  const poll = async () => {
    if (!pollConversationId) return
    const msgs = await pollCallSignals(pollConversationId, lastPollTime)
    for (const msg of msgs) {
      if (msg.sender_id === userId) continue
      const signal = parseSignalMessage(msg.text)
      if (signal) {
        if (!lastPollTime || msg.created_at > lastPollTime) {
          lastPollTime = msg.created_at
        }
        handler(signal)
        await deleteCallSignal(msg.id).catch(() => {})
      }
    }
    if (msgs.length > 0) {
      // Do another round immediately in case there are more
      setTimeout(poll, 100)
    }
  }

  // Initial poll
  poll()

  // Poll every 500ms for new signals
  pollTimer = setInterval(poll, 500)

  return () => {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
    signalHandler = null
    pollConversationId = null
    pollUserId = null
    lastPollTime = null
  }
}

export function sendSignalViaMessages(
  conversationId: string,
  senderId: string,
  signal: CallSignal,
) {
  sendCallSignal(conversationId, senderId, signal)
}

const CALL_PREFIX = '__call__'

function parseSignalMessage(text: string): CallSignal | null {
  if (!text.startsWith(CALL_PREFIX)) return null
  try {
    return JSON.parse(text.slice(CALL_PREFIX.length)) as CallSignal
  } catch {
    return null
  }
}

export function cleanupSignals() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  signalHandler = null
  pollConversationId = null
  pollUserId = null
  lastPollTime = null
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
