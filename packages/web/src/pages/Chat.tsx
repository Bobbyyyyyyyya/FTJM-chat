import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '@/hooks/useAuth'
import {
  getConversations,
  getConversation,
  sendMessage,
  updateMessage,
  deleteMessage,
  createConversation,
  setTypingStatus,
  getTypingStatus,
  getPosts,
  createPost,
  updatePost,
  deletePost,
  subscribeToMessages,
  subscribeToTypingStatus,
  subscribeToGeneralChat,
  getProfile,
  type Conversation,
  type Message,
  type Post,
} from '@/lib/db'
import { encryptText, maybeDecryptText } from '@/lib/crypto'
import { MessageEmbeds, LinkifyText, DataUriMedia } from '@/components/EmbedCard'
import SettingsModal, { applyCustomTheme, clearCustomTheme } from '@/components/SettingsModal'
import {
  listenForSignals,
  sendSignal,
  getLocalStream,
  createPeerConnection,
  cleanupMediaStream,
  flushIceCandidates,
  cleanupSignals,
  type CallSignal,
} from '@/lib/webrtc'
import CallUI from '@/components/CallUI'
import { startRingtone, stopRingtone } from '@/lib/ringtone'

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (typeof localStorage !== 'undefined' && localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  return { theme, toggle }
}

