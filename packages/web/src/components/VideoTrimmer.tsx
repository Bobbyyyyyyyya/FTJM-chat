import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { MAX_VIDEO_DURATION } from '@/lib/storage'

interface VideoTrimmerProps {
  file: File
  onConfirm: (trimmedFile: File) => void
  onCancel: () => void
}

const THUMB_COUNT = 12

export default function VideoTrimmer({ file, onConfirm, onCancel }: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(MAX_VIDEO_DURATION)
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [thumbnails, setThumbnails] = useState<string[]>([])

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const generateThumbnails = useCallback(async (videoEl: HTMLVideoElement, dur: number) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const thumbHeight = 48
    const thumbWidth = Math.round(thumbHeight * (16 / 9))
    canvas.width = thumbWidth
    canvas.height = thumbHeight

    const thumbs: string[] = []
    const interval = dur / THUMB_COUNT

    for (let i = 0; i < THUMB_COUNT; i++) {
      const time = i * interval
      videoEl.currentTime = Math.min(time, dur - 0.1)
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          videoEl.removeEventListener('seeked', onSeeked)
          ctx.drawImage(videoEl, 0, 0, thumbWidth, thumbHeight)
          thumbs.push(canvas.toDataURL('image/jpeg', 0.5))
          resolve()
        }
        videoEl.addEventListener('seeked', onSeeked)
      })
    }

    setThumbnails(thumbs)
    videoEl.currentTime = 0
  }, [])

  const handleLoadedMetadata = () => {
    const video = videoRef.current
    if (!video) return
    const dur = video.duration
    setDuration(dur)
    if (dur <= MAX_VIDEO_DURATION) {
      setTrimStart(0)
      setTrimEnd(dur)
    } else {
      setTrimStart(0)
      setTrimEnd(MAX_VIDEO_DURATION)
    }
    generateThumbnails(video, dur)
  }

  const previewTrim = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = trimStart
    video.play()
    const check = () => {
      if (video.currentTime >= trimEnd || video.ended) {
        video.pause()
        video.removeEventListener('timeupdate', check)
      }
    }
    video.addEventListener('timeupdate', check)
  }, [trimStart, trimEnd])

  const timeToPercent = (time: number) => {
    if (duration === 0) return 0
    return (time / duration) * 100
  }

  const percentToTime = (percent: number) => {
    return Math.max(0, Math.min(duration, (percent / 100) * duration))
  }

  const handlePointerDown = (handle: 'start' | 'end') => (e: React.PointerEvent) => {
    e.preventDefault()
    setDragging(handle)
  }

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragging || !timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100))
    const time = percentToTime(percent)

    if (dragging === 'start') {
      const newStart = Math.min(time, trimEnd - 0.5)
      setTrimStart(Math.max(0, newStart))
    } else {
      const newEnd = Math.max(time, trimStart + 0.5)
      setTrimEnd(Math.min(duration, newEnd))
    }
  }, [dragging, trimStart, trimEnd, duration])

  const handlePointerUp = useCallback(() => {
    setDragging(null)
  }, [])

  useEffect(() => {
    if (dragging) {
      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp)
      return () => {
        document.removeEventListener('pointermove', handlePointerMove)
        document.removeEventListener('pointerup', handlePointerUp)
      }
    }
  }, [dragging, handlePointerMove, handlePointerUp])

  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (video) setCurrentTime(video.currentTime)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`
  }

  const trimDuration = trimEnd - trimStart

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-primary">Video trimmen</h3>
            <p className="text-[11px] text-muted mt-0.5">
              Selecteer max. {MAX_VIDEO_DURATION} seconden
            </p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-surface-muted text-muted hover:text-primary transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video preview */}
        <div className="px-4">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onClick={previewTrim}
              controls={false}
            />
            <div className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-black/50 text-white/80 font-medium tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>

        {/* Filmstrip Timeline */}
        <div className="px-4 pt-4 pb-2">
          <div
            ref={timelineRef}
            className="relative h-12 bg-surface-muted rounded-xl overflow-hidden cursor-pointer select-none touch-none"
          >
            {/* Thumbnail filmstrip */}
            {thumbnails.length > 0 && (
              <div className="absolute inset-0 flex z-0">
                {thumbnails.map((thumb, i) => (
                  <img
                    key={i}
                    src={thumb}
                    alt=""
                    className="h-full flex-1 object-cover"
                    draggable={false}
                  />
                ))}
              </div>
            )}

            {/* Current position indicator */}
            {duration > 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white z-40 pointer-events-none"
                style={{ left: `${timeToPercent(currentTime)}%` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
              </div>
            )}

            {/* Dimmed areas outside trim */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-black/50 rounded-l-xl z-10"
              style={{ width: `${timeToPercent(trimStart)}%` }}
            />
            <div
              className="absolute top-0 bottom-0 right-0 bg-black/50 rounded-r-xl z-10"
              style={{ width: `${100 - timeToPercent(trimEnd)}%` }}
            />

            {/* Selected trim area border */}
            <div
              className="absolute top-0 bottom-0 border-y-2 border-accent z-20 pointer-events-none"
              style={{
                left: `${timeToPercent(trimStart)}%`,
                width: `${timeToPercent(trimEnd) - timeToPercent(trimStart)}%`,
              }}
            />

            {/* Start handle */}
            <div
              className="absolute top-0 bottom-0 z-30 cursor-ew-resize flex items-center"
              style={{ left: `${timeToPercent(trimStart)}%`, transform: 'translateX(-100%)' }}
              onPointerDown={handlePointerDown('start')}
            >
              <div className={`w-3 h-full rounded-l-md flex items-center justify-center transition-colors ${
                dragging === 'start' ? 'bg-accent' : 'bg-accent/80 hover:bg-accent'
              }`}>
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l-7-7z" />
                </svg>
              </div>
            </div>

            {/* End handle */}
            <div
              className="absolute top-0 bottom-0 z-30 cursor-ew-resize flex items-center"
              style={{ left: `${timeToPercent(trimEnd)}%` }}
              onPointerDown={handlePointerDown('end')}
            >
              <div className={`w-3 h-full rounded-r-md flex items-center justify-center transition-colors ${
                dragging === 'end' ? 'bg-accent' : 'bg-accent/80 hover:bg-accent'
              }`}>
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 5v14l7-7z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Time labels */}
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[10px] text-muted tabular-nums">{formatTime(trimStart)}</span>
            <span className={`text-[11px] font-semibold tabular-nums ${
              trimDuration > MAX_VIDEO_DURATION ? 'text-red-500' : 'text-accent'
            }`}>
              {formatTime(trimDuration)}
            </span>
            <span className="text-[10px] text-muted tabular-nums">{formatTime(trimEnd)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 pt-2 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-surface-muted text-secondary hover:bg-surface-hover transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={previewTrim}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-muted text-secondary hover:bg-surface-hover transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={async () => {
              const { trimVideo } = await import('@/lib/storage')
              const trimmedFile = await trimVideo(file, trimStart, trimEnd)
              onConfirm(trimmedFile)
            }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-accent text-accent-content hover:bg-accent-hover transition-colors"
          >
            Clip maken
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
