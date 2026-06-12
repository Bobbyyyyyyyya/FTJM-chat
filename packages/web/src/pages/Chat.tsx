import { useEffect, useState } from 'react'
import { useAuthStore } from '@/hooks/useAuth'
import {
  getConversations,
  getConversation,
  sendMessage,
  createConversation,
  setTypingStatus,
  getTypingStatus,
  getPosts,
  createPost,
  subscribeToMessages,
  subscribeToTypingStatus,
  subscribeToGeneralChat,
  getProfile,
  type Conversation,
  type Message,
  type Post,
} from '@/lib/db'
import { encryptText, maybeDecryptText } from '@/lib/crypto'

export default function ChatPage() {
  const { user, logout } = useAuthStore()

  // State for conversations (DMs)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  // State for general chat (Posts)
  const [generalChat, setGeneralChat] = useState<Post[]>([])
  const [activeTab, setActiveTab] = useState<'dm' | 'general'>('dm')

  // Message input
  const [messageInput, setMessageInput] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [selectedConversationProfiles, setSelectedConversationProfiles] = useState<Record<string, any>>({})
  const [profilePreview, setProfilePreview] = useState<{
    id: string
    display_name: string
    photo_url?: string
    bio?: string
    isCurrentUser: boolean
  } | null>(null)
  const [profilesCache, setProfilesCache] = useState<Record<string, any>>({})

  // Load conversations on mount
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

  // Load general chat posts on mount
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

    // Subscribe to real-time updates
    const subscription = subscribeToGeneralChat((payload) => {
      if (payload.type === 'INSERT' && payload.new) {
        setGeneralChat((prev) => [payload.new!, ...prev])
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

  // Load messages for selected conversation
  useEffect(() => {
    console.log('[Chat] message useEffect start', {
      selectedConvId,
      userId: user?.id,
    })
    if (!selectedConvId || !user?.id) {
      console.log('[Chat] message useEffect skipped', {
        selectedConvId,
        userId: user?.id,
      })
      return
    }

    let subscription: any = null
    let typingSub: any = null
    let isActive = true

    const loadMessages = async () => {
      try {
        const { conversation, messages: msgs } = await getConversation(selectedConvId)
        if (!isActive) return

        setSelectedConversation(conversation)
        setMessages(msgs)

        // Pre-fetch participant profiles for accurate names/photos
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

        // Subscribe to new messages and updates
        console.log('[Chat] subscribeToMessages called', {
          selectedConvId,
          userId: user?.id,
        })
        subscription = subscribeToMessages(selectedConvId, (payload) => {
          console.debug('[Chat] realtime message event', {
            selectedConvId,
            type: payload.type,
            messageId: payload.new?.id ?? payload.old?.id,
            hasNew: Boolean(payload.new),
            hasOld: Boolean(payload.old),
          })

          if (payload.type === 'INSERT' && payload.new) {
            setMessages((prev) => [...prev, payload.new!])
          } else if (payload.type === 'UPDATE' && payload.new) {
            setMessages((prev) => prev.map((m) => (m.id === payload.new!.id ? payload.new! : m)))
          } else if (payload.type === 'DELETE' && payload.old) {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old!.id))
          }
        })

        // Subscribe to typing status
        typingSub = subscribeToTypingStatus(selectedConvId, (users) => {
          setTypingUsers(
            users
              .filter((t) => t.user_id !== user.id)
              .map((t) => t.user_id)
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

  // Handle sending message
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

  // Handle sending post to general chat
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

  // Handle typing indicator
  const handleTyping = async (typing: boolean) => {
    if (!selectedConvId || !user?.id) return
    setIsTyping(typing)
    try {
      await setTypingStatus(selectedConvId, user.id, typing)
    } catch (error) {
      console.error('Error updating typing status:', error)
    }
  }

  const getAvatarInitials = (value: string) => {
    const words = value.split(' ').filter(Boolean)
    if (words.length === 0) return 'U'
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
    return `${words[0][0]}${words[1][0]}`.toUpperCase()
  }

  const getParticipantInfo = (userId: string) => {
    // Prefer cached profile if available
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

    const index = selectedConversation.participants.findIndex((id) => id === userId)
    const display_name =
      selectedConversation.participant_names[index] ||
      (userId === user?.id ? 'You' : `User ${userId.slice(0, 6)}`)
    const photo_url = selectedConversation.participant_photos[index]

    return { display_name, photo_url }
  }

  const openProfile = (userId: string, displayName?: string, photoUrl?: string) => {
    const setFromProfile = (p: any) =>
      setProfilePreview({
        id: userId,
        display_name: p?.display_name || displayName || getParticipantInfo(userId).display_name,
        photo_url: p?.photo_url || photoUrl || getParticipantInfo(userId).photo_url,
        bio: p?.bio,
        isCurrentUser: userId === user?.id,
      })

    // If we already have cached profile, use it
    const cached = profilesCache[userId]
    if (cached) return setFromProfile(cached)

    // If displayName/photoUrl provided, show provisional and fetch full profile in background
    if (displayName || photoUrl) {
      setProfilePreview({
        id: userId,
        display_name: displayName || getParticipantInfo(userId).display_name,
        photo_url: photoUrl || getParticipantInfo(userId).photo_url,
        bio: undefined,
        isCurrentUser: userId === user?.id,
      })
    }

    // Fetch profile from backend and cache
    getProfile(userId).then((p) => {
      if (p) {
        setProfilesCache((prev) => ({ ...prev, [userId]: p }))
        setFromProfile(p)
      }
    })
  }

  const closeProfile = () => setProfilePreview(null)

  const getConversationPreview = (conv: Conversation) => {
    const otherIndex = conv.participants.findIndex((id) => id !== user?.id)
    const display_name = conv.participant_names[otherIndex] || conv.participant_names[0] || 'Conversation'
    const photo_url = conv.participant_photos[otherIndex]
    return { display_name, photo_url }
  }

  return (
    <div className="h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">FTJM Chat</h1>
        <div className="flex items-center gap-4">
          <span className="text-slate-300">{user?.display_name}</span>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - DM List */}
        <div className="w-72 bg-slate-800 border-r border-slate-700 p-4 flex flex-col">
          <h2 className="text-xl font-semibold text-white mb-4">💬 Conversations</h2>
          <div className="flex-1 space-y-3 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-slate-400 text-sm">No conversations yet</p>
            ) : (
              conversations.map((conv) => {
                const preview = getConversationPreview(conv)
                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setSelectedConvId(conv.id)
                      setActiveTab('dm')
                    }}
                    className={`w-full text-left rounded-2xl p-3 transition-colors border border-slate-700 ${
                      selectedConvId === conv.id
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center text-sm font-semibold text-white">
                        {preview.photo_url ? (
                          <img src={preview.photo_url} alt={preview.display_name} className="h-full w-full object-cover" />
                        ) : (
                          getAvatarInitials(preview.display_name)
                        )}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">{preview.display_name}</p>
                        <p className="text-xs text-slate-400">{conv.is_group ? 'Group chat' : 'Direct message'}</p>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          {/* Tab switcher */}
          <div className="bg-slate-800 border-b border-slate-700 flex">
            <button
              onClick={() => setActiveTab('dm')}
              className={`flex-1 py-3 font-semibold transition-colors ${
                activeTab === 'dm'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              💬 Messages
            </button>
            <button
              onClick={() => {
                setActiveTab('general')
                setSelectedConvId(null)
              }}
              className={`flex-1 py-3 font-semibold transition-colors ${
                activeTab === 'general'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📢 General
            </button>
          </div>
          <div className="bg-slate-950/80 border-b border-slate-700 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">
                {activeTab === 'dm'
                  ? selectedConversation
                    ? `Conversation with ${selectedConversation.participant_names
                        .filter((name, idx) => selectedConversation.participants[idx] !== user?.id)
                        .join(', ')}`
                    : 'Select a conversation to start messaging'
                  : 'General chat — everyone can see this room.'}
              </p>
            </div>
            {activeTab === 'general' && (
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Live room</span>
            )}
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeTab === 'dm' ? (
              selectedConvId ? (
                <>
                  {messages.map((msg) => {
                    const isMine = msg.sender_id === user?.id
                    const participant = getParticipantInfo(msg.sender_id)

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${
                          isMine ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {!isMine && (
                          <button
                            type="button"
                            onClick={() => openProfile(msg.sender_id, participant.display_name, participant.photo_url)}
                            className="h-12 w-12 rounded-full overflow-hidden bg-slate-700 ring-2 ring-slate-700 hover:ring-blue-400 transition-all"
                          >
                            {participant.photo_url ? (
                              <img
                                src={participant.photo_url}
                                alt={participant.display_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                                {getAvatarInitials(participant.display_name)}
                              </span>
                            )}
                          </button>
                        )}
                        <div className={`max-w-xl rounded-3xl p-4 shadow-sm ${
                            isMine
                              ? 'bg-blue-600 text-white shadow-blue-500/20'
                              : 'bg-slate-700 text-slate-100 shadow-black/10'
                          }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                              {isMine ? 'You' : participant.display_name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="whitespace-pre-line break-words text-sm">
                            {maybeDecryptText(msg.text, msg.is_encrypted)}
                          </p>
                        </div>
                        {isMine && (
                          <button
                            type="button"
                            onClick={() => openProfile(msg.sender_id, user?.display_name ?? undefined, user?.photo_url ?? undefined)}
                            className="h-12 w-12 rounded-full overflow-hidden bg-slate-700 ring-2 ring-slate-700 hover:ring-blue-400 transition-all"
                          >
                            {user?.photo_url ? (
                              <img
                                src={user.photo_url}
                                alt={user.display_name ?? ''}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                                {getAvatarInitials(user?.display_name || 'You')}
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {typingUsers.length > 0 && (
                    <div className="text-slate-400 text-sm italic">
                      {typingUsers
                        .map((id) => getParticipantInfo(id).display_name)
                        .join(', ')}{' '}
                      is typing...
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400">Select a conversation</p>
                </div>
              )
            ) : (
              <div className="space-y-4">
                {generalChat.map((post) => {
                  const isMine = post.author_id === user?.id
                  const authorName = isMine ? 'You' : `User ${post.author_id.slice(0, 6)}`

                  return (
                    <div key={post.id} className="bg-slate-800 rounded-3xl p-4 shadow-sm shadow-black/20">
                      <div className="flex items-center gap-3 mb-3">
                        <button
                          type="button"
                          onClick={() => openProfile(post.author_id, authorName)}
                          className="h-11 w-11 rounded-full overflow-hidden bg-slate-700 ring-2 ring-slate-700 hover:ring-blue-400 transition-all"
                        >
                          <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                            {getAvatarInitials(authorName)}
                          </span>
                        </button>
                        <div>
                          <p className="text-sm font-semibold text-white">{authorName}</p>
                          <p className="text-xs text-slate-400">{new Date(post.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <p className="text-slate-200 whitespace-pre-line break-words text-sm">
                        {maybeDecryptText(post.content)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-slate-700 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={
                  activeTab === 'dm'
                    ? 'Type a message...'
                    : 'Share in general chat...'
                }
                value={messageInput}
                onChange={(e) => {
                  setMessageInput(e.target.value)
                  if (activeTab === 'dm') {
                    handleTyping(e.target.value.length > 0)
                  }
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    activeTab === 'dm'
                      ? handleSendMessage()
                      : handleSendPost()
                  }
                }}
                className="flex-1 bg-slate-700 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={activeTab === 'dm' && !selectedConvId}
              />
              <button
                onClick={
                  activeTab === 'dm'
                    ? handleSendMessage
                    : handleSendPost
                }
                disabled={activeTab === 'dm' && !selectedConvId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
      {profilePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center text-2xl font-bold text-white">
                  {profilePreview.photo_url ? (
                    <img
                      src={profilePreview.photo_url}
                      alt={profilePreview.display_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getAvatarInitials(profilePreview.display_name)
                  )}
                </div>
                <div>
                  <p className="text-xl font-semibold text-white">{profilePreview.display_name}</p>
                  <p className="text-sm text-slate-400">
                    {profilePreview.isCurrentUser ? 'Your profile' : 'User profile'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeProfile}
                className="rounded-full bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="mt-5 space-y-3 text-sm text-slate-300">
              <p>{profilePreview.bio || 'No profile bio available.'}</p>
              {!profilePreview.isCurrentUser && (
                <p className="text-slate-500">This profile is private and only limited info is available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
