import { useState, useEffect } from 'react'
import { updateProfile, getProfile } from '@/lib/db'
import { useAuthStore } from '@/hooks/useAuth'

interface NotificationSettings {
  enable_sounds: boolean
  notify_new_messages: boolean
  notify_mentions: boolean
  notify_new_posts: boolean
  message_sound: string
  post_sound: string
  ringtone_url: string
}

interface CustomTheme {
  surface?: string
  surface_muted?: string
  body?: string
  text?: string
  text_secondary?: string
  text_muted?: string
  border?: string
  border_subtle?: string
}

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enable_sounds: true,
  notify_new_messages: true,
  notify_mentions: true,
  notify_new_posts: true,
  message_sound: '',
  post_sound: '',
  ringtone_url: '',
}

const DEFAULT_THEME: CustomTheme = {
  surface: '255 255 255',
  surface_muted: '249 250 251',
  body: '249 250 251',
  text: '17 24 39',
  text_secondary: '107 114 128',
  text_muted: '156 163 175',
  border: '229 231 235',
  border_subtle: '243 244 246',
}

export default function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'notifications' | 'theme'>('notifications')
  const [notif, setNotif] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS)
  const [useCustomTheme, setUseCustomTheme] = useState(false)
  const [theme, setTheme] = useState<CustomTheme>(DEFAULT_THEME)
  const [saving, setSaving] = useState(false)
  const [desktopNotif, setDesktopNotif] = useState(Notification.permission === 'granted')

  useEffect(() => {
    if (!isOpen || !user?.id) return
    const load = async () => {
      const p = await getProfile(user.id)
      if (!p) return
      if (p.notification_settings) {
        setNotif({ ...DEFAULT_NOTIFICATIONS, ...p.notification_settings as any })
      }
      setUseCustomTheme(p.use_custom_theme || false)
      if (p.custom_theme) {
        setTheme({ ...DEFAULT_THEME, ...p.custom_theme as any })
      }
      setDesktopNotif(Notification.permission === 'granted')
    }
    load()
  }, [isOpen, user?.id])

  const requestDesktopNotif = async () => {
    const result = await Notification.requestPermission()
    setDesktopNotif(result === 'granted')
  }

  const applyThemePreview = (t: CustomTheme) => {
    const root = document.documentElement
    root.style.setProperty('--surface', t.surface || DEFAULT_THEME.surface!)
    root.style.setProperty('--surface-muted', t.surface_muted || DEFAULT_THEME.surface_muted!)
    root.style.setProperty('--body', t.body || DEFAULT_THEME.body!)
    root.style.setProperty('--text', t.text || DEFAULT_THEME.text!)
    root.style.setProperty('--text-secondary', t.text_secondary || DEFAULT_THEME.text_secondary!)
    root.style.setProperty('--text-muted', t.text_muted || DEFAULT_THEME.text_muted!)
    root.style.setProperty('--border', t.border || DEFAULT_THEME.border!)
    root.style.setProperty('--border-subtle', t.border_subtle || DEFAULT_THEME.border_subtle!)
  }

  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      if (useCustomTheme) {
        applyThemePreview(theme)
      } else {
        applyThemePreview(DEFAULT_THEME)
      }
      await updateProfile({
        notification_settings: notif as any,
        use_custom_theme: useCustomTheme,
        custom_theme: theme as any,
      })
      onClose()
    } catch (e) {
      console.error('Error saving settings:', e)
    } finally {
      setSaving(false)
    }
  }

  const setNotifField = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    setNotif((prev) => ({ ...prev, [key]: value }))
  }

  const setThemeField = (key: keyof CustomTheme, value: string) => {
    const updated = { ...theme, [key]: value }
    setTheme(updated)
    applyThemePreview(updated)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/20 dark:bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-surface rounded-3xl shadow-xl shadow-black/10 dark:shadow-black/50 border border-subtle overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-bold text-primary">Settings</h2>
          <button onClick={onClose} className="rounded-xl bg-surface-muted p-2 text-muted hover:bg-surface-hover hover:text-secondary transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 pb-4 border-b border-subtle">
          <button onClick={() => setTab('notifications')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === 'notifications' ? 'bg-emerald-500 text-white shadow-sm' : 'text-secondary hover:bg-surface-hover'
            }`}>
            Notifications
          </button>
          <button onClick={() => setTab('theme')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === 'theme' ? 'bg-emerald-500 text-white shadow-sm' : 'text-secondary hover:bg-surface-hover'
            }`}>
            Custom Theme
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-96 overflow-y-auto space-y-5">
          {tab === 'notifications' ? (
            <>
              {/* Desktop notifications */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Desktop Notifications</h3>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-secondary">Push notifications (outside the app)</span>
                  <button onClick={requestDesktopNotif}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      desktopNotif ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-surface-muted text-secondary hover:bg-surface-hover'
                    }`}>
                    {desktopNotif ? 'Enabled' : 'Enable'}
                  </button>
                </div>
              </div>

              <div className="border-t border-subtle pt-4">
                <h3 className="text-sm font-semibold text-primary mb-3">In-App Notifications</h3>

                {/* Toggles */}
                <div className="space-y-3">
                  <ToggleRow label="Enable sounds" value={notif.enable_sounds} onChange={(v) => setNotifField('enable_sounds', v)} />
                  <ToggleRow label="New messages" value={notif.notify_new_messages} onChange={(v) => setNotifField('notify_new_messages', v)} />
                  <ToggleRow label="Mentions" value={notif.notify_mentions} onChange={(v) => setNotifField('notify_mentions', v)} />
                  <ToggleRow label="New posts in General" value={notif.notify_new_posts} onChange={(v) => setNotifField('notify_new_posts', v)} />
                </div>

                {/* Sound URLs */}
                <div className="mt-4 space-y-3">
                  <SoundInput label="Message sound URL" value={notif.message_sound} onChange={(v) => setNotifField('message_sound', v)} />
                  <SoundInput label="Post sound URL" value={notif.post_sound} onChange={(v) => setNotifField('post_sound', v)} />
                  <SoundInput label="Ringtone URL" value={notif.ringtone_url} onChange={(v) => setNotifField('ringtone_url', v)} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">Enable custom theme</span>
                <button onClick={() => { setUseCustomTheme(!useCustomTheme); if (useCustomTheme) applyThemePreview(DEFAULT_THEME) }}
                  className={`w-10 h-5 rounded-full transition-all relative ${useCustomTheme ? 'bg-emerald-500' : 'bg-surface-muted border border-subtle'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${useCustomTheme ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>

              {useCustomTheme && (
                <div className="space-y-3 pt-3 border-t border-subtle">
                  <ColorInput label="Surface" value={theme.surface || ''} onChange={(v) => setThemeField('surface', v)} />
                  <ColorInput label="Surface muted" value={theme.surface_muted || ''} onChange={(v) => setThemeField('surface_muted', v)} />
                  <ColorInput label="Body background" value={theme.body || ''} onChange={(v) => setThemeField('body', v)} />
                  <ColorInput label="Text" value={theme.text || ''} onChange={(v) => setThemeField('text', v)} />
                  <ColorInput label="Text secondary" value={theme.text_secondary || ''} onChange={(v) => setThemeField('text_secondary', v)} />
                  <ColorInput label="Text muted" value={theme.text_muted || ''} onChange={(v) => setThemeField('text_muted', v)} />
                  <ColorInput label="Border" value={theme.border || ''} onChange={(v) => setThemeField('border', v)} />
                  <ColorInput label="Border subtle" value={theme.border_subtle || ''} onChange={(v) => setThemeField('border_subtle', v)} />

                  <button onClick={() => { const d = DEFAULT_THEME; setTheme(d as CustomTheme); applyThemePreview(d as CustomTheme) }}
                    className="text-xs text-muted hover:text-secondary transition-colors mt-2">
                    Reset to defaults
                  </button>

                  {/* Preview */}
                  <div className="mt-4 p-4 rounded-2xl border border-subtle" style={{ backgroundColor: `rgb(${theme.body || DEFAULT_THEME.body})` }}>
                    <p className="text-xs font-semibold text-muted mb-2">Preview</p>
                    <div className="space-y-2 p-3 rounded-xl" style={{ backgroundColor: `rgb(${theme.surface || DEFAULT_THEME.surface})`, border: `1px solid rgb(${theme.border || DEFAULT_THEME.border})` }}>
                      <p style={{ color: `rgb(${theme.text || DEFAULT_THEME.text})` }} className="text-sm font-medium">Sample card</p>
                      <p style={{ color: `rgb(${theme.text_secondary || DEFAULT_THEME.text_secondary})` }} className="text-xs">This is how cards will look</p>
                      <p style={{ color: `rgb(${theme.text_muted || DEFAULT_THEME.text_muted})` }} className="text-[10px]">muted text example</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-subtle bg-surface-muted">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-secondary hover:bg-surface-hover transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-all">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-secondary">{label}</span>
      <button onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-all relative ${value ? 'bg-emerald-500' : 'bg-surface-muted border border-subtle'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${value ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

function SoundInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted font-medium mb-1 block">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com/sound.mp3"
        className="input-field !py-2 !text-xs" />
    </div>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [r, g, b] = value.split(' ').map(Number)
  const toHex = (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, x || 0)).toString(16).padStart(2, '0')).join('')
  }
  const fromHex = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return value
    return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-secondary w-28 shrink-0">{label}</span>
      <input type="color" value={toHex(r, g, b)} onChange={(e) => onChange(fromHex(e.target.value))}
        className="w-8 h-8 rounded-lg border border-subtle cursor-pointer bg-transparent" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="R G B"
        className="input-field !py-1.5 !text-xs flex-1" />
    </div>
  )
}
