import { useState, useEffect, useRef, type JSX } from 'react'
import { toast } from 'sonner'
import { updateProfile, getProfile } from '@/lib/db'
import { fileToDataUri, playSound, checkUploadSize } from '@/lib/storage'
import { DEFAULT_RINGTONES, DEFAULT_MESSAGE_TONES, type DefaultSound } from '@/lib/default-sounds'

interface NotificationSettings {
  enable_sounds: boolean
  notify_new_messages: boolean
  notify_mentions: boolean
  notify_new_posts: boolean
  message_sound: string
  post_sound: string
  ringtone_url: string
  sound_library: Record<string, string>
}

interface CustomTheme {
  opacity?: number
  pattern?: string
  wallpaper?: string
  text_color?: string
  blur_amount?: number
  font_family?: string
  accent_color?: string
  chat_opacity?: number
  glass_effect?: boolean
  body_bg_color?: string
  border_radius?: number
  card_bg_color?: string
  primary_color?: string
  header_bg_color?: string
  secondary_color?: string
  sidebar_bg_color?: string
  profile_card_opacity?: number
}

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enable_sounds: true,
  notify_new_messages: true,
  notify_mentions: true,
  notify_new_posts: true,
  message_sound: '',
  post_sound: '',
  ringtone_url: '',
  sound_library: {},
}

const DEFAULT_THEME: CustomTheme = {
  glass_effect: false,
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return ''
  return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
}

export function applyCustomTheme(t: CustomTheme) {
  const root = document.documentElement
  if (t.body_bg_color) root.style.setProperty('--body', hexToRgb(t.body_bg_color))
  if (t.card_bg_color) root.style.setProperty('--surface', hexToRgb(t.card_bg_color))
  if (t.sidebar_bg_color) root.style.setProperty('--surface-muted', hexToRgb(t.sidebar_bg_color))
  if (t.header_bg_color) root.style.setProperty('--surface', hexToRgb(t.header_bg_color))
  if (t.text_color) {
    root.style.setProperty('--text', hexToRgb(t.text_color))
    root.style.setProperty('--text-secondary', hexToRgb(t.text_color))
  }
  if (t.secondary_color) {
    root.style.setProperty('--accent-hover-rgb', hexToRgb(t.secondary_color))
    root.style.setProperty('--accent-to-rgb', hexToRgb(t.secondary_color))
  }
  if (t.accent_color) {
    root.style.setProperty('--border', hexToRgb(t.accent_color))
    root.style.setProperty('--border-subtle', hexToRgb(t.accent_color))
    root.style.setProperty('--accent-ring-rgb', hexToRgb(t.accent_color))
  }
  if (t.primary_color) {
    root.style.setProperty('--accent-rgb', hexToRgb(t.primary_color))
    root.style.setProperty('--accent-from-rgb', hexToRgb(t.primary_color))
  }
  if (t.wallpaper) {
    document.body.style.backgroundImage = `url(${t.wallpaper})`
    document.body.style.backgroundSize = 'cover'
    document.body.style.backgroundAttachment = 'fixed'
    document.body.style.backgroundPosition = 'center'
  } else {
    document.body.style.backgroundImage = ''
  }
  root.style.setProperty('--glass-bg', t.glass_effect ? 'rgba(0,0,0,0.15)' : '')
  root.style.setProperty('--glass-blur', t.glass_effect ? `${t.blur_amount || 2}px` : '')
  if (t.font_family) root.style.fontFamily = t.font_family
  if (t.border_radius) root.style.setProperty('--custom-radius', `${t.border_radius}px`)
  if (t.chat_opacity) root.style.setProperty('--chat-opacity', `${t.chat_opacity / 100}`)
  if (t.profile_card_opacity) root.style.setProperty('--profile-opacity', `${t.profile_card_opacity / 100}`)
}

