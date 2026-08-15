export interface DefaultSound {
  name: string
  url: string
}

function toPrettyName(file: string): string {
  let name = file.replace(/\.[^/.]+$/, '')
    .replace(/yt1s[_-]/gi, '')
    .replace(/(-\d+)$/, '')
    .replace(/_[a-z]*[0-9][a-z0-9]*$/i, '')
    .replace(/[_-]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function collect(modules: Record<string, unknown>): DefaultSound[] {
  return Object.entries(modules)
    .map(([path, url]) => {
      const file = path.split('/').pop() || ''
      return { name: toPrettyName(file), url: url as string }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

const ringtoneModules = import.meta.glob(
  '../assets/sounds/ringtones/*.{mp3,wav,ogg,m4a,webm,aac}',
  { eager: true, import: 'default' },
)

const messageToneModules = import.meta.glob(
  '../assets/sounds/message-tones/*.{mp3,wav,ogg,m4a,webm,aac}',
  { eager: true, import: 'default' },
)

export const DEFAULT_RINGTONES: DefaultSound[] = collect(ringtoneModules)
export const DEFAULT_MESSAGE_TONES: DefaultSound[] = collect(messageToneModules)

export function getDefaultRingtone(): string | undefined {
  return DEFAULT_RINGTONES[0]?.url
}

export function getDefaultMessageTone(): string | undefined {
  return DEFAULT_MESSAGE_TONES[0]?.url
}
