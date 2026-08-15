import { useState, useEffect, Fragment } from 'react'
import { fetchEmbed, extractUrls, extractArcadeScores, type EmbedData, type ArcadeScoreShare } from '@/lib/embeds'

const DATA_URI_REGEX = /data:(image|audio|video)\/[a-z0-9+.-]+;base64,[A-Za-z0-9+/=_-]+/gi
const DATA_URI_ANY = /data:[a-z0-9+.-]+\/[a-z0-9+.-]+;base64,[A-Za-z0-9+/=_-]+/gi
const LINK_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)}\]'"])/g
const ARCADE_SCORE_ANY = /\[ARCASE_SCORE_SHARE:[^\]]+\]/gi

function stripDataUris(text: string) {
  return text.replace(DATA_URI_ANY, '').trim()
}

function stripArcadeScores(text: string) {
  return text.replace(ARCADE_SCORE_ANY, '').trim()
}

export function LinkifyText({ text }: { text: string }) {
  const cleaned = stripArcadeScores(stripDataUris(text))
  const parts = cleaned.split(LINK_REGEX)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('http://') || part.startsWith('https://')) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              {part}
            </a>
          )
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}

export function MessageEmbeds({ text }: { text: string }) {
  const arcadeScores = extractArcadeScores(text)
  const urls = extractUrls(text)
  if (urls.length === 0 && arcadeScores.length === 0) return null

  return (
    <>
      {arcadeScores.map((share, i) => (
        <ArcadeScoreCard key={`arcade-${i}`} share={share} />
      ))}
      {urls.map((url, i) => (
        <SingleEmbed key={`${url}-${i}`} url={url} />
      ))}
    </>
  )
}

export function DataUriMedia({ text }: { text: string }) {
  const matches: { uri: string; type: 'image' | 'audio' | 'video' }[] = []
  const re = new RegExp(DATA_URI_REGEX.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const uri = m[0]
    const type = m[1] as 'image' | 'audio' | 'video'
    if (!matches.some((x) => x.uri === uri)) {
      matches.push({ uri, type })
    }
  }
  if (matches.length === 0) return null

  return (
    <>
      {matches.map((m, i) =>
        m.type === 'image' ? (
          <img key={i} src={m.uri} alt="Base64 image" className="mt-2 max-w-full rounded-xl max-h-96 object-contain bg-surface-muted" loading="lazy" />
        ) : m.type === 'video' ? (
          <video key={i} src={m.uri} controls className="mt-2 max-w-full rounded-xl max-h-96 bg-surface-muted" />
        ) : (
          <audio key={i} src={m.uri} controls className="mt-2 w-full max-w-md" />
        )
      )}
    </>
  )
}

function SingleEmbed({ url }: { url: string }) {
  const [embed, setEmbed] = useState<EmbedData | null>(null)

  useEffect(() => {
    fetchEmbed(url).then(setEmbed)
  }, [url])

  if (!embed) return null

  if (embed.type === 'youtube') {
    return (
      <div className="mt-3 rounded-2xl overflow-hidden border border-border bg-surface shadow-sm max-w-lg">
        <a href={url} target="_blank" rel="noopener noreferrer" className="block group">
          <div className="relative aspect-video bg-black">
            <img src={embed.thumbnail} alt={embed.title} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-12 w-12 rounded-full bg-black/70 flex items-center justify-center group-hover:bg-black/90 transition-colors">
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-primary line-clamp-2">{embed.title}</p>
            {embed.author && (
              <p className="text-xs text-muted mt-0.5">{embed.author}</p>
            )}
          </div>
        </a>
      </div>
    )
  }

  if (embed.type === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 block max-w-lg">
        <img src={url} alt="Image" className="max-w-full rounded-xl max-h-96 object-contain bg-surface-muted border border-border" loading="lazy" />
      </a>
    )
  }

  return (
    <div className="mt-2">
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        <span className="truncate max-w-[300px]">{embed.domain}{embed.domain && '/'}{url.replace(/https?:\/\//, '').split('/').slice(1).join('/')}</span>
      </a>
    </div>
  )
}

function ArcadeScoreCard({ share }: { share: ArcadeScoreShare }) {
  const formattedScore = share.score.toLocaleString('en-US')
  const gameTitle = share.game.charAt(0).toUpperCase() + share.game.slice(1)

  return (
    <div className="mt-2 rounded-2xl border border-border bg-surface shadow-sm overflow-hidden max-w-sm">
      <div className="bg-gradient-accent px-4 py-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-xs font-bold text-white tracking-wide uppercase">Arcade Score</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-lg font-extrabold text-primary">{gameTitle}</p>
        <div className="flex items-end justify-between mt-2">
          <div>
            <p className="text-[10px] text-muted font-medium uppercase tracking-wide">Player</p>
            <p className="text-sm font-semibold text-secondary">{share.player}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted font-medium uppercase tracking-wide">Score</p>
            <p className="text-2xl font-extrabold text-accent tabular-nums leading-none">{formattedScore}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
