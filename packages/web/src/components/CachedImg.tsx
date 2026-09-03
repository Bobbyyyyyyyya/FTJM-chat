import { useState, useEffect, useRef } from 'react'
import { getCachedUrl, fetchAndCache } from '@/lib/imageCache'

interface CachedImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
}

export default function CachedImg({ src, onError, ...props }: CachedImgProps) {
  const [url, setUrl] = useState<string | undefined>(() => {
    const cached = getCachedUrl(src)
    return cached ?? src
  })
  const currentSrc = useRef(src)

  useEffect(() => {
    currentSrc.current = src
    const cached = getCachedUrl(src)
    // If cached as a blob URL, use it. If there's a direct URL, keep it.
    if (cached && cached !== src) {
      setUrl(cached)
      return
    }
    fetchAndCache(src).then((blobUrl) => {
      if (currentSrc.current === src && blobUrl && blobUrl !== src) {
        setUrl(blobUrl)
      }
    })
  }, [src])

  return <img src={url} onError={onError} {...props} />
}
