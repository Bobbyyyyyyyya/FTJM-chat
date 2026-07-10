import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
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
  getProfiles,
  followUser,
  unfollowUser,
  isFollowing,
  getFollowerCount,
  getFollowingCount,
  getFollowingIds,
  getProfileMedia,
  uploadProfileMedia,
  deleteProfileMedia,
  getFeedMedia,
  subscribeToFeed,
  likeMedia,
  unlikeMedia,
  addComment,
  deleteComment,
  type Conversation,
  type Message,
  type Post,
} from '@/lib/db'
import { encryptText, maybeDecryptText } from '@/lib/crypto'
import { MessageEmbeds, LinkifyText, DataUriMedia } from '@/components/EmbedCard'
import SettingsContent, { applyCustomTheme, clearCustomTheme } from '@/components/SettingsContent'
import GamesArcade from '@/components/GamesArcade'
import { isCallSignal } from '@/lib/db'
import { compressImage } from '@/lib/storage'
import type { ChatTab, ProfileMedia as ProfileMediaType } from '@/lib/types'
import { useVoiceCallContext } from '@/hooks/useVoiceCallContext'

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

export default function ChatPage({ onlineUsers }: { onlineUsers: Set<string> }) {
  const { user, logout, lockApp } = useAuthStore()
  const { theme, toggle: toggleTheme } = useTheme()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  const [generalChat, setGeneralChat] = useState<Post[]>([])
  const [activeTab, setActiveTab] = useState<ChatTab>('dm')

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
  const [replyingTo, setReplyingTo] = useState<Post | null>(null)
  const [sending, setSending] = useState(false)
  const [myProfile, setMyProfile] = useState<any>(null)

  // Social state
  const [feedMedia, setFeedMedia] = useState<ProfileMediaType[]>([])
  const [profileMedia, setProfileMedia] = useState<ProfileMediaType[]>([])
  const [isFollowingUser, setIsFollowingUser] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [profilePreviewTab, setProfilePreviewTab] = useState<'info' | 'media'>('info')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Voice call
  const {
    startCall: vcStartCall,
  } = useVoiceCallContext()

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

      const profiles = await getProfiles(toFetch)
      setProfilesCache((prev) => {
        const next = { ...prev }
        for (const p of profiles) next[p.id] = p
        return next
      })
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
      getProfiles(authorIds).then((profiles) => {
        setProfilesCache((prev) => {
          const next = { ...prev }
          for (const p of profiles) next[p.id] = p
          return next
        })
      })
    })

    const subscription = subscribeToGeneralChat((payload) => {
      if (payload.type === 'INSERT' && payload.new) {
        const newPost = payload.new
        if (newPost.author_id !== user?.id) {
          setGeneralChat((prev) => [newPost, ...prev])
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

  // Load feed when user is available
  useEffect(() => {
    if (!user?.id) return
    loadFeed()
  }, [user?.id])

  const loadFeed = async () => {
    if (!user?.id) return
    try {
      const media = await getFeedMedia(user.id)
      setFeedMedia(media)
    } catch (error) {
      console.error('Error loading feed:', error)
    }
  }

  // Subscribe to feed updates
  useEffect(() => {
    if (!user?.id) return
    let sub: any = null
    getFollowingIds(user.id).then((ids) => {
      sub = subscribeToFeed(ids, (payload) => {
        if (payload.type === 'INSERT') {
          setFeedMedia((prev) => [payload.new, ...prev])
          const name = profilesCache[payload.new.user_id]?.display_name || 'Someone'
          sendDesktopNotification('New upload', `${name} heeft nieuwe media geüpload`, 'post')
        }
      })
    })
    return () => sub?.unsubscribe()
  }, [user?.id])

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
          const participants = (conversation.participants || []).filter((uid: string) => !profilesCache[uid])
          if (participants.length > 0) {
            const profiles = await getProfiles(participants)
            setProfilesCache((prev) => {
              const next = { ...prev }
              for (const p of profiles) next[p.id] = p
              return next
            })
          }
        } catch (e) {
          console.warn('Error prefetching participant profiles', e)
        }

        subscription = subscribeToMessages(selectedConvId, (payload) => {
          if (payload.type === 'INSERT' && payload.new) {
            const newMsg = payload.new!
            if (newMsg.sender_id !== user?.id) {
              setMessages((prev) => [...prev, newMsg])
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
    if (!messageInput.trim() || !selectedConvId || !user?.id || sending) return
    setSending(true)
    try {
      const encryptedText = encryptText(messageInput)
      const newMessage = await sendMessage(selectedConvId, user.id, encryptedText, true)
      setMessages((prev) => [...prev, newMessage])
      setMessageInput('')
      setIsTyping(false)
      await setTypingStatus(selectedConvId, user.id, false)
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleSendPost = async () => {
    if (!messageInput.trim() || !user?.id || sending) return
    setSending(true)
    try {
      const encryptedContent = encryptText(messageInput)
      const newPost = await createPost(user.id, encryptedContent, replyingTo?.id)
      setGeneralChat((prev) => [newPost, ...prev])
      setMessageInput('')
      setReplyingTo(null)
    } catch (error) {
      console.error('Error sending post:', error)
    } finally {
      setSending(false)
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
    setProfilePreviewTab('info')
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
    if (cached) setFromProfile(cached)
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

    // Load follow state
    if (user?.id && userId !== user.id) {
      isFollowing(user.id, userId).then(setIsFollowingUser)
      getFollowerCount(userId).then(setFollowerCount)
      getFollowingCount(userId).then(setFollowingCount)
    } else if (user?.id && userId === user.id) {
      getFollowerCount(userId).then(setFollowerCount)
      getFollowingCount(userId).then(setFollowingCount)
    }

    // Load profile media
    getProfileMedia(userId).then(setProfileMedia)
  }

  const closeProfile = () => {
    setProfilePreview(null)
    setProfileMedia([])
    setIsFollowingUser(false)
  }

  const handleFollowToggle = async () => {
    if (!user?.id || !profilePreview || profilePreview.isCurrentUser) return
    try {
      if (isFollowingUser) {
        await unfollowUser(user.id, profilePreview.id)
        setIsFollowingUser(false)
        setFollowerCount((c) => Math.max(0, c - 1))
      } else {
        await followUser(user.id, profilePreview.id)
        setIsFollowingUser(true)
        setFollowerCount((c) => c + 1)
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
    }
  }

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploading(true)
    try {
      const { dataUri, mediaType } = await compressImage(file)
      const media = await uploadProfileMedia(user.id, dataUri, mediaType)
      setProfileMedia((prev) => [media, ...prev])
    } catch (error) {
      console.error('Error uploading media:', error)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteMedia = async (mediaId: string) => {
    if (!window.confirm('Delete this media?')) return
    try {
      await deleteProfileMedia(mediaId)
      setProfileMedia((prev) => prev.filter((m) => m.id !== mediaId))
    } catch (error) {
      console.error('Error deleting media:', error)
    }
  }

  function playNotificationSound(type: 'dm' | 'post') {
    const ns = (myProfile?.notification_settings || {}) as any
    if (!ns.enable_sounds) return
    const url = type === 'dm' ? ns.message_sound : ns.post_sound
    if (!url) return
    try {
      const audio = new Audio(url)
      audio.volume = 0.5
      audio.play().catch(() => {})
    } catch {}
  }

  function sendDesktopNotification(title: string, body: string, type: 'dm' | 'post') {
    const ns = (myProfile?.notification_settings || {}) as any
    if (type === 'dm' && ns.notify_new_messages === false) return
    if (type === 'post' && ns.notify_new_posts === false) return
    playNotificationSound(type)
    const text = body.slice(0, 200)
    const sendViaElectron = () => {
      if ((window as any).electron?.notify) {
        (window as any).electron.notify(title, text).catch(() => {
          if (Notification.permission === 'granted') {
            new Notification(title, { body: text })
          }
        })
        return true
      }
      return false
    }
    if (!sendViaElectron() && Notification.permission === 'granted') {
      new Notification(title, { body: text })
    }
  }

  function handleStartCall(video: boolean) {
    if (!user?.id || !selectedConversation) return
    const otherId = selectedConversation.participants?.find((id: string) => id !== user.id)
    if (!otherId) return
    const info = getParticipantInfo(otherId)
    vcStartCall(otherId, info.display_name, info.photo_url || '', video)
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
    <div className="h-screen flex bg-body">
      {/* ===== SIDEBAR (always visible) ===== */}
      <aside className="w-64 flex flex-col shrink-0 bg-surface border-r border-border">
        {/* Brand */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#0f172a] flex items-center justify-center shadow-sm overflow-hidden">
              <svg viewBox="0 0 512 512" className="h-5 w-5">
                <defs>
                  <linearGradient id="chatAccent" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#2dd4bf"/>
                    <stop offset="100%" stopColor="#38bdf8"/>
                  </linearGradient>
                  <linearGradient id="chatFg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff"/>
                    <stop offset="100%" stopColor="#cbd5e1"/>
                  </linearGradient>
                  <linearGradient id="chatBar" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2dd4bf"/>
                    <stop offset="50%" stopColor="#38bdf8"/>
                    <stop offset="100%" stopColor="#2dd4bf"/>
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="512" height="512" rx="96" fill="#0f172a"/>
                <rect x="6" y="6" width="500" height="500" rx="90" fill="none" stroke="url(#chatAccent)" strokeWidth="2" opacity="0.15"/>
                <ellipse cx="256" cy="220" rx="160" ry="140" fill="url(#chatAccent)" opacity="0.08"/>
                <g transform="translate(256,248)">
                  <path d="M-50-100 L80-100 L80-48 L-6-48 L-6-10 L64-10 L64 40 L-6 40 L-6 108 L-50 108 Z" fill="url(#chatFg)"/>
                  <path d="M-50-100 L80-100 L80-48 L-6-48 L-6-10 L64-10 L64 40 L-6 40 L-6 108 L-50 108 Z" fill="url(#chatAccent)" opacity="0.25" transform="translate(3,3)"/>
                  <path d="M-50-100 L80-100 L80-48 L-6-48 L-6-10 L64-10" fill="none" stroke="url(#chatAccent)" strokeWidth="3" opacity="0.5" strokeLinecap="round"/>
                </g>
                <rect x="172" y="388" width="168" height="5" rx="2.5" fill="url(#chatBar)"/>
                <rect x="172" y="394" width="168" height="5" rx="2.5" fill="url(#chatBar)" opacity="0.3"/>
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary tracking-tight">FTJM</h1>
              <p className="text-[10px] text-muted leading-tight">Secure messaging</p>
            </div>
          </div>
        </div>

        {/* Conversation list */}
        {activeTab === 'dm' && (
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center mb-3 border border-border/50">
                  <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-sm text-muted font-medium">No conversations</p>
                <p className="text-xs text-muted mt-1">Start a new chat to begin</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {conversations.map((conv) => {
                  const preview = getConversationPreview(conv)
                  const isSelected = selectedConvId === conv.id
                  const isGroup = conv.is_group
                  return (
                    <div key={conv.id} className="relative">
                      {isSelected && (
                        <motion.div
                          layoutId="sidebarIndicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-gradient-accent"
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        />
                      )}
                    <button
                      onClick={() => { setSelectedConvId(conv.id); setActiveTab('dm') }}
                      className={`sidebar-item ${isSelected ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}
                    >
                      <div className="relative shrink-0">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden ${
                          isGroup
                            ? 'bg-gradient-to-br from-amber-400 to-orange-400 text-white'
                            : isSelected
                              ? 'bg-gradient-accent text-white shadow-sm'
                              : 'bg-surface-hover text-secondary'
                        }`}>
                          {isGroup ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          ) : preview.photo_url ? (
                            <img src={preview.photo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            getAvatarInitials(preview.display_name)
                          )}
                        </div>
                        {!conv.is_group && (
                          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${
                            onlineUsers.has(conv.participants.find((id: string) => id !== user?.id) || '')
                              ? 'bg-green-500'
                              : 'bg-gray-400'
                          }`} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : ''}`}>
                          {preview.display_name}
                        </p>
                        <p className="text-[11px] text-muted">
                          {isGroup ? 'Group' : 'Direct message'}
                        </p>
                      </div>
                    </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Bottom user area */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-muted">
            <div className="h-8 w-8 rounded-full bg-gradient-accent flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {user?.photo_url ? (
                <img src={user.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                getAvatarInitials(user?.display_name || 'U')
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-primary truncate">{user?.display_name}</p>
              <p className="text-[10px] text-muted">Online</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className="h-7 w-7 rounded-lg hover:bg-surface-hover flex items-center justify-center transition-all"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <svg className="w-3.5 h-3.5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className="h-7 w-7 rounded-lg hover:bg-surface-hover flex items-center justify-center transition-all"
                aria-label="Settings"
              >
                <svg className="w-3.5 h-3.5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
              </button>
              <button
                onClick={lockApp}
                className="h-7 w-7 rounded-lg hover:bg-surface-hover flex items-center justify-center transition-all"
                aria-label="Lock"
              >
                <svg className="w-3.5 h-3.5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </button>
              <button
                onClick={logout}
                className="h-7 w-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center transition-all"
                aria-label="Logout"
              >
                <svg className="w-3.5 h-3.5 text-secondary hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="bg-surface-glass backdrop-blur-sm border-b border-border px-4 py-2.5 flex items-center gap-4 shrink-0 min-h-[57px]">
          {/* Nav tabs */}
          <div className="flex gap-1 bg-surface-muted rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => { setActiveTab('general'); setSelectedConvId(null) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'general' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('dm')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'dm' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
              }`}
            >
              Messages
            </button>
            <button
              onClick={() => { setActiveTab('feed'); setSelectedConvId(null) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
                activeTab === 'feed' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Feed
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
                  activeTab === 'settings' || activeTab === 'games' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
                More
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute top-full left-0 mt-1 w-36 bg-surface border border-border rounded-lg shadow-lg z-50 py-1">
                    <button
                      onClick={() => { setActiveTab('settings'); setShowMoreMenu(false) }}
                      className={`w-full px-3 py-2 text-xs font-medium text-left flex items-center gap-2 transition-all ${
                        activeTab === 'settings' ? 'bg-surface-muted text-primary' : 'text-secondary hover:text-primary hover:bg-surface-muted'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      </svg>
                      Settings
                    </button>
                    <button
                      onClick={() => { setActiveTab('games'); setSelectedConvId(null); setShowMoreMenu(false) }}
                      className={`w-full px-3 py-2 text-xs font-medium text-left flex items-center gap-2 transition-all ${
                        activeTab === 'games' ? 'bg-surface-muted text-primary' : 'text-secondary hover:text-primary hover:bg-surface-muted'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Games
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

        {activeTab !== 'settings' && activeTab !== 'games' && activeTab !== 'feed' && (
            <>
          <div className="w-px h-6 bg-border shrink-0" />

          <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
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
                  <p className="text-xs text-secondary">
                    {selectedConversation.is_group
                      ? (selectedConversation.title || 'Group')
                      : 'Direct message'}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-primary font-medium truncate">
                      {(Array.isArray(selectedConversation.participant_names) ? selectedConversation.participant_names : [])
                        .filter((name, idx) => (Array.isArray(selectedConversation.participants) ? selectedConversation.participants : [])[idx] !== user?.id)
                        .join(', ')}
                    </p>
                    {!selectedConversation.is_group && (
                      <span className={`h-2 w-2 rounded-full ${
                        onlineUsers.has(
                          (Array.isArray(selectedConversation.participants) ? selectedConversation.participants : [])
                            .find((id: string) => id !== user?.id) || ''
                        ) ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                    )}
                  </div>
                </div>
              </div>
              {!selectedConversation.is_group && (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleStartCall(false)}
                    className="h-8 w-8 rounded-xl bg-surface-muted hover:bg-surface-hover flex items-center justify-center transition-all active:scale-90"
                    title="Voice call">
                    <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </button>
                  <button onClick={() => handleStartCall(true)}
                    className="h-8 w-8 rounded-xl bg-surface-muted hover:bg-surface-hover flex items-center justify-center transition-all active:scale-90"
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
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-400 flex items-center justify-center shrink-0 shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-secondary">Public channel</p>
                  <p className="text-sm text-primary font-medium">General Chat</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => getPosts().then(setGeneralChat).catch(console.error)}
                  className="h-8 w-8 rounded-xl bg-surface-muted hover:bg-surface-hover flex items-center justify-center transition-all active:scale-90"
                  title="Refresh">
                  <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </>
          )}
          </div>
            </>
          )}
        </div>

        {/* Feed - standalone */}
        {activeTab === 'feed' && (
          <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
            {feedMedia.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center justify-center text-center py-20"
              >
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-400/10 to-pink-400/10 flex items-center justify-center mb-4 border border-border/50">
                  <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <p className="text-muted text-lg font-medium">No media yet</p>
                <p className="text-muted text-sm mt-1">Follow people to see their uploads here</p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {feedMedia.map((media, index) => {
                  const author = profilesCache[media.user_id]
                  const authorName = author?.display_name || 'User'
                  const likes: string[] = (media.likes || []) as string[]
                  const comments: any[] = (media.comments || []) as any[]
                  const isLiked = likes.includes(user?.id || '')
                  const isExpanded = expandedComments.has(media.id)
                  return (
                    <motion.div
                      key={media.id}
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
                      className="bg-surface border border-border rounded-2xl overflow-hidden"
                    >
                      {/* Image */}
                      <div className="relative aspect-square bg-black/5">
                        <img src={media.media_url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute top-3 left-3 flex items-center gap-2">
                          <button onClick={() => openProfile(media.user_id, authorName, author?.photo_url)}
                            className="h-7 w-7 rounded-full overflow-hidden bg-black/30 flex items-center justify-center text-[9px] font-bold text-white shrink-0 backdrop-blur-sm">
                            {author?.photo_url ? (
                              <img src={author.photo_url} alt={authorName} className="h-full w-full object-cover" />
                            ) : authorName.charAt(0).toUpperCase()}
                          </button>
                          <span className="text-xs font-semibold text-white drop-shadow-sm">{authorName}</span>
                        </div>
                        <span className="absolute top-3 right-3 text-[9px] px-2 py-0.5 rounded-full bg-black/30 text-white/80 backdrop-blur-sm uppercase font-medium">
                          {media.media_type}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="px-3 py-2 flex items-center gap-3 border-b border-border/50">
                        <button
                          onClick={() => {
                            if (isLiked) {
                              unlikeMedia(media.id, user!.id)
                              setFeedMedia((prev) => prev.map((m) => m.id === media.id ? { ...m, likes: likes.filter((id) => id !== user!.id) } : m))
                            } else {
                              likeMedia(media.id, user!.id)
                              setFeedMedia((prev) => prev.map((m) => m.id === media.id ? { ...m, likes: [...likes, user!.id] } : m))
                            }
                          }}
                          className={`flex items-center gap-1 text-xs font-medium transition-all ${
                            isLiked ? 'text-red-500' : 'text-secondary hover:text-red-400'
                          }`}
                        >
                          <svg className="w-4 h-4" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          {likes.length}
                        </button>
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedComments((prev) => { const next = new Set(prev); next.delete(media.id); return next })
                            } else {
                              setExpandedComments((prev) => { const next = new Set(prev); next.add(media.id); return next })
                            }
                          }}
                          className={`flex items-center gap-1 text-xs font-medium transition-all ${
                            isExpanded ? 'text-accent' : 'text-secondary hover:text-accent'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {comments.length}
                        </button>
                        <span className="text-[10px] text-muted ml-auto">{new Date(media.created_at).toLocaleDateString()}</span>
                      </div>

                      {/* Comments */}
                      {isExpanded && (
                        <div className="px-3 py-2 space-y-2 max-h-48 overflow-y-auto">
                          {comments.length === 0 ? (
                            <p className="text-xs text-muted text-center py-2">No comments yet</p>
                          ) : (
                            comments.map((c: any) => (
                              <div key={c.id} className="flex gap-2 items-start">
                                <button onClick={() => openProfile(c.user_id, c.name, c.photo)}
                                  className="h-6 w-6 rounded-full overflow-hidden bg-surface-hover flex items-center justify-center text-[7px] font-bold text-secondary shrink-0 mt-0.5">
                                  {c.photo ? (
                                    <img src={c.photo} alt={c.name} className="h-full w-full object-cover" />
                                  ) : c.name.charAt(0).toUpperCase()}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-primary truncate">{c.name}</span>
                                    <span className="text-[9px] text-muted shrink-0">{new Date(c.created_at).toLocaleDateString()}</span>
                                    {(c.user_id === user?.id) && (
                                      <button onClick={() => {
                                        deleteComment(media.id, c.id)
                                        setFeedMedia((prev) => prev.map((m) => m.id === media.id ? { ...m, comments: comments.filter((cc: any) => cc.id !== c.id) } : m))
                                      }} className="ml-auto text-muted hover:text-red-400 transition-colors shrink-0">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-xs text-secondary leading-relaxed">{c.text}</p>
                                </div>
                              </div>
                            ))
                          )}
                          <div className="flex gap-2 pt-1">
                            <input
                              type="text"
                              placeholder="Write a comment..."
                              value={commentInputs[media.id] || ''}
                              onChange={(e) => setCommentInputs((prev) => ({ ...prev, [media.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (commentInputs[media.id] || '').trim()) {
                                  const text = commentInputs[media.id].trim()
                                  addComment(media.id, user!.id, user?.display_name || 'User', text, user?.photo_url || undefined)
                                  const newComment = {
                                    id: crypto.randomUUID(),
                                    user_id: user!.id,
                                    name: user?.display_name || 'User',
                                    photo: user?.photo_url || null,
                                    text,
                                    created_at: new Date().toISOString(),
                                  }
                                  setFeedMedia((prev) => prev.map((m) => m.id === media.id ? { ...m, comments: [...comments, newComment] } : m))
                                  setCommentInputs((prev) => ({ ...prev, [media.id]: '' }))
                                }
                              }}
                              className="flex-1 text-xs bg-surface-muted rounded-lg px-2.5 py-1.5 border border-border focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
                            />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Messages (hidden for feed) */}
        {activeTab !== 'feed' && (
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 min-h-0">
          {activeTab === 'games' ? (
            <GamesArcade />
          ) : activeTab === 'settings' ? (
            <SettingsContent userId={user?.id || ''} />
          ) : activeTab === 'dm' ? (
            selectedConvId ? (
              <>
                {messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center justify-center h-full text-center py-16"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center mb-4 border border-border/50">
                      <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-muted text-lg font-medium">No messages yet</p>
                    <p className="text-muted text-sm mt-1">Send the first message!</p>
                  </motion.div>
                )}
                {[...messages].filter((m) => !isCallSignal(m.text)).reverse().map((msg, index) => {
                  const isMine = msg.sender_id === user?.id
                  const participant = getParticipantInfo(msg.sender_id)
                  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  const isEditing = editingId?.type === 'dm' && editingId.id === msg.id
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
                      className={`flex gap-3 items-end ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
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
                    </motion.div>
                  )
                })}
                {typingUsers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center gap-2 text-muted text-sm"
                  >
                    <div className="flex gap-1">
                      {[0, 0.15, 0.3].map((delay) => (
                        <motion.span
                          key={delay}
                          className="w-1.5 h-1.5 rounded-full bg-accent/60"
                          animate={{ y: [0, -6, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay, ease: 'easeInOut' }}
                        />
                      ))}
                    </div>
                    {typingUsers.map((id) => getParticipantInfo(id).display_name).join(', ')} typing...
                  </motion.div>
                )}
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center justify-center h-full"
              >
                <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center mb-5 border border-border/50">
                  <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-muted text-lg font-medium">Select a conversation</p>
                <p className="text-muted text-sm mt-1">Choose a chat from the sidebar</p>
              </motion.div>
            )
          ) : activeTab === 'general' ? (
            <div className="space-y-4">
              {generalChat.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center justify-center h-full text-center py-20"
                >
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center mb-4 border border-border/50">
                    <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                  </div>
                  <p className="text-muted text-lg font-medium">No messages yet</p>
                  <p className="text-muted text-sm mt-1">Be the first to post in general chat</p>
                </motion.div>
              ) : (
                generalChat.map((post, index) => {
                  const isMine = post.author_id === user?.id
                  const authorInfo = getParticipantInfo(post.author_id)
                  const authorName = isMine ? 'You' : authorInfo.display_name
                  const isEditing = editingId?.type === 'general' && editingId.id === post.id
                  return (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
                      className="chat-bubble-other !rounded-3xl p-5">
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
                            <div className="flex gap-1.5">
                              <button onClick={() => setReplyingTo(post)}
                                className="p-1 text-muted hover:text-accent transition-colors"
                                title="Reply">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                              </button>
                              {isMine && (
                                <>
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
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {post.parent_id && (() => {
                        const parentPost = generalChat.find((p) => p.id === post.parent_id)
                        if (!parentPost) return null
                        const parentAuthor = getParticipantInfo(parentPost.author_id)
                        const parentName = parentPost.author_id === user?.id ? 'You' : parentAuthor.display_name
                        return (
                          <div className="mb-2 pl-3 border-l-2 border-accent/40 bg-surface-muted/50 rounded-r-lg py-1.5 px-3">
                            <p className="text-[11px] font-semibold text-accent mb-0.5">
                              Reageren op {parentName}
                            </p>
                            <p className="text-xs text-muted line-clamp-2">
                              {maybeDecryptText(parentPost.content)}
                            </p>
                          </div>
                        )
                      })()}
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
                    </motion.div>
                  )
                })
              )}
            </div>
          ) : null}
        </div>
        )}

        {/* Input */}
        {activeTab !== 'settings' && activeTab !== 'games' && activeTab !== 'feed' && (
        <div className="bg-surface-glass backdrop-blur-sm border-t border-border px-6 py-4">
          <AnimatePresence>
            {replyingTo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 mb-3 max-w-3xl mx-auto pl-1"
              >
                <div className="flex-1 flex items-center gap-3 bg-accent/5 rounded-xl px-3 py-2 border border-accent/10">
                  <div className="h-7 w-0.5 rounded-full bg-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-accent">
                      Reageren op {replyingTo.author_id === user?.id ? 'jezelf' : getParticipantInfo(replyingTo.author_id).display_name}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {maybeDecryptText(replyingTo.content)}
                    </p>
                  </div>
                  <button onClick={() => setReplyingTo(null)}
                    className="p-1 rounded-lg hover:bg-surface-muted text-muted hover:text-primary transition-all shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3 max-w-3xl mx-auto">
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
        )}
      </main>

      {/* Profile modal */}
      {profilePreview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/20 dark:bg-black/40 backdrop-blur-sm" onClick={closeProfile}>
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm bg-surface rounded-3xl shadow-xl shadow-black/10 dark:shadow-black/50 border border-border overflow-hidden max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Banner */}
            {profilePreview.banner_url ? (
              <div className="h-36 bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${profilePreview.banner_url})` }} />
            ) : (
              <div className="h-36 bg-gradient-accent shrink-0" />
            )}

            {/* Close button */}
            <button onClick={closeProfile} className="absolute top-3 right-3 rounded-xl bg-black/20 p-2 text-white hover:bg-black/40 transition-all z-10">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <div className="px-7 pb-4 -mt-12 shrink-0">
              <div className="flex items-end gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden bg-gradient-accent flex items-center justify-center text-3xl font-bold text-white shadow-lg ring-4 ring-surface shrink-0">
                  {profilePreview.photo_url ? (
                    <img src={profilePreview.photo_url} alt={profilePreview.display_name} className="h-full w-full object-cover" />
                  ) : getAvatarInitials(profilePreview.display_name)}
                </div>
                <div className="pb-1 flex-1 min-w-0">
                  <p className="text-lg font-bold text-primary truncate">{profilePreview.display_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      profilePreview.isCurrentUser ? 'bg-accent/10 text-accent' : 'bg-surface-muted text-secondary'
                    }`}>
                      {profilePreview.isCurrentUser ? 'You' : 'User'}
                    </span>
                  </div>
                </div>
                {!profilePreview.isCurrentUser && user?.id && (
                  <button
                    onClick={handleFollowToggle}
                    className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                      isFollowingUser
                        ? 'bg-surface-muted text-secondary hover:bg-red-500/10 hover:text-red-400'
                        : 'bg-accent text-accent-content hover:bg-accent-hover'
                    }`}
                  >
                    {isFollowingUser ? 'Volgend' : 'Volgen'}
                  </button>
                )}
              </div>

              {/* Follower/following counts */}
              <div className="flex gap-4 mt-3 text-xs">
                <span className="text-secondary"><strong className="text-primary">{followerCount}</strong> volgers</span>
                <span className="text-secondary"><strong className="text-primary">{followingCount}</strong> gevolgd</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-7 shrink-0">
              <div className="flex gap-1 border-t border-subtle">
                <button
                  onClick={() => setProfilePreviewTab('info')}
                  className={`flex-1 py-2.5 text-xs font-medium transition-all border-b-2 ${
                    profilePreviewTab === 'info'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-muted hover:text-secondary'
                  }`}
                >
                  Info
                </button>
                <button
                  onClick={() => setProfilePreviewTab('media')}
                  className={`flex-1 py-2.5 text-xs font-medium transition-all border-b-2 ${
                    profilePreviewTab === 'media'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-muted hover:text-secondary'
                  }`}
                >
                  Media ({profileMedia.length})
                </button>
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-7 py-4 min-h-0">
              {profilePreviewTab === 'info' ? (
                <div>
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
              ) : (
                <div>
                  {/* Upload button (own profile only) */}
                  {profilePreview.isCurrentUser && (
                    <div className="mb-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.gif"
                        onChange={handleUploadMedia}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full py-2.5 rounded-xl border-2 border-dashed border-border hover:border-accent/50 text-secondary hover:text-accent text-xs font-medium transition-all flex items-center justify-center gap-2"
                      >
                        {uploading ? (
                          <>
                            <motion.div
                              className="h-4 w-4 border-2 border-accent/30 border-t-accent rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Upload photo/GIF
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Media grid */}
                  {profileMedia.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted text-sm">No media uploaded yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {profileMedia.map((media) => (
                        <div key={media.id} className="relative group rounded-xl overflow-hidden bg-black/5 aspect-square">
                          <img src={media.media_url} alt="" className="w-full h-full object-cover" />
                          {profilePreview.isCurrentUser && (
                            <button
                              onClick={() => handleDeleteMedia(media.id)}
                              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                            >
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          <span className="absolute bottom-2 left-2 text-[9px] px-1.5 py-0.5 rounded-full bg-black/50 text-white/80 uppercase font-medium">
                            {media.media_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
