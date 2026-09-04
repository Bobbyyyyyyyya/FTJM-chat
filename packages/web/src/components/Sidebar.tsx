import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { ChatTab } from '@/lib/types'
import type { Conversation } from '@/lib/db'
import VerifiedBadge from '@/components/VerifiedBadge'
import CachedImg from '@/components/CachedImg'

interface SidebarProps {
  user: any
  theme: string
  activeTab: ChatTab
  setActiveTab: (tab: ChatTab) => void
  setSelectedConvId: (id: string | null) => void
  conversations: Conversation[]
  hiddenConversations: Set<string>
  showHidden: boolean
  setShowHidden: (v: boolean) => void
  selectedConvId: string | null
  getConversationPreview: (conv: Conversation) => { display_name: string; photo_url?: string; isGroup: boolean; is_verified?: boolean }
  getAvatarInitials: (name: string) => string
  onlineUsers: Set<string>
  toggleTheme: () => void
  lockApp: () => void
  logout: () => void
  profilesCache: Record<string, any>
}

function NavIcon({
  active,
  onClick,
  tooltip,
  children,
  badge,
  animation,
}: {
  active: boolean
  onClick: () => void
  tooltip: string
  children: React.ReactNode
  badge?: number
  animation?: string
}) {
  const [hovered, setHovered] = useState(false)
  const [animClass, setAnimClass] = useState('')

  const handleClick = () => {
    if (animation) {
      setAnimClass('')
      requestAnimationFrame(() => setAnimClass(animation))
    }
    onClick()
  }

  return (
    <div className="relative flex justify-center">
      {active && (
        <motion.div
          layoutId="navIndicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-white"
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      <button
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`relative w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-200 ${
          active
            ? 'bg-accent/20 text-accent'
            : 'text-secondary hover:text-primary hover:bg-surface-hover'
        }`}
      >
        <span className={animClass} onAnimationEnd={() => setAnimClass('')}>
          {children}
        </span>
        {badge != null && badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full bg-accent text-[9px] font-bold text-white">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-surface border border-border shadow-lg text-xs font-medium text-primary whitespace-nowrap z-50 pointer-events-none"
          >
            {tooltip}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Sidebar({
  user,
  theme,
  activeTab,
  setActiveTab,
  setSelectedConvId,
  conversations,
  hiddenConversations,
  showHidden,
  setShowHidden,
  selectedConvId,
  getConversationPreview,
  getAvatarInitials,
  onlineUsers,
  toggleTheme,
  lockApp,
  logout,
  profilesCache,
}: SidebarProps) {
  const [showProfilePopup, setShowProfilePopup] = useState(false)
  const [profileAnim, setProfileAnim] = useState('')
  const [settingsAnim, setSettingsAnim] = useState('')
  const [lockAnim, setLockAnim] = useState('')
  const [themeAnim, setThemeAnim] = useState('')
  const [logoutAnim, setLogoutAnim] = useState('')
  const profileRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showProfilePopup) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileRef.current && !profileRef.current.contains(e.target as Node) &&
        popupRef.current && !popupRef.current.contains(e.target as Node)
      ) {
        setShowProfilePopup(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProfilePopup])

  const visibleConvs = conversations.filter((c) => {
    if (hiddenConversations.has(c.id)) return false
    if (!c.is_group) {
      const otherId = c.participants.find((id: string) => id !== user?.id) || ''
      const otherProfile = profilesCache[otherId]
      if (otherProfile?.is_blocked) return false
    }
    return true
  })
  const hiddenConvs = conversations.filter((c) => {
    if (!hiddenConversations.has(c.id)) return false
    if (!c.is_group) {
      const otherId = c.participants.find((id: string) => id !== user?.id) || ''
      const otherProfile = profilesCache[otherId]
      if (otherProfile?.is_blocked) return false
    }
    return true
  })

  return (
    <aside className="w-[68px] flex flex-col items-center shrink-0 bg-surface border-r border-border py-3 gap-1">
      {/* Logo */}
      <div className="mb-2">
        <div className="h-10 w-10 rounded-2xl bg-[#0f172a] flex items-center justify-center shadow-sm overflow-hidden">
          <svg viewBox="0 0 512 512" className="h-6 w-6">
            <defs>
              <linearGradient id="sbLogoAccent" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2dd4bf"/>
                <stop offset="100%" stopColor="#38bdf8"/>
              </linearGradient>
              <linearGradient id="sbLogoFg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff"/>
                <stop offset="100%" stopColor="#cbd5e1"/>
              </linearGradient>
            </defs>
            <rect width="512" height="512" rx="96" fill="#0f172a"/>
            <rect x="6" y="6" width="500" height="500" rx="90" fill="none" stroke="url(#sbLogoAccent)" strokeWidth="2" opacity="0.15"/>
            <g transform="translate(256,248)">
              <path d="M-50-100 L80-100 L80-48 L-6-48 L-6-10 L64-10 L64 40 L-6 40 L-6 108 L-50 108 Z" fill="url(#sbLogoFg)"/>
              <path d="M-50-100 L80-100 L80-48 L-6-48 L-6-10 L64-10" fill="none" stroke="url(#sbLogoAccent)" strokeWidth="3" opacity="0.5" strokeLinecap="round"/>
            </g>
          </svg>
        </div>
      </div>

      {/* Separator */}
      <div className="w-6 h-0.5 rounded-full bg-border mb-1" />

      {/* Navigation icons */}
      <NavIcon
        active={activeTab === 'general'}
        onClick={() => { setActiveTab('general'); setSelectedConvId(null) }}
        tooltip="General Chat"
        animation="animate-icon-spin"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </NavIcon>

      <NavIcon
        active={activeTab === 'dm'}
        onClick={() => { setActiveTab('dm') }}
        tooltip="Direct Messages"
        animation="animate-icon-pop"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </NavIcon>

      <NavIcon
        active={activeTab === 'feed'}
        onClick={() => { setActiveTab('feed'); setSelectedConvId(null) }}
        tooltip="Feed"
        animation="animate-icon-flip"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      </NavIcon>

      <NavIcon
        active={activeTab === 'games'}
        onClick={() => { setActiveTab('games'); setSelectedConvId(null) }}
        tooltip="Games"
        animation="animate-icon-bounce"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </NavIcon>

      <NavIcon
        active={activeTab === 'settings'}
        onClick={() => { setActiveTab('settings'); setSelectedConvId(null) }}
        tooltip="Settings"
        animation="animate-icon-spin"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </NavIcon>

      {/* Spacer pushes everything below to bottom */}
      <div className="flex-1" />

      {/* Conversation shortcuts (shown when DM tab is active) */}
      {activeTab === 'dm' && visibleConvs.length > 0 && (
        <div className="flex flex-col items-center gap-1 mb-2">
          <div className="w-6 h-0.5 rounded-full bg-border mb-1" />
          {visibleConvs.slice(0, 6).map((conv) => {
            const preview = getConversationPreview(conv)
            const isSelected = selectedConvId === conv.id
            return (
              <button
                key={conv.id}
                onClick={() => { setSelectedConvId(conv.id); setActiveTab('dm') }}
                className="relative group"
              >
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden transition-all duration-200 ${
                    isSelected
                      ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface'
                      : 'hover:ring-2 hover:ring-border hover:ring-offset-2 hover:ring-offset-surface'
                  } ${
                    preview.isGroup
                      ? 'bg-gradient-to-br from-amber-400 to-orange-400 text-white'
                      : 'bg-surface-hover text-secondary'
                  }`}
                >
                  {preview.isGroup ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : preview.photo_url ? (
                    <CachedImg src={preview.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    getAvatarInitials(preview.display_name)
                  )}
                </div>
                {!conv.is_group && (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${
                      onlineUsers.has(conv.participants.find((id: string) => id !== user?.id) || '')
                        ? 'bg-green-500'
                        : 'bg-gray-400'
                    }`}
                  />
                )}
                {/* Tooltip */}
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-surface border border-border shadow-lg text-xs font-medium text-primary whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                  {preview.display_name}
                </div>
              </button>
            )
          })}
          {hiddenConvs.length > 0 && (
            <button
              onClick={() => setShowHidden(!showHidden)}
              className="relative group"
            >
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-hover transition-all">
                <svg className={`w-4 h-4 transition-transform ${showHidden ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-surface border border-border shadow-lg text-xs font-medium text-primary whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                {showHidden ? 'Verberg onzichtbare' : `${hiddenConvs.length} verborgen`}
              </div>
            </button>
          )}
        </div>
      )}

      {/* Online member count */}
      <div className="relative group flex justify-center mb-1">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-[10px] font-semibold text-secondary">{onlineUsers.size}/11</span>
        </div>
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-surface border border-border shadow-lg text-xs font-medium text-primary whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
          {onlineUsers.size} online
        </div>
      </div>

      {/* Separator */}
      <div className="w-6 h-0.5 rounded-full bg-border mb-1" />

      {/* User avatar + actions */}
      <div className="relative" ref={profileRef}>
        <button
          onClick={() => {
            setProfileAnim('')
            requestAnimationFrame(() => setProfileAnim('animate-icon-pop'))
            setShowProfilePopup(!showProfilePopup)
          }}
          className="relative group"
        >
          <div className={`h-10 w-10 rounded-full bg-gradient-accent flex items-center justify-center text-[11px] font-bold text-white overflow-hidden transition-all duration-200 hover:ring-2 hover:ring-accent hover:ring-offset-2 hover:ring-offset-surface ${profileAnim}`} onAnimationEnd={() => setProfileAnim('')}>
            {user?.photo_url ? (
              <CachedImg src={user.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              getAvatarInitials(user?.display_name || 'U')
            )}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-surface bg-green-500" />
        </button>
      </div>

      {/* Profile card popup */}
      <AnimatePresence>
        {showProfilePopup && (
          <motion.div
            ref={popupRef}
            initial={{ opacity: 0, x: -8, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-[76px] bottom-3 w-72 bg-surface border border-border rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Banner / Avatar area */}
            <div className="relative h-20 bg-gradient-to-br from-accent/20 to-accent/5">
              <div className="absolute -bottom-6 left-4">
                <div className="h-14 w-14 rounded-full bg-gradient-accent flex items-center justify-center text-lg font-bold text-white ring-4 ring-surface overflow-hidden">
                  {user?.photo_url ? (
                    <CachedImg src={user.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    getAvatarInitials(user?.display_name || 'U')
                  )}
                </div>
              </div>
            </div>

            <div className="pt-8 px-4 pb-4">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-primary">{user?.display_name}</h3>
                {user?.is_verified && <VerifiedBadge className="w-3.5 h-3.5" />}
              </div>
              <p className="text-[11px] text-muted mt-0.5">{user?.email || 'Online'}</p>

              {/* Quick actions */}
              <div className="flex gap-1.5 mt-3">
                <button
                  onClick={() => { setSettingsAnim('animate-icon-spin'); setTimeout(() => { setActiveTab('settings'); setShowProfilePopup(false) }, 300) }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-muted hover:bg-surface-hover text-secondary hover:text-primary text-[11px] font-medium transition-all ${settingsAnim}`}
                  onAnimationEnd={() => setSettingsAnim('')}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                  Settings
                </button>
                <button
                  onClick={() => { setLockAnim('animate-icon-shake'); setTimeout(() => { lockApp(); setShowProfilePopup(false) }, 300) }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-muted hover:bg-surface-hover text-secondary hover:text-primary text-[11px] font-medium transition-all ${lockAnim}`}
                  onAnimationEnd={() => setLockAnim('')}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Lock
                </button>
              </div>

              <div className="flex gap-1.5 mt-1.5">
                <button
                  onClick={() => { setThemeAnim('animate-icon-spin'); setTimeout(toggleTheme, 200) }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-muted hover:bg-surface-hover text-secondary hover:text-primary text-[11px] font-medium transition-all ${themeAnim}`}
                  onAnimationEnd={() => setThemeAnim('')}
                >
                  {theme === 'light' ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                  {theme === 'light' ? 'Dark' : 'Light'}
                </button>
                <button
                  onClick={() => { setLogoutAnim('animate-icon-wiggle'); setTimeout(() => { logout(); setShowProfilePopup(false) }, 300) }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-muted hover:bg-red-50 dark:hover:bg-red-500/10 text-secondary hover:text-red-500 text-[11px] font-medium transition-all ${logoutAnim}`}
                  onAnimationEnd={() => setLogoutAnim('')}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  )
}
