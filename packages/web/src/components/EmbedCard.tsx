import { useState, useEffect, Fragment } from 'react'
import { fetchEmbed, extractUrls, type EmbedData } from '@/lib/embeds'

const LINK_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)}\]'"])/g

export function LinkifyText({ text }: { text: string }) {
  const parts = text.split(LINK_REGEX)
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
  const urls = extractUrls(text)
  if (urls.length === 0) return null

  return (
    <>
      {urls.map((url, i) => (
        <SingleEmbed key={`${url}-${i}`} url={url} />
      ))}
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
      <div className="mt-3 rounded-2xl overflow-hidden border border-subtle bg-surface shadow-sm">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block group"
        >
          <div className="relative aspect-video bg-black">
            <img
              src={embed.thumbnail}
              alt={embed.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
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

  return (
    <div className="mt-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        <span className="truncate max-w-[300px]">{embed.domain}{embed.domain && '/'}{url.replace(/https?:\/\//, '').split('/').slice(1).join('/')}</span>
      </a>
    </div>
  )
}
