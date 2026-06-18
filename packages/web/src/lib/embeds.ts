const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)}\]'"])/g

export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) || []
}

export function getYouTubeId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX)
  return match ? match[1] : null
}

export interface YouTubeEmbed {
  type: 'youtube'
  videoId: string
  title: string
  author: string
  thumbnail: string
}

export interface LinkEmbed {
  type: 'link'
  url: string
  domain: string
}

export type EmbedData = YouTubeEmbed | LinkEmbed

export async function fetchEmbed(url: string): Promise<EmbedData | null> {
  const youtubeId = getYouTubeId(url)
  if (youtubeId) {
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
      if (res.ok) {
        const data = await res.json()
        return {
          type: 'youtube',
          videoId: youtubeId,
          title: data.title || 'YouTube Video',
          author: data.author_name || '',
          thumbnail: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
        }
      }
    } catch {
      return {
        type: 'youtube',
        videoId: youtubeId,
        title: 'YouTube Video',
        author: '',
        thumbnail: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      }
    }
  }

  try {
    const parsed = new URL(url)
    return {
      type: 'link',
      url,
      domain: parsed.hostname.replace('www.', ''),
    }
  } catch {
    return null
  }
}
