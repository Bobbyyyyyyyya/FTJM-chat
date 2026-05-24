import { useAuthStore } from '@/hooks/useAuth'

export default function ChatPage() {
  const { user, logout } = useAuthStore()

  return (
    <div className="h-screen bg-slate-900 flex flex-col">
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
        {/* Sidebar */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 p-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white mb-4">Conversations</h2>
            <p className="text-slate-400">No conversations yet</p>
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400">Select a conversation to start chatting</p>
            </div>
          </div>

          <div className="border-t border-slate-700 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                className="flex-1 bg-slate-700 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