export default function ChatPage() {
  const { user, logout } = useAuthStore()
  const { theme, toggle: toggleTheme } = useTheme()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  const [generalChat, setGeneralChat] = useState<Post[]>([])
  const [activeTab, setActiveTab] = useState<'dm' | 'general'>('dm')

  const [messageInput, setMessageInput] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [selectedConversationProfiles, setSelectedConversationProfiles] = useState<Record<string, any>>({})
  const [profilePreview, setProfilePreview] = useState<{
    id: string
    display_name: string
    photo_url?: string
    banner_url?: string
    bio?: string
    isCurrentUser: boolean
  } | null>(null)
  const [profilesCache, setProfilesCache] = useState<Record<string, any>>({})

  const [editingId, setEditingId] = useState<{type: 'dm' | 'general', id: string} | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [myProfile, setMyProfile] = useState<any>(null)

  // Call state
  const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle')
  const [callVideo, setCallVideo] = useState(false)
  const [callRemoteName, setCallRemoteName] = useState('')
  const [callMuted, setCallMuted] = useState(false)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [incomingCaller, setIncomingCaller] = useState<string | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const pendingOfferRef = useRef<string | null>(null)
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([])
  const callStateRef = useRef(callState)
  callStateRef.current = callState

  // Listen for incoming call signals
  useEffect(() => {
    if (!user?.id) return
    const channel = listenForSignals(user.id, async (signal: CallSignal) => {
      if (signal.type === 'offer') {
        if (callStateRef.current !== 'idle') {
          sendSignal(signal.from, { type: 'missed', from: user.id, to: signal.from })
          return
        }
        setIncomingCaller(signal.from)
        pendingOfferRef.current = signal.sdp || null
        setCallVideo(signal.sdp?.includes('m=video') || false)
        setCallState('ringing')
      } else if (signal.type === 'answer' && callStateRef.current === 'calling') {
        const desc = new RTCSessionDescription({ type: 'answer', sdp: signal.sdp! })
        const pc = pcRef.current
        if (pc) {
          await pc.setRemoteDescription(desc)
          const leftover = flushIceCandidates(pc, pendingCandidates.current)
          pendingCandidates.current = leftover
        }
        setCallState('connected')
      } else if (signal.type === 'ice-candidate') {
        const pc = pcRef.current
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate!)).catch(() => {})
        } else if (signal.candidate) {
          pendingCandidates.current.push(signal.candidate)
        }
      } else if (signal.type === 'end') {
        endCallInternal()
      } else if (signal.type === 'missed') {
        setCallState('idle')
      }
    })
    return () => { channel.unsubscribe(); cleanupSignals() }
  }, [user?.id])

  // Load custom theme from localStorage on mount
  useEffect(() => {
    if (localStorage.getItem('ftjm_custom_theme_enabled') === 'true') {
      const saved = localStorage.getItem('ftjm_custom_theme')
      if (saved) {
        try {
          applyCustomTheme(JSON.parse(saved))
        } catch (e) {
          console.error('Error parsing saved theme:', e)
        }
      }
    }
  }, [])

  // Load profile for theme + notifications
  useEffect(() => {
    if (!user?.id) return
    getProfile(user.id).then((p) => {
      if (!p) return
      setMyProfile(p)
      if (p.use_custom_theme && p.custom_theme) {
        const merged = { ...p.custom_theme as any }
        applyCustomTheme(merged)
        localStorage.setItem('ftjm_custom_theme_enabled', 'true')
        localStorage.setItem('ftjm_custom_theme', JSON.stringify(merged))
      }
    })
  }, [user?.id])

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const convs = await getConversations()
        setConversations(convs)
      } catch (error) {
        console.error('Error loading conversations:', error)
      }
    }
    loadConversations()
  }, [])

  // Pre-load all profiles on startup
  useEffect(() => {
    const loadAllProfiles = async () => {
      const userIds = new Set<string>()

      const convs = await getConversations()
      convs.forEach((c) => {
        const parts = Array.isArray(c.participants) ? c.participants : []
        parts.forEach((id) => userIds.add(id))
      })

      const posts = await getPosts()
      posts.forEach((p) => userIds.add(p.author_id))

      const existing = new Set(Object.keys(profilesCache))
      const toFetch = [...userIds].filter((id) => !existing.has(id))

      await Promise.all(
        toFetch.map(async (uid) => {
          const p = await getProfile(uid)
          if (p) setProfilesCache((prev) => ({ ...prev, [uid]: p }))
        })
      )
    }

    loadAllProfiles()
  }, [])

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const posts = await getPosts()
        setGeneralChat(posts)
      } catch (error) {
        console.error('Error loading posts:', error)
      }
    }
    loadPosts()

    // Pre-fetch profiles for general chat authors
    getPosts().then((posts) => {
      const authorIds = [...new Set(posts.map((p) => p.author_id))]
      authorIds.forEach(async (uid) => {
        if (!profilesCache[uid]) {
          const p = await getProfile(uid)
          if (p) setProfilesCache((prev) => ({ ...prev, [uid]: p }))
        }
      })
    })

    const subscription = subscribeToGeneralChat((payload) => {
      if (payload.type === 'INSERT' && payload.new) {
        const newPost = payload.new
        setGeneralChat((prev) => [newPost, ...prev])
        if (newPost.author_id !== user?.id) {
          sendDesktopNotification('New post in General', maybeDecryptText(newPost.content), 'post')
        }
        if (!profilesCache[newPost.author_id]) {
          getProfile(newPost.author_id).then((p) => {
            if (p) setProfilesCache((prev) => ({ ...prev, [newPost.author_id]: p }))
          })
        }
      } else if (payload.type === 'UPDATE' && payload.new) {
        setGeneralChat((prev) => prev.map((p) => (p.id === payload.new!.id ? payload.new! : p)))
      } else if (payload.type === 'DELETE' && payload.old) {
        setGeneralChat((prev) => prev.filter((p) => p.id !== payload.old!.id))
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!selectedConvId || !user?.id) return

    let subscription: any = null
    let typingSub: any = null
    let isActive = true

    const loadMessages = async () => {
      try {
        const { conversation, messages: msgs } = await getConversation(selectedConvId)
        if (!isActive) return

        setSelectedConversation(conversation)
        setMessages(msgs)

        try {
          const participants = conversation.participants || []
          await Promise.all(
            participants.map(async (uid: string) => {
              if (!profilesCache[uid]) {
                const p = await getProfile(uid)
                if (p) setProfilesCache((prev) => ({ ...prev, [uid]: p }))
              }
            })
          )
        } catch (e) {
          console.warn('Error prefetching participant profiles', e)
        }

        subscription = subscribeToMessages(selectedConvId, (payload) => {
          if (payload.type === 'INSERT' && payload.new) {
            const newMsg = payload.new!
            setMessages((prev) => [...prev, newMsg])
            if (newMsg.sender_id !== user?.id) {
              const sender = getParticipantInfo(newMsg.sender_id)
              sendDesktopNotification(sender.display_name, maybeDecryptText(newMsg.text, newMsg.is_encrypted), 'dm')
            }
          } else if (payload.type === 'UPDATE' && payload.new) {
            if ((payload.new as any).deleted_at) {
              setMessages((prev) => prev.filter((m) => m.id !== payload.new!.id))
            } else {
              setMessages((prev) => prev.map((m) => (m.id === payload.new!.id ? payload.new! : m)))
            }
          } else if (payload.type === 'DELETE' && payload.old) {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old!.id))
          }
        })

        typingSub = subscribeToTypingStatus(selectedConvId, (users) => {
          setTypingUsers(
            users.filter((t) => t.user_id !== user.id).map((t) => t.user_id)
          )
        })

        if (!isActive) {
          subscription?.unsubscribe()
          typingSub?.unsubscribe()
        }
      } catch (error) {
        console.error('Error loading messages:', error)
      }
    }

    loadMessages()

    return () => {
      isActive = false
      subscription?.unsubscribe()
      typingSub?.unsubscribe()
    }
  }, [selectedConvId, user?.id])

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConvId || !user?.id) return
    try {
      const encryptedText = encryptText(messageInput)
      const newMessage = await sendMessage(selectedConvId, user.id, encryptedText, true)
      setMessages((prev) => [...prev, newMessage])
      setMessageInput('')
      setIsTyping(false)
      await setTypingStatus(selectedConvId, user.id, false)
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const handleSendPost = async () => {
    if (!messageInput.trim() || !user?.id) return
    try {
      const encryptedContent = encryptText(messageInput)
      const newPost = await createPost(user.id, encryptedContent)
      setGeneralChat((prev) => [newPost, ...prev])
      setMessageInput('')
    } catch (error) {
      console.error('Error sending post:', error)
    }
  }

  const handleTyping = async (typing: boolean) => {
    if (!selectedConvId || !user?.id) return
    setIsTyping(typing)
    try {
      await setTypingStatus(selectedConvId, user.id, typing)
    } catch (error) {
      console.error('Error updating typing status:', error)
    }
  }

  const handleEditMessage = (msg: Message) => {
    setEditingId({ type: 'dm', id: msg.id })
    setEditingValue(maybeDecryptText(msg.text, msg.is_encrypted))
  }

  const handleEditPost = (post: Post) => {
    setEditingId({ type: 'general', id: post.id })
    setEditingValue(maybeDecryptText(post.content))
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editingValue.trim()) return
    try {
      const encryptedText = encryptText(editingValue)
      if (editingId.type === 'dm') {
        const updated = await updateMessage(editingId.id, encryptedText, true)
        setMessages((prev) => prev.map((m) => (m.id === editingId.id ? updated : m)))
      } else {
        const updated = await updatePost(editingId.id, encryptedText)
        setGeneralChat((prev) => prev.map((p) => (p.id === editingId.id ? updated : p)))
      }
      setEditingId(null)
      setEditingValue('')
    } catch (error) {
      console.error('Error saving edit:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingValue('')
  }

  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm('Delete this message?')) return
    try {
      await deleteMessage(msgId)
      setMessages((prev) => prev.filter((m) => m.id !== msgId))
    } catch (error) {
      console.error('Error deleting message:', error)
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Delete this post?')) return
    try {
      await deletePost(postId)
      setGeneralChat((prev) => prev.filter((p) => p.id !== postId))
    } catch (error) {
      console.error('Error deleting post:', error)
    }
  }

  const getAvatarInitials = (value: string) => {
    const words = value.split(' ').filter(Boolean)
    if (words.length === 0) return 'U'
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
    return `${words[0][0]}${words[1][0]}`.toUpperCase()
  }

  const getParticipantInfo = (userId: string) => {
    const p = profilesCache[userId] || selectedConversationProfiles[userId]
    if (p) {
      return {
        display_name: p.display_name || p.original_name || (userId === user?.id ? 'You' : `User ${userId.slice(0, 6)}`),
        photo_url: p.photo_url,
      }
    }
    if (!selectedConversation) {
      return {
        display_name: userId === user?.id ? 'You' : `User ${userId.slice(0, 6)}`,
        photo_url: undefined,
      }
    }
    const participantNames = Array.isArray(selectedConversation.participant_names) ? selectedConversation.participant_names : []
    const participantPhotos = Array.isArray(selectedConversation.participant_photos) ? selectedConversation.participant_photos : []
    const participants = Array.isArray(selectedConversation.participants) ? selectedConversation.participants : []
    const index = participants.findIndex((id) => id === userId)
    const display_name = participantNames[index] || (userId === user?.id ? 'You' : `User ${userId.slice(0, 6)}`)
    const photo_url = participantPhotos[index]
    return { display_name, photo_url }
  }

  const openProfile = (userId: string, displayName?: string, photoUrl?: string) => {
    const setFromProfile = (p: any) =>
      setProfilePreview({
        id: userId,
        display_name: p?.display_name || displayName || getParticipantInfo(userId).display_name,
        photo_url: p?.photo_url || photoUrl || getParticipantInfo(userId).photo_url,
        banner_url: p?.banner_url,
        bio: p?.bio,
        isCurrentUser: userId === user?.id,
      })
    const cached = profilesCache[userId]
    if (cached) return setFromProfile(cached)
    if (displayName || photoUrl) {
      setProfilePreview({
        id: userId,
        display_name: displayName || getParticipantInfo(userId).display_name,
        photo_url: photoUrl || getParticipantInfo(userId).photo_url,
        banner_url: undefined,
        bio: undefined,
        isCurrentUser: userId === user?.id,
      })
    }
    getProfile(userId).then((p) => {
      if (p) {
        setProfilesCache((prev) => ({ ...prev, [userId]: p }))
        setFromProfile(p)
      }
    })
  }

  const closeProfile = () => setProfilePreview(null)

  function sendDesktopNotification(title: string, body: string, type: 'dm' | 'post') {
    if (Notification.permission !== 'granted') return
    if (!myProfile?.notification_settings) return
    const ns = myProfile.notification_settings as any
    if (type === 'dm' && !ns.notify_new_messages) return
    if (type === 'post' && !ns.notify_new_posts) return
    new Notification(title, {
      body: body.slice(0, 200),
      icon: '/android-chrome-192x192.png',
    })
  }

  // Ringtone + desktop notification for incoming calls
  const prevCallState = useRef(callState)
  useEffect(() => {
    if (callState === 'ringing' && prevCallState.current !== 'ringing') {
      startRingtone()
      if (Notification.permission === 'granted') {
        new Notification(`Incoming call from ${callRemoteName}`, {
          body: callVideo ? 'Video call' : 'Voice call',
          icon: '/android-chrome-192x192.png',
        })
      }
    } else if (prevCallState.current === 'ringing' && callState !== 'ringing') {
      stopRingtone()
    }
    prevCallState.current = callState
  }, [callState, callRemoteName, callVideo])

  function endCallInternal() {
    pcRef.current?.close()
    pcRef.current = null
    cleanupMediaStream(localStreamRef.current)
    localStreamRef.current = null
    setRemoteStream(null)
    setLocalStream(null)
    setCallState('idle')
    setIncomingCaller(null)
    pendingOfferRef.current = null
    pendingCandidates.current = []
  }

  async function startCall(video: boolean) {
    if (!user?.id || !selectedConversation) return
    const otherId = selectedConversation.participants!.find((id: string) => id !== user.id)
    if (!otherId) return
    setCallVideo(video)
    setCallState('calling')
    setCallRemoteName(getParticipantInfo(otherId).display_name)

    try {
      const stream = await getLocalStream(video)
      localStreamRef.current = stream
      setLocalStream(stream)

      const pc = createPeerConnection(
        (rs) => setRemoteStream(rs),
        (candidate) => sendSignal(otherId, { type: 'ice-candidate', from: user.id, to: otherId, candidate }),
        (state) => {
          if (state === 'disconnected' || state === 'failed') {
            if (callStateRef.current === 'connected') endCallInternal()
          }
        },
      )
      pcRef.current = pc
      stream.getTracks().forEach((t) => pc.addTrack(t, stream))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      sendSignal(otherId, { type: 'offer', from: user.id, to: otherId, sdp: offer.sdp! })
    } catch (e) {
      console.error('Call error:', e)
      endCallInternal()
    }
  }

  async function answerCall() {
    if (!user?.id || !incomingCaller || !pendingOfferRef.current) return
    setCallState('calling')
    setCallRemoteName(getParticipantInfo(incomingCaller).display_name)

    try {
      const stream = await getLocalStream(callVideo)
      localStreamRef.current = stream
      setLocalStream(stream)

      const pc = createPeerConnection(
        (rs) => setRemoteStream(rs),
        (candidate) => sendSignal(incomingCaller, { type: 'ice-candidate', from: user.id, to: incomingCaller, candidate }),
        (state) => {
          if (state === 'disconnected' || state === 'failed') {
            if (callStateRef.current === 'connected') endCallInternal()
          }
        },
      )
      pcRef.current = pc
      stream.getTracks().forEach((t) => pc.addTrack(t, stream))

      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: pendingOfferRef.current }))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      const leftover = flushIceCandidates(pc, pendingCandidates.current)
      pendingCandidates.current = leftover
      sendSignal(incomingCaller, { type: 'answer', from: user.id, to: incomingCaller, sdp: answer.sdp! })
      setCallState('connected')
    } catch (e) {
      console.error('Answer error:', e)
      endCallInternal()
    }
  }

  function declineCall() {
    if (!user?.id || !incomingCaller) return
    sendSignal(incomingCaller, { type: 'end', from: user.id, to: incomingCaller })
    setCallState('idle')
    setIncomingCaller(null)
    pendingOfferRef.current = null
  }

  function endCall() {
    if (!user?.id) return
    const target = incomingCaller || selectedConversation?.participants?.find((id: string) => id !== user.id)
    if (target) sendSignal(target, { type: 'end', from: user.id, to: target })
    endCallInternal()
  }

  function toggleMute() {
    const stream = localStreamRef.current
    if (!stream) return
    const audio = stream.getAudioTracks()[0]
    if (audio) {
      audio.enabled = !audio.enabled
      setCallMuted(!audio.enabled)
    }
  }

  const getConversationPreview = (conv: Conversation) => {
    const convParticipants = Array.isArray(conv.participants) ? conv.participants : []
    const convNames = Array.isArray(conv.participant_names) ? conv.participant_names : []
    const convPhotos = Array.isArray(conv.participant_photos) ? conv.participant_photos : []

    if (conv.is_group) {
      if (conv.title) return { display_name: conv.title, photo_url: undefined, isGroup: true }
      const others = convParticipants
        .map((id, i) => ({ id, name: convNames[i], photo: convPhotos[i] }))
        .filter((x) => x.id !== user?.id)
      const firstNames = others.map((x) => {
        const cached = profilesCache[x.id]
        return cached?.display_name || x.name || `User ${x.id.slice(0, 6)}`
      })
      return {
        display_name: firstNames.slice(0, 3).join(', ') + (firstNames.length > 3 ? ` +${firstNames.length - 3}` : ''),
        photo_url: undefined,
        isGroup: true,
      }
    }

    const otherIndex = convParticipants.findIndex((id) => id !== user?.id)
    const otherId = otherIndex >= 0 ? convParticipants[otherIndex] : convParticipants[0]
    const cached = otherId ? profilesCache[otherId] : null
    const display_name = cached?.display_name || convNames[otherIndex] || convNames[0] || 'Conversation'
    const photo_url = cached?.photo_url || convPhotos[otherIndex]
    return { display_name, photo_url, isGroup: false }
  }

  return (
    <div className="h-screen flex flex-col bg-body">
      {/* Header */}
      <header className="bg-surface border-b border-surface px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-accent flex items-center justify-center shadow-sm">
            <span className="text-base font-bold text-white">F</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-primary">FTJM Chat</h1>
            <p className="text-[11px] text-muted">Secure messaging</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-surface-muted rounded-xl px-3.5 py-2 border-subtle">
            <div className="h-7 w-7 rounded-full bg-gradient-accent flex items-center justify-center text-[10px] font-bold text-white">
              {getAvatarInitials(user?.display_name || 'U')}
            </div>
            <span className="text-sm font-medium text-primary">{user?.display_name}</span>
          </div>
          <button
            onClick={toggleTheme}
            className="h-9 w-9 rounded-xl bg-surface-muted hover:bg-surface-hover flex items-center justify-center transition-all duration-200"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="h-9 w-9 rounded-xl bg-surface-muted hover:bg-surface-hover flex items-center justify-center transition-all duration-200"
            aria-label="Settings"
          >
            <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 bg-surface-muted hover:bg-surface-hover active:scale-95 text-secondary font-medium rounded-xl text-sm transition-all duration-200"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - only show in DM mode */}
        {activeTab === 'dm' && (
        <aside className="w-72 bg-surface border-r border-surface flex flex-col shrink-0">
          <div className="px-5 pt-5 pb-3 border-b border-subtle">
            <h2 className="text-base font-bold text-primary flex items-center gap-2">
              <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chats
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <p className="text-muted text-sm font-medium">No conversations yet</p>
                <p className="text-muted text-xs mt-1">Start a new chat to begin</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const preview = getConversationPreview(conv)
                const isSelected = selectedConvId === conv.id
                const isGroup = conv.is_group
                return (
                  <button
                    key={conv.id}
                    onClick={() => { setSelectedConvId(conv.id); setActiveTab('dm') }}
                    className={`sidebar-item ${isSelected ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}
                  >
                    {isGroup ? (
                      <div className={`h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center text-sm font-bold shrink-0 ${
                        isSelected ? 'bg-gradient-to-br from-amber-400 to-orange-400 shadow-sm text-white' : 'bg-amber-100 text-amber-600'
                      }`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    ) : (
                      <div className={`h-10 w-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                        isSelected ? 'bg-gradient-accent shadow-sm' : 'bg-surface-hover text-secondary'
                      }`}>
                        {preview.photo_url ? (
                          <img src={preview.photo_url} alt={preview.display_name} className="h-full w-full object-cover" />
                        ) : (
                          getAvatarInitials(preview.display_name)
                        )}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${isSelected ? '' : ''}`}>
                        {preview.display_name}
                      </p>
                      <p className={`text-xs mt-0.5 ${isSelected ? (isGroup ? 'text-amber-600' : 'text-accent') : ''}`}>
                        {isGroup ? 'Group' : 'Direct message'}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>
        )}

        {/* Main */}
        <main className="flex-1 flex flex-col bg-body">
          {/* Tabs */}
          <div className="bg-surface border-b border-surface px-5 pt-4 pb-0 flex gap-2">
            <button
              onClick={() => setActiveTab('dm')}
              className={`tab-btn ${activeTab === 'dm' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
            >
              <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Messages
            </button>
            <button
              onClick={() => { setActiveTab('general'); setSelectedConvId(null) }}
              className={`tab-btn ${activeTab === 'general' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
            >
              <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              General
            </button>
          </div>

          {/* Chat header */}
          <div className="bg-surface border-b border-subtle px-6 py-4 flex items-center justify-between gap-3">
            {activeTab === 'dm' && selectedConversation && (
              <>
              <div className="flex items-center gap-3 min-w-0">
                {selectedConversation.is_group && (
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shrink-0 shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm text-secondary">
                    {selectedConversation.is_group
                      ? (selectedConversation.title || 'Group')
                      : 'Direct message'}
                  </p>
                  <p className="text-sm text-primary font-medium truncate">
                    {(Array.isArray(selectedConversation.participant_names) ? selectedConversation.participant_names : [])
                      .filter((name, idx) => (Array.isArray(selectedConversation.participants) ? selectedConversation.participants : [])[idx] !== user?.id)
                      .join(', ')}
                  </p>
                </div>
              </div>
              {!selectedConversation.is_group && (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startCall(false)}
                    className="h-9 w-9 rounded-xl bg-surface-muted hover:bg-surface-hover flex items-center justify-center transition-all active:scale-90"
                    title="Voice call">
                    <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </button>
                  <button onClick={() => startCall(true)}
                    className="h-9 w-9 rounded-xl bg-surface-muted hover:bg-surface-hover flex items-center justify-center transition-all active:scale-90"
                    title="Video call">
                    <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              )}
              </>
            )}
            {activeTab === 'dm' && !selectedConversation && (
              <p className="text-sm text-muted">Select a conversation</p>
            )}
            {activeTab === 'general' && (
              <>
                <p className="text-sm text-primary font-medium">General Chat</p>
                <span className="text-[10px] uppercase tracking-wider text-accent font-semibold bg-accent/10 px-3 py-1.5 rounded-full border border-accent/20 shrink-0">
                  Live room
                </span>
              </>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 min-h-0">
            {activeTab === 'dm' ? (
              selectedConvId ? (
                <>
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16">
                      <p className="text-muted font-medium">No messages yet</p>
                      <p className="text-muted text-sm mt-1">Send the first message!</p>
                    </div>
                  )}
                  {[...messages].reverse().map((msg) => {
                    const isMine = msg.sender_id === user?.id
                    const participant = getParticipantInfo(msg.sender_id)
                    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    const isEditing = editingId?.type === 'dm' && editingId.id === msg.id
                    return (
                      <div key={msg.id} className={`flex gap-3 items-end ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!isMine && (
                          <button onClick={() => openProfile(msg.sender_id, participant.display_name, participant.photo_url)}
                            className="h-8 w-8 rounded-full overflow-hidden bg-surface-hover flex items-center justify-center text-[10px] font-bold text-secondary shrink-0 hover:ring-2 hover:ring-accent transition-all">
                            {participant.photo_url ? (
                              <img src={participant.photo_url} alt={participant.display_name} className="h-full w-full object-cover" />
                            ) : getAvatarInitials(participant.display_name)}
                          </button>
                        )}
                        <div className={`max-w-xl ${isMine ? 'chat-bubble-mine' : 'chat-bubble-other'} px-4 py-2.5`}>
                          <div className={`flex items-center gap-2 mb-0.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isMine ? 'text-white/80' : 'text-muted'}`}>
                              {isMine ? 'You' : participant.display_name}
                            </span>
                          </div>
                          {isEditing ? (
                            <div className="flex flex-col gap-2">
                              <input
                                type="text"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit() }}
                                className="input-field !py-1.5 !text-sm"
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <button onClick={handleSaveEdit}
                                  className="text-[11px] px-3 py-1 rounded-lg bg-accent text-accent-content hover:bg-accent-hover font-medium transition-colors">
                                  Save
                                </button>
                                <button onClick={handleCancelEdit}
                                  className="text-[11px] px-3 py-1 rounded-lg bg-surface-muted text-secondary hover:bg-surface-hover font-medium transition-colors">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className={`whitespace-pre-line break-words text-sm leading-relaxed ${isMine ? 'text-white' : 'text-primary'}`}>
                                <LinkifyText text={maybeDecryptText(msg.text, msg.is_encrypted)} />
                              </div>
                              <DataUriMedia text={maybeDecryptText(msg.text, msg.is_encrypted)} />
                              <MessageEmbeds text={maybeDecryptText(msg.text, msg.is_encrypted)} />
                              <div className={`flex items-center gap-2 mt-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                                <p className={`text-[10px] ${isMine ? 'text-white/60' : 'text-muted'}`}>{time}</p>
                                {isMine && (
                                  <div className="flex gap-1.5">
                                    <button onClick={() => handleEditMessage(msg)}
                                      className="p-1 text-muted hover:text-primary transition-colors"
                                      title="Edit">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button onClick={() => handleDeleteMessage(msg.id)}
                                      className="p-1 text-muted hover:text-red-400 transition-colors"
                                      title="Delete">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        {isMine && (
                          <button onClick={() => openProfile(msg.sender_id, user?.display_name ?? undefined, user?.photo_url ?? undefined)}
                            className="h-8 w-8 rounded-full overflow-hidden bg-surface-hover flex items-center justify-center text-[10px] font-bold text-secondary shrink-0 hover:ring-2 hover:ring-accent transition-all">
                            {user?.photo_url ? (
                              <img src={user.photo_url} alt={user.display_name ?? ''} className="h-full w-full object-cover" />
                            ) : getAvatarInitials(user?.display_name || 'You')}
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {typingUsers.length > 0 && (
                    <div className="flex items-center gap-2 text-muted text-sm">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      {typingUsers.map((id) => getParticipantInfo(id).display_name).join(', ')} typing...
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-muted text-lg font-medium">Select a conversation</p>
                  <p className="text-muted text-sm mt-1">Choose a chat from the sidebar</p>
                </div>
              )
            ) : (
              <div className="space-y-4">
                {generalChat.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-20">
                    <p className="text-muted text-lg font-medium">No messages yet</p>
                    <p className="text-muted text-sm mt-1">Be the first to post in general chat</p>
                  </div>
                ) : (
                  generalChat.map((post) => {
                    const isMine = post.author_id === user?.id
                    const authorInfo = getParticipantInfo(post.author_id)
                    const authorName = isMine ? 'You' : authorInfo.display_name
                    const isEditing = editingId?.type === 'general' && editingId.id === post.id
                    return (
                      <div key={post.id} className="chat-bubble-other !rounded-3xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <button onClick={() => openProfile(post.author_id, authorName, authorInfo.photo_url)}
                            className="h-9 w-9 rounded-full overflow-hidden bg-surface-hover flex items-center justify-center text-xs font-bold text-secondary shrink-0 hover:ring-2 hover:ring-accent transition-all">
                            {authorInfo.photo_url ? (
                              <img src={authorInfo.photo_url} alt={authorName} className="h-full w-full object-cover" />
                            ) : getAvatarInitials(authorName)}
                          </button>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-primary">{authorName}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[11px] text-muted">{new Date(post.created_at).toLocaleString()}</p>
                              {isMine && (
                                <div className="flex gap-1.5">
                                  <button onClick={() => handleEditPost(post)}
                                    className="p-1 text-muted hover:text-primary transition-colors"
                                    title="Edit">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button onClick={() => handleDeletePost(post.id)}
                                    className="p-1 text-muted hover:text-red-400 transition-colors"
                                    title="Delete">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit() }}
                              className="input-field !py-1.5 !text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <button onClick={handleSaveEdit}
                                className="text-[11px] px-3 py-1 rounded-lg bg-accent text-accent-content hover:bg-accent-hover font-medium transition-colors">
                                Save
                              </button>
                              <button onClick={handleCancelEdit}
                                className="text-[11px] px-3 py-1 rounded-lg bg-surface-muted text-secondary hover:bg-surface-hover font-medium transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-primary whitespace-pre-line break-words text-sm leading-relaxed">
                              <LinkifyText text={maybeDecryptText(post.content)} />
                            </div>
                            <DataUriMedia text={maybeDecryptText(post.content)} />
                            <MessageEmbeds text={maybeDecryptText(post.content)} />
                          </>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="bg-surface border-t border-surface px-6 py-4">
            <div className="flex gap-3 max-w-4xl mx-auto">
              <input
                type="text"
                placeholder={activeTab === 'dm' ? (selectedConvId ? 'Type a message...' : 'Select a conversation first') : 'Share something with everyone...'}
                value={messageInput}
                onChange={(e) => { setMessageInput(e.target.value); if (activeTab === 'dm') handleTyping(e.target.value.length > 0) }}
                onKeyPress={(e) => { if (e.key === 'Enter') activeTab === 'dm' ? handleSendMessage() : handleSendPost() }}
                className="input-field"
                disabled={activeTab === 'dm' && !selectedConvId}
              />
              <button
                onClick={activeTab === 'dm' ? handleSendMessage : handleSendPost}
                disabled={activeTab === 'dm' && !selectedConvId}
                className="btn-send"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
                Send
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Settings modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Call UI */}
      {callState !== 'idle' && (
        <CallUI
          callState={callState}
          video={callVideo}
          muted={callMuted}
          remoteName={callRemoteName}
          remoteStream={remoteStream}
          localStream={localStream}
          onAnswer={answerCall}
          onDecline={declineCall}
          onEnd={endCall}
          onToggleMute={toggleMute}
        />
      )}

      {/* Profile modal */}
      {profilePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/20 dark:bg-black/40 backdrop-blur-sm" onClick={closeProfile}>
          <div className="w-full max-w-sm bg-surface rounded-3xl shadow-xl shadow-black/10 dark:shadow-black/50 border border-subtle overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Banner */}
            {profilePreview.banner_url ? (
              <div className="h-36 bg-cover bg-center" style={{ backgroundImage: `url(${profilePreview.banner_url})` }} />
            ) : (
              <div className="h-36 bg-gradient-accent" />
            )}

            {/* Close button */}
            <button onClick={closeProfile} className="absolute top-3 right-3 rounded-xl bg-black/20 p-2 text-white hover:bg-black/40 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <div className="px-7 pb-7 -mt-12">
              <div className="flex items-end gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden bg-gradient-accent flex items-center justify-center text-3xl font-bold text-white shadow-lg ring-4 ring-surface shrink-0">
                  {profilePreview.photo_url ? (
                    <img src={profilePreview.photo_url} alt={profilePreview.display_name} className="h-full w-full object-cover" />
                  ) : getAvatarInitials(profilePreview.display_name)}
                </div>
                <div className="pb-1">
                  <p className="text-lg font-bold text-primary">{profilePreview.display_name}</p>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium inline-block mt-1 ${
                    profilePreview.isCurrentUser ? 'bg-accent/10 text-accent' : 'bg-surface-muted text-secondary'
                  }`}>
                    {profilePreview.isCurrentUser ? 'You' : 'User'}
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-subtle">
                <p className="text-sm text-secondary leading-relaxed">
                  {profilePreview.bio || <span className="text-muted italic">No profile bio available.</span>}
                </p>
                {!profilePreview.isCurrentUser && (
                  <p className="text-xs text-muted flex items-center gap-2 mt-3">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Private profile — limited info available.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
