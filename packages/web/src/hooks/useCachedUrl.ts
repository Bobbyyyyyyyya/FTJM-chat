import { useState, useEffect, useRef } from 'react'
import { getCachedUrl, fetchAndCache } from '@/lib/imageCache'

export default function useCachedUrl(url: string | undefined | null): string | undefined {
  const [cached, setCached] = useState(() => (url ? getCachedUrl(url) : undefined))
  const currentUrl = useRef(url)

  useEffect(() => {
    currentUrl.current = url
    if (!url) { setCached(undefined); return }
    const c = getCachedUrl(url)
    if (c && c !== url) { setCached(c); return }
    setCached(url)
    fetchAndCache(url).then((blobUrl) => {
      if (currentUrl.current === url && blobUrl !== url) setCached(blobUrl)
    })
  }, [url])

  return cached
}
