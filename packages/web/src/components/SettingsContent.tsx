import { useState, useEffect, useRef } from 'react'
import { updateProfile, getProfile } from '@/lib/db'
import { fileToDataUri, playSound } from '@/lib/storage'

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
  agreed_terms_v2?: boolean
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
  agreed_terms_v2: false,
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

export default function SettingsContent({ userId, onClose }: { userId: string; onClose?: () => void }) {
  const [tab, setTab] = useState<'notifications' | 'theme'>('notifications')
  const [notif, setNotif] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS)
  const [useCustomTheme, setUseCustomTheme] = useState(false)
  const [theme, setTheme] = useState<CustomTheme>(DEFAULT_THEME)
  const [saving, setSaving] = useState(false)
  const [desktopNotif, setDesktopNotif] = useState(Notification.permission === 'granted')

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
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-2 px-6 pb-4 border-b border-border">
        <button onClick={() => setTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'notifications' ? 'bg-accent text-accent-content shadow-sm' : 'text-secondary hover:bg-surface-hover'
          }`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Notifications
        </button>
        <button onClick={() => setTab('theme')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'theme' ? 'bg-accent text-accent-content shadow-sm' : 'text-secondary hover:bg-surface-hover'
          }`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          Custom Theme
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {tab === 'notifications' ? (
          <>
            <div>
              <h3 className="text-sm font-semibold text-primary mb-3">Desktop Notifications</h3>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-secondary">Push notifications (outside the app)</span>
                <button onClick={requestDesktopNotif}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    desktopNotif ? 'bg-accent/10 text-accent' : 'bg-surface-muted text-secondary hover:bg-surface-hover'
                  }`}>
                  {desktopNotif ? 'Enabled' : 'Enable'}
                </button>
              </div>
              {(window as any).electron?.openNotificationSettings && (
                <button onClick={() => (window as any).electron.openNotificationSettings()}
                  className="mt-2 w-full py-2 rounded-xl text-xs font-medium bg-surface-muted text-secondary hover:bg-surface-hover transition-all">
                  Open macOS Notification Settings
                </button>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-primary mb-3">In-App Notifications</h3>
              <div className="space-y-3">
                <ToggleRow label="Enable sounds" value={notif.enable_sounds} onChange={(v) => setNotifField('enable_sounds', v)} />
                <ToggleRow label="New messages" value={notif.notify_new_messages} onChange={(v) => setNotifField('notify_new_messages', v)} />
                <ToggleRow label="Mentions" value={notif.notify_mentions} onChange={(v) => setNotifField('notify_mentions', v)} />
                <ToggleRow label="New posts in General" value={notif.notify_new_posts} onChange={(v) => setNotifField('notify_new_posts', v)} />
              </div>
              <div className="mt-4 space-y-3">
                <SoundInput label="Message sound" value={notif.message_sound} onChange={(v) => setNotifField('message_sound', v)} onPreview={() => notif.message_sound && playSound(notif.message_sound)} onUpload={() => handleUploadSound('message_sound')} library={Object.entries(notif.sound_library)} onPickFromLibrary={(uri) => setNotifField('message_sound', uri)} />
                <SoundInput label="Post sound" value={notif.post_sound} onChange={(v) => setNotifField('post_sound', v)} onPreview={() => notif.post_sound && playSound(notif.post_sound)} onUpload={() => handleUploadSound('post_sound')} library={Object.entries(notif.sound_library)} onPickFromLibrary={(uri) => setNotifField('post_sound', uri)} />
                <SoundInput label="Ringtone" value={notif.ringtone_url} onChange={(v) => setNotifField('ringtone_url', v)} onPreview={() => notif.ringtone_url && playSound(notif.ringtone_url)} onUpload={() => handleUploadSound('ringtone_url')} library={Object.entries(notif.sound_library)} onPickFromLibrary={(uri) => setNotifField('ringtone_url', uri)} />
              </div>

              {/* Sound Library */}
              <div className="border-t border-border pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-primary">Sound Library</h3>
                  <button onClick={handleAddToLibrary}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-accent text-accent-content hover:bg-accent-hover transition-all">
                    + Add Sound
                  </button>
                </div>
                {Object.keys(notif.sound_library).length === 0 ? (
                  <p className="text-xs text-muted">No custom sounds yet. Upload a sound to get started.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(notif.sound_library).map(([name, uri]) => (
                      <div key={name} className="flex items-center gap-2 bg-surface-muted rounded-xl px-3 py-2">
                        <span className="text-sm text-secondary flex-1 truncate">{name}</span>
                        <button onClick={() => playSound(uri)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-hover text-secondary hover:text-primary transition-all">
                          Preview
                        </button>
                        <button onClick={() => handleDeleteFromLibrary(name)}
                          className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-primary">Enable custom theme</span>
              <button onClick={() => { setUseCustomTheme(!useCustomTheme); if (!useCustomTheme) applyCustomTheme(theme); else clearCustomTheme() }}
                className={`w-10 h-5 rounded-full transition-all relative ${useCustomTheme ? 'bg-accent' : 'bg-surface-muted border border-border'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${useCustomTheme ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            {useCustomTheme && (
              <div className="space-y-4 pt-3 border-t border-border">
                <Section title="Colors">
                  <HexInput label="Body background" value={theme.body_bg_color || ''} onChange={(v) => setThemeField('body_bg_color', v)} />
                  <HexInput label="Card background" value={theme.card_bg_color || ''} onChange={(v) => setThemeField('card_bg_color', v)} />
                  <HexInput label="Header background" value={theme.header_bg_color || ''} onChange={(v) => setThemeField('header_bg_color', v)} />
                  <HexInput label="Sidebar background" value={theme.sidebar_bg_color || ''} onChange={(v) => setThemeField('sidebar_bg_color', v)} />
                  <HexInput label="Text" value={theme.text_color || ''} onChange={(v) => setThemeField('text_color', v)} />
                  <HexInput label="Primary" value={theme.primary_color || ''} onChange={(v) => setThemeField('primary_color', v)} />
                  <HexInput label="Secondary" value={theme.secondary_color || ''} onChange={(v) => setThemeField('secondary_color', v)} />
                  <HexInput label="Accent" value={theme.accent_color || ''} onChange={(v) => setThemeField('accent_color', v)} />
                </Section>

                <Section title="Wallpaper">
                  <TextInput label="Wallpaper URL" value={theme.wallpaper || ''} onChange={(v) => setThemeField('wallpaper', v)} placeholder="https://example.com/image.gif" />
                  {theme.wallpaper && (
                    <div className="h-24 rounded-xl bg-cover bg-center border border-border" style={{ backgroundImage: `url(${theme.wallpaper})` }} />
                  )}
                  <div className="flex gap-2">
                    <PatternBtn label="None" value="" current={theme.pattern || ''} onClick={(v) => setThemeField('pattern', v)} />
                    <PatternBtn label="Grid" value="grid" current={theme.pattern || ''} onClick={(v) => setThemeField('pattern', v)} />
                    <PatternBtn label="Dots" value="dots" current={theme.pattern || ''} onClick={(v) => setThemeField('pattern', v)} />
                  </div>
                </Section>

                <Section title="Effects">
                  <ToggleRow label="Glass effect" value={theme.glass_effect || false} onChange={(v) => setThemeField('glass_effect', v)} />
                  <RangeInput label="Blur amount" value={theme.blur_amount ?? 2} min={0} max={20} onChange={(v) => setThemeField('blur_amount', v)} />
                  <RangeInput label="Opacity" value={theme.opacity ?? 100} min={0} max={100} onChange={(v) => setThemeField('opacity', v)} />
                  <RangeInput label="Chat opacity" value={theme.chat_opacity ?? 100} min={0} max={100} onChange={(v) => setThemeField('chat_opacity', v)} />
                  <RangeInput label="Profile card opacity" value={theme.profile_card_opacity ?? 100} min={0} max={100} onChange={(v) => setThemeField('profile_card_opacity', v)} />
                </Section>

                <Section title="Layout">
                  <RangeInput label="Border radius" value={theme.border_radius ?? 12} min={0} max={40} onChange={(v) => setThemeField('border_radius', v)} />
                  <div>
                    <label className="text-xs text-muted font-medium mb-1 block">Font family</label>
                    <select value={theme.font_family || 'system'} onChange={(e) => setThemeField('font_family', e.target.value === 'system' ? '' : e.target.value)}
                      className="input-field !py-2 !text-xs">
                      <option value="system">System</option>
                      <option value="mono">Mono</option>
                      <option value="serif">Serif</option>
                      <option value="sans-serif">Sans-serif</option>
                    </select>
                  </div>
                </Section>

                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" id="terms" checked={theme.agreed_terms_v2 || false}
                    onChange={(e) => setThemeField('agreed_terms_v2', e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent" />
                  <label htmlFor="terms" className="text-xs text-secondary">I agree to the terms v2</label>
                </div>

                <button onClick={() => { setTheme(DEFAULT_THEME); clearCustomTheme() }}
                  className="text-xs text-muted hover:text-secondary transition-colors">
                  Reset to defaults
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-surface-muted">
        {onClose && (
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-secondary hover:bg-surface-hover transition-all">
            Cancel
          </button>
        )}
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 rounded-xl text-sm font-medium bg-accent text-accent-content hover:bg-accent-hover disabled:opacity-50 transition-all">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-secondary">{label}</span>
      <button onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-all relative ${value ? 'bg-accent' : 'bg-surface-muted border border-border'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${value ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

function HexInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-secondary w-28 shrink-0">{label}</span>
      <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        className="input-field !py-1.5 !text-xs flex-1" />
    </div>
  )
}

function SoundInput({ label, value, onChange, onPreview, onUpload, library, onPickFromLibrary }: {
  label: string
  value: string
  onChange: (v: string) => void
  onPreview: () => void
  onUpload: () => void
  library: [string, string][]
  onPickFromLibrary: (uri: string) => void
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

  return (
    <div>
      <label className="text-xs text-muted font-medium mb-1 block">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
            placeholder="https://example.com/sound.mp3"
            className="input-field !py-2 !text-xs w-full" />
        </div>
        <button onClick={onPreview} disabled={!value}
          className="px-3 py-2 rounded-xl text-xs font-medium bg-surface-muted text-secondary hover:bg-surface-hover disabled:opacity-40 transition-all">
          Preview
        </button>
        <div className="relative" ref={pickerRef}>
          <button onClick={() => setShowPicker(!showPicker)} disabled={library.length === 0}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-surface-muted text-secondary hover:bg-surface-hover disabled:opacity-40 transition-all">
            Library
          </button>
          {showPicker && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-surface border border-border rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
              {library.map(([name, uri]) => (
                <button key={name} onClick={() => { onChange(uri); setShowPicker(false) }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-hover transition-all flex items-center gap-2 ${value === uri ? 'text-accent' : 'text-secondary'}`}>
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <span className="truncate">{name}</span>
                </button>
              ))}
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
      <label className="text-xs text-muted font-medium mb-1 block">{label}</label>
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
