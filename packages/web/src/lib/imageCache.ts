const cache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()
const MAX_ENTRIES = 300

// Hosts allowed by the connect-src CSP. For any other host we skip the fetch
// (which would be blocked by CSP) and let the <img> load the URL directly,
// relying on the browser's HTTP cache instead.
const ALLOWED_FETCH_HOSTS: { host: string; meta?: boolean }[] = [
  { host: 'i.ibb.co' },
  { host: 'i.imgur.com' },
  { host: 'image2url.com', meta: true },
  { host: 'supabase.co', meta: true },
  { host: 'googleusercontent.com', meta: true },
  { host: 'gstatic.com', meta: true },
  { host: 'img.youtube.com' },
  { host: 'i.ytimg.com' },
]

function canFetch(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return ALLOWED_FETCH_HOSTS.some(({ host: allowed, meta }) =>
      meta ? host.endsWith(allowed) || host === allowed : host === allowed
    )
  } catch {
    return false
  }
}

function evictOldest() {
  const first = cache.keys().next().value
  if (first) {
    URL.revokeObjectURL(cache.get(first)!)
    cache.delete(first)
  }
}

async function doFetchAndCache(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    if (cache.size >= MAX_ENTRIES) evictOldest()
    cache.set(url, blobUrl)
    return blobUrl
  } catch {
    return url
  }
}

async function fetchAndCacheInner(url: string): Promise<string> {
  if (cache.has(url)) return cache.get(url)!
  if (inflight.has(url)) return inflight.get(url)!

  const promise = doFetchAndCache(url).finally(() => inflight.delete(url))
  inflight.set(url, promise)
  return promise
}

export async function fetchAndCache(url: string): Promise<string> {
  if (!canFetch(url)) return url
  return fetchAndCacheInner(url)
}

export function getCachedUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  return cache.get(url) || url
}

export function prefetchImage(url: string | undefined | null): void {
  if (!url || cache.has(url)) return
  fetchAndCache(url)
}

export function preloadImages(urls: (string | undefined | null)[]): void {
  urls.forEach(prefetchImage)
}
