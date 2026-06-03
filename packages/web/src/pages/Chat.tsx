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
  type Conversation,
  type Message,
  type Post,
} from '@/lib/db'

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
    const subscription = subscribeToGeneralChat((newPost) => {
      setGeneralChat((prev) => [newPost, ...prev])
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConvId || !user?.id) return

    const loadMessages = async () => {
      try {
        const { messages: msgs } = await getConversation(selectedConvId)
        setMessages(msgs)

        // Subscribe to new messages
        const subscription = subscribeToMessages(selectedConvId, (newMsg) => {
          setMessages((prev) => [...prev, newMsg])
        })

        // Subscribe to typing status
        const typingSub = subscribeToTypingStatus(selectedConvId, (users) => {
          setTypingUsers(
            users
              .filter((t) => t.user_id !== user.id)
              .map((t) => t.user_id)
          )
        })

        return () => {
          subscription.unsubscribe()
          typingSub.unsubscribe()
        }
      } catch (error) {
        console.error('Error loading messages:', error)
      }
    }

    return loadMessages()
  }, [selectedConvId, user?.id])

  // Handle sending message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConvId || !user?.id) return

    try {
      await sendMessage(selectedConvId, user.id, messageInput)
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
      await createPost(user.id, '', messageInput)
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
        <div className="w-64 bg-slate-800 border-r border-slate-700 p-4 flex flex-col">
          <h2 className="text-xl font-semibold text-white mb-4">💬 DMs</h2>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-slate-400 text-sm">No conversations yet</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedConvId(conv.id)
                    setActiveTab('dm')
                  }}
                  className={`w-full text-left px-3 py-2 rounded transition-colors ${
                    selectedConvId === conv.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {conv.title || conv.participant_names.join(', ')}
                </button>
              ))
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

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeTab === 'dm' ? (
              selectedConvId ? (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.sender_id === user?.id ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          msg.sender_id === user?.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-100'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {typingUsers.length > 0 && (
                    <div className="text-slate-400 text-sm italic">
                      {typingUsers.length} user(s) typing...
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400">Select a conversation</p>
                </div>
              )
            ) : (
              <>
                {generalChat.map((post) => (
                  <div key={post.id} className="bg-slate-700 rounded-lg p-3">
                    <p className="text-slate-300 text-sm">
                      <strong>{post.title || 'Posted'}</strong>
                    </p>
                    <p className="text-white">{post.content}</p>
                  </div>
                ))}
              </>
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
  )
}