export function clearCustomTheme() {
  const root = document.documentElement
  const vars = ['--body', '--surface', '--surface-muted', '--text', '--text-secondary', '--text-muted', '--border', '--border-subtle', '--glass-bg', '--glass-blur', '--custom-radius', '--chat-opacity', '--profile-opacity', '--accent-rgb', '--accent-hover-rgb', '--accent-ring-rgb', '--accent-from-rgb', '--accent-to-rgb']
  vars.forEach((v) => root.style.removeProperty(v))
  root.style.fontFamily = ''
  document.body.style.backgroundImage = ''
}

type SettingsTab = 'notifications' | 'sounds' | 'theme' | 'appearance' | 'security'

const NAV_ITEMS: { id: SettingsTab; label: string; icon: JSX.Element }[] = [
  {
    id: 'notifications',
    label: 'Notifications',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
  },
  {
    id: 'sounds',
    label: 'Sounds',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  },
  {
    id: 'theme',
    label: 'Theme',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
      </svg>
    ),
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
  },
  {
    id: 'security',
    label: 'Security',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
]

export default function SettingsContent({ userId, onClose }: { userId: string; onClose?: () => void }) {
  const [tab, setTab] = useState<SettingsTab>('notifications')
  const [notif, setNotif] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS)
  const [useCustomTheme, setUseCustomTheme] = useState(false)
  const [theme, setTheme] = useState<CustomTheme>(DEFAULT_THEME)
  const [saving, setSaving] = useState(false)
  const [desktopNotif, setDesktopNotif] = useState(Notification.permission === 'granted')
  const [lockScreenEnabled, setLockScreenEnabled] = useState(() => localStorage.getItem('ftjm_lock_screen') !== 'disabled')

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      const p = await getProfile(userId)
      if (!p) return
      if (p.notification_settings) {
        setNotif({ ...DEFAULT_NOTIFICATIONS, ...p.notification_settings as any })
      }
      setUseCustomTheme(p.use_custom_theme || false)
      if (p.custom_theme) {
        const merged = { ...DEFAULT_THEME, ...p.custom_theme as any }
        setTheme(merged)
        if (p.use_custom_theme) applyCustomTheme(merged)
      }
      setDesktopNotif(Notification.permission === 'granted')
    }
    load()
  }, [userId])

  const requestDesktopNotif = async () => {
    const result = await Notification.requestPermission()
    setDesktopNotif(result === 'granted')
  }

  const handleSave = async () => {
    if (!userId) return
    setSaving(true)
    try {
      if (useCustomTheme) {
        applyCustomTheme(theme)
      } else {
        clearCustomTheme()
      }
      await updateProfile(userId, {
        notification_settings: notif as any,
        use_custom_theme: useCustomTheme,
        custom_theme: theme as any,
      })
      onClose?.()
    } catch (e) {
      console.error('Error saving settings:', e)
    } finally {
      setSaving(false)
    }
  }

  const setNotifField = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    setNotif((prev) => ({ ...prev, [key]: value }))
  }

  const handleUploadSound = async (key: 'message_sound' | 'post_sound' | 'ringtone_url') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'audio/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const sizeError = checkUploadSize(file)
      if (sizeError) {
        toast.error(sizeError)
        return
      }
      const dataUri = await fileToDataUri(file)
      if (!dataUri) return
      const name = file.name.replace(/\.[^/.]+$/, '') || 'Sound'
      setNotif((prev) => ({
        ...prev,
        [key]: dataUri,
        sound_library: { ...prev.sound_library, [name]: dataUri },
      }))
    }
    input.click()
  }

  const handleAddToLibrary = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'audio/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const sizeError = checkUploadSize(file)
      if (sizeError) {
        toast.error(sizeError)
        return
      }
      const dataUri = await fileToDataUri(file)
      if (!dataUri) return
      const name = file.name.replace(/\.[^/.]+$/, '') || 'Sound'
      setNotif((prev) => ({
        ...prev,
        sound_library: { ...prev.sound_library, [name]: dataUri },
      }))
    }
    input.click()
  }

  const handleDeleteFromLibrary = (name: string) => {
    setNotif((prev) => {
      const dataUri = prev.sound_library[name]
      const { [name]: removed, ...rest } = prev.sound_library
      void removed
      return {
        ...prev,
        sound_library: rest,
        message_sound: prev.message_sound === dataUri ? '' : prev.message_sound,
        post_sound: prev.post_sound === dataUri ? '' : prev.post_sound,
        ringtone_url: prev.ringtone_url === dataUri ? '' : prev.ringtone_url,
      }
    })
  }

  const setThemeField = <K extends keyof CustomTheme>(key: K, value: CustomTheme[K]) => {
    const updated = { ...theme, [key]: value }
    setTheme(updated)
    applyCustomTheme(updated)
  }

  return (
    <div className="flex h-full">
      {/* Sidebar Navigation */}
      <div className="w-56 shrink-0 border-r border-border bg-surface-muted/50 p-3 flex flex-col gap-1">
        <div className="px-3 pt-2 pb-4">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">Settings</h2>
        </div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              tab === item.id
                ? 'bg-accent/10 text-accent'
                : 'text-secondary hover:bg-surface-hover hover:text-primary'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
        <div className="mt-auto pt-3 border-t border-border">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-secondary hover:bg-surface-hover hover:text-primary transition-all w-full"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-6">
          {tab === 'notifications' && (
            <NotificationsPanel
              notif={notif}
              setNotifField={setNotifField}
              desktopNotif={desktopNotif}
              requestDesktopNotif={requestDesktopNotif}
            />
          )}
          {tab === 'sounds' && (
            <SoundsPanel
              notif={notif}
              setNotifField={setNotifField}
              handleUploadSound={handleUploadSound}
              handleAddToLibrary={handleAddToLibrary}
              handleDeleteFromLibrary={handleDeleteFromLibrary}
            />
          )}
          {tab === 'theme' && (
            <ThemePanel
              theme={theme}
              setTheme={setTheme}
              setThemeField={setThemeField}
              useCustomTheme={useCustomTheme}
              setUseCustomTheme={setUseCustomTheme}
            />
          )}
          {tab === 'appearance' && (
            <AppearancePanel theme={theme} setThemeField={setThemeField} />
          )}
          {tab === 'security' && (
            <SecurityPanel lockScreenEnabled={lockScreenEnabled} setLockScreenEnabled={setLockScreenEnabled} />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-56 right-0 flex justify-end gap-3 px-8 py-4 border-t border-border bg-surface/80 backdrop-blur-sm">
        {onClose && (
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-secondary hover:bg-surface-hover transition-all">
            Cancel
          </button>
        )}
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 rounded-xl text-sm font-medium bg-accent text-accent-content hover:bg-accent-hover disabled:opacity-50 transition-all shadow-sm">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// PANELS
// ============================================================================

function NotificationsPanel({ notif, setNotifField, desktopNotif, requestDesktopNotif }: {
  notif: NotificationSettings
  setNotifField: <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => void
  desktopNotif: boolean
  requestDesktopNotif: () => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-primary">Notifications</h3>
        <p className="text-sm text-muted mt-1">Manage how you receive alerts and updates</p>
      </div>

      <Card>
        <CardHeader
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
          }
          title="Desktop Notifications"
        />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-primary">Push notifications</p>
            <p className="text-xs text-muted mt-0.5">Receive alerts outside the app</p>
          </div>
          <Toggle checked={desktopNotif} onChange={requestDesktopNotif} />
        </div>
        {(window as any).electron?.openNotificationSettings && (
          <button onClick={() => (window as any).electron.openNotificationSettings()}
            className="mt-3 w-full py-2 rounded-xl text-xs font-medium bg-surface-muted text-secondary hover:bg-surface-hover transition-all">
            Open macOS Notification Settings
          </button>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          }
          title="In-App Sounds"
        />
        <ToggleRow label="Enable sounds" value={notif.enable_sounds} onChange={(v) => setNotifField('enable_sounds', v)} />
        <ToggleRow label="New messages" value={notif.notify_new_messages} onChange={(v) => setNotifField('notify_new_messages', v)} />
        <ToggleRow label="Mentions" value={notif.notify_mentions} onChange={(v) => setNotifField('notify_mentions', v)} />
        <ToggleRow label="New posts in General" value={notif.notify_new_posts} onChange={(v) => setNotifField('notify_new_posts', v)} />
      </Card>
    </div>
  )
}

function SoundsPanel({ notif, setNotifField, handleUploadSound, handleAddToLibrary, handleDeleteFromLibrary }: {
  notif: NotificationSettings
  setNotifField: <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => void
  handleUploadSound: (key: 'message_sound' | 'post_sound' | 'ringtone_url') => void
  handleAddToLibrary: () => void
  handleDeleteFromLibrary: (name: string) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-primary">Sounds</h3>
        <p className="text-sm text-muted mt-1">Customize your notification tones and ringtones</p>
      </div>

      <Card>
        <CardHeader
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          }
          title="Notification Sounds"
        />
        <div className="space-y-4">
          <SoundPicker
            label="Message sound"
            value={notif.message_sound}
            onChange={(v) => setNotifField('message_sound', v)}
            onUpload={() => handleUploadSound('message_sound')}
            library={Object.entries(notif.sound_library)}
            defaults={DEFAULT_MESSAGE_TONES}
          />
          <SoundPicker
            label="Post sound"
            value={notif.post_sound}
            onChange={(v) => setNotifField('post_sound', v)}
            onUpload={() => handleUploadSound('post_sound')}
            library={Object.entries(notif.sound_library)}
            defaults={DEFAULT_MESSAGE_TONES}
          />
          <SoundPicker
            label="Ringtone"
            value={notif.ringtone_url}
            onChange={(v) => setNotifField('ringtone_url', v)}
            onUpload={() => handleUploadSound('ringtone_url')}
            library={Object.entries(notif.sound_library)}
            defaults={DEFAULT_RINGTONES}
          />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
              </svg>
            }
            title="Sound Library"
          />
          <button onClick={handleAddToLibrary}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-accent-content hover:bg-accent-hover transition-all">
            + Add Sound
          </button>
        </div>
        {Object.keys(notif.sound_library).length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-8 h-8 mx-auto text-muted mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
            </svg>
            <p className="text-sm text-muted">No custom sounds yet</p>
            <p className="text-xs text-muted mt-1">Upload audio files to use as notification sounds</p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(notif.sound_library).map(([name, uri]) => (
              <div key={name} className="flex items-center gap-3 bg-surface-muted rounded-xl px-4 py-3 group">
                <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                </svg>
                <span className="text-sm text-primary flex-1 truncate">{name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => playSound(uri)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-hover text-secondary hover:text-primary transition-all">
                    Preview
                  </button>
                  <button onClick={() => handleDeleteFromLibrary(name)}
                    className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function ThemePanel({ theme, setTheme, setThemeField, useCustomTheme, setUseCustomTheme }: {
  theme: CustomTheme
  setTheme: (t: CustomTheme) => void
  setThemeField: <K extends keyof CustomTheme>(key: K, value: CustomTheme[K]) => void
  useCustomTheme: boolean
  setUseCustomTheme: (v: boolean) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-primary">Theme</h3>
        <p className="text-sm text-muted mt-1">Customize the look and feel of the app</p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Custom theme</p>
            <p className="text-xs text-muted mt-0.5">Enable personalized colors and effects</p>
          </div>
          <Toggle
            checked={useCustomTheme}
            onChange={(v) => {
              setUseCustomTheme(v)
              if (v) applyCustomTheme(theme)
              else clearCustomTheme()
            }}
          />
        </div>
      </Card>

      {useCustomTheme && (
        <>
          <Card>
            <CardHeader
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
                </svg>
              }
              title="Colors"
            />
            <div className="grid grid-cols-2 gap-3">
              <HexInput label="Body" value={theme.body_bg_color || ''} onChange={(v) => setThemeField('body_bg_color', v)} />
              <HexInput label="Cards" value={theme.card_bg_color || ''} onChange={(v) => setThemeField('card_bg_color', v)} />
              <HexInput label="Header" value={theme.header_bg_color || ''} onChange={(v) => setThemeField('header_bg_color', v)} />
              <HexInput label="Sidebar" value={theme.sidebar_bg_color || ''} onChange={(v) => setThemeField('sidebar_bg_color', v)} />
              <HexInput label="Text" value={theme.text_color || ''} onChange={(v) => setThemeField('text_color', v)} />
              <HexInput label="Primary" value={theme.primary_color || ''} onChange={(v) => setThemeField('primary_color', v)} />
              <HexInput label="Secondary" value={theme.secondary_color || ''} onChange={(v) => setThemeField('secondary_color', v)} />
              <HexInput label="Accent" value={theme.accent_color || ''} onChange={(v) => setThemeField('accent_color', v)} />
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              }
              title="Wallpaper"
            />
            <TextInput label="Image URL" value={theme.wallpaper || ''} onChange={(v) => setThemeField('wallpaper', v)} placeholder="https://example.com/image.gif" />
            {theme.wallpaper && (
              <div className="h-20 rounded-xl bg-cover bg-center border border-border mt-2" style={{ backgroundImage: `url(${theme.wallpaper})` }} />
            )}
            <div className="flex gap-2 mt-3">
              <PatternBtn label="None" value="" current={theme.pattern || ''} onClick={(v) => setThemeField('pattern', v)} />
              <PatternBtn label="Grid" value="grid" current={theme.pattern || ''} onClick={(v) => setThemeField('pattern', v)} />
              <PatternBtn label="Dots" value="dots" current={theme.pattern || ''} onClick={(v) => setThemeField('pattern', v)} />
            </div>
          </Card>

          <button onClick={() => { setTheme(DEFAULT_THEME); clearCustomTheme() }}
            className="text-xs text-muted hover:text-red-400 transition-colors">
            Reset theme to defaults
          </button>
        </>
      )}
    </div>
  )
}

function AppearancePanel({ theme, setThemeField }: {
  theme: CustomTheme
  setThemeField: <K extends keyof CustomTheme>(key: K, value: CustomTheme[K]) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-primary">Appearance</h3>
        <p className="text-sm text-muted mt-1">Fine-tune visual effects and layout</p>
      </div>

      <Card>
        <CardHeader
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          }
          title="Effects"
        />
        <ToggleRow label="Glass effect" value={theme.glass_effect || false} onChange={(v) => setThemeField('glass_effect', v)} />
        <RangeInput label="Blur amount" value={theme.blur_amount ?? 2} min={0} max={20} onChange={(v) => setThemeField('blur_amount', v)} />
        <RangeInput label="Opacity" value={theme.opacity ?? 100} min={0} max={100} onChange={(v) => setThemeField('opacity', v)} />
        <RangeInput label="Chat opacity" value={theme.chat_opacity ?? 100} min={0} max={100} onChange={(v) => setThemeField('chat_opacity', v)} />
        <RangeInput label="Profile card opacity" value={theme.profile_card_opacity ?? 100} min={0} max={100} onChange={(v) => setThemeField('profile_card_opacity', v)} />
      </Card>

      <Card>
        <CardHeader
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          }
          title="Layout"
        />
        <RangeInput label="Border radius" value={theme.border_radius ?? 12} min={0} max={40} onChange={(v) => setThemeField('border_radius', v)} />
        <div>
          <label className="text-xs text-muted font-medium mb-2 block">Font family</label>
          <div className="flex gap-2">
            {[
              { label: 'System', value: '' },
              { label: 'Mono', value: 'mono' },
              { label: 'Serif', value: 'serif' },
              { label: 'Sans', value: 'sans-serif' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setThemeField('font_family', opt.value || undefined)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                  (theme.font_family || '') === opt.value
                    ? 'bg-accent text-accent-content shadow-sm'
                    : 'bg-surface-muted text-secondary hover:bg-surface-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}

function SecurityPanel({ lockScreenEnabled, setLockScreenEnabled }: {
  lockScreenEnabled: boolean
  setLockScreenEnabled: (v: boolean) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-primary">Security</h3>
        <p className="text-sm text-muted mt-1">Protect your account and session</p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Lock screen</p>
            <p className="text-xs text-muted mt-0.5">Require authentication when returning to the app</p>
          </div>
          <Toggle
            checked={lockScreenEnabled}
            onChange={(v) => {
              setLockScreenEnabled(v)
              if (v) localStorage.removeItem('ftjm_lock_screen')
              else localStorage.setItem('ftjm_lock_screen', 'disabled')
            }}
          />
        </div>
      </Card>
    </div>
  )
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
      {children}
    </div>
  )
}

function CardHeader({ icon, title }: { icon: JSX.Element; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-accent">{icon}</span>
      <h4 className="text-sm font-semibold text-primary">{title}</h4>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
        checked ? 'bg-accent' : 'bg-surface-muted border border-border'
      }`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-secondary">{label}</span>
      <Toggle checked={value} onChange={onChange} />
    </div>
  )
}

function HexInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded-lg border border-border cursor-pointer bg-transparent shrink-0" />
      <span className="text-xs text-secondary truncate">{label}</span>
    </div>
  )
}

function SoundPicker({ label, value, onChange, onUpload, library, defaults = [] }: {
  label: string
  value: string
  onChange: (v: string) => void
  onUpload: () => void
  library: [string, string][]
  defaults?: DefaultSound[]
}) {
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    if (showPicker) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPicker])

  const hasOptions = defaults.length > 0 || library.length > 0
  const currentName = defaults.find((d) => d.url === value)?.name || library.find(([, uri]) => uri === value)?.[0] || ''

  return (
    <div>
      <label className="text-xs text-muted font-medium mb-1.5 block">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1" ref={pickerRef}>
          <button
            onClick={() => hasOptions && setShowPicker(!showPicker)}
            className="w-full input-field !py-2 !text-xs text-left flex items-center justify-between"
          >
            <span className={currentName ? 'text-primary' : 'text-muted'}>
              {currentName || 'Select a sound...'}
            </span>
            <svg className={`w-3 h-3 text-muted transition-transform ${showPicker ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showPicker && (
            <div className="absolute left-0 top-full mt-1 w-full bg-surface border border-border rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
              {value && (
                <button onClick={() => { onChange(''); setShowPicker(false) }}
                  className="w-full text-left px-3 py-2 text-xs text-muted hover:bg-surface-hover transition-all">
                  Clear selection
                </button>
              )}
              {defaults.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Defaults</div>
                  {defaults.map((d) => (
                    <div key={d.url} className="flex items-center gap-1 px-1 hover:bg-surface-hover transition-all">
                      <button onClick={() => { onChange(d.url); setShowPicker(false) }}
                        className={`flex-1 text-left px-2 py-2 text-xs flex items-center gap-2 ${value === d.url ? 'text-accent' : 'text-secondary'}`}>
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        <span className="truncate">{d.name}</span>
                      </button>
                      <button onClick={() => playSound(d.url)} title={`Preview ${d.name}`}
                        className="p-1.5 rounded-lg text-muted hover:text-accent transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </>
              )}
              {library.length > 0 && (
                <>
                  {defaults.length > 0 && (
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">My sounds</div>
                  )}
                  {library.map(([name, uri]) => (
                    <button key={name} onClick={() => { onChange(uri); setShowPicker(false) }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-hover transition-all flex items-center gap-2 ${value === uri ? 'text-accent' : 'text-secondary'}`}>
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <span className="truncate">{name}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        <button onClick={onUpload}
          className="px-3 py-2 rounded-xl text-xs font-medium bg-accent text-accent-content hover:bg-accent-hover transition-all">
          Upload
        </button>
      </div>
    </div>
  )
}

function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-muted font-medium mb-1.5 block">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field !py-2 !text-xs" />
    </div>
  )
}

function RangeInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-secondary w-28 shrink-0">{label}</span>
      <input type="range" value={value} min={min} max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-accent h-1.5" />
      <span className="text-xs text-muted w-8 text-right">{value}</span>
    </div>
  )
}

function PatternBtn({ label, value, current, onClick }: { label: string; value: string; current: string; onClick: (v: string) => void }) {
  return (
    <button onClick={() => onClick(value)}
      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
        current === value ? 'bg-accent text-accent-content shadow-sm' : 'bg-surface-muted text-secondary hover:bg-surface-hover'
      }`}>
      {label}
    </button>
  )
}
