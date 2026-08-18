import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { ProfileMedia } from '@/lib/types'
import { likeMedia, unlikeMedia, addComment, deleteComment } from '@/lib/db-social'

interface MediaFeedScrollProps {
  media: ProfileMedia[]
  profilesCache: Record<string, any>
  currentUserId: string
  onMediaUpdate: (media: ProfileMedia[]) => void
  openProfile: (userId: string, displayName?: string, photoUrl?: string) => void
}

export default function MediaFeedScroll({ media, profilesCache, currentUserId, onMediaUpdate, openProfile }: MediaFeedScrollProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const touchStartY = useRef<number>(0)
  const touchEndY = useRef<number>(0)

  const scrollToIndex = useCallback((index: number) => {
    if (index < 0 || index >= media.length) return
    setCurrentIndex(index)
    const container = containerRef.current
    if (container) {
      const target = container.children[index] as HTMLElement
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [media.length])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollTop = container.scrollTop
      const itemHeight = container.clientHeight
      const newIndex = Math.round(scrollTop / itemHeight)
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < media.length) {
        setCurrentIndex(newIndex)
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [currentIndex, media.length])

  useEffect(() => {
    media.forEach((m, index) => {
      const video = videoRefs.current.get(m.id)
      if (video) {
        if (index === currentIndex && m.media_type === 'video') {
          video.play().catch(() => {})
        } else {
          video.pause()
          if (index !== currentIndex) {
            video.currentTime = 0
          }
        }
      }
    })
  }, [currentIndex, media])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndY.current = e.touches[0].clientY
  }

  const handleTouchEnd = () => {
    const diff = touchStartY.current - touchEndY.current
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        scrollToIndex(currentIndex + 1)
      } else {
        scrollToIndex(currentIndex - 1)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault()
      scrollToIndex(currentIndex + 1)
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault()
      scrollToIndex(currentIndex - 1)
    }
  }

  const handleLike = (mediaItem: ProfileMedia) => {
    const likes: string[] = (mediaItem.likes || []) as string[]
    const isLiked = likes.includes(currentUserId)

    if (isLiked) {
      unlikeMedia(mediaItem.id, currentUserId)
      onMediaUpdate(media.map(m => m.id === mediaItem.id ? { ...m, likes: likes.filter(id => id !== currentUserId) } : m))
    } else {
      likeMedia(mediaItem.id, currentUserId)
      onMediaUpdate(media.map(m => m.id === mediaItem.id ? { ...m, likes: [...likes, currentUserId] } : m))
    }
  }

  const handleComment = (mediaItem: ProfileMedia) => {
    const text = (commentInputs[mediaItem.id] || '').trim()
    if (!text) return

    addComment(mediaItem.id, currentUserId, 'User', text)
    const newComment = {
      id: crypto.randomUUID(),
      user_id: currentUserId,
      name: 'User',
      photo: null,
      text,
      created_at: new Date().toISOString(),
    }
    const comments: any[] = (mediaItem.comments || []) as any[]
    onMediaUpdate(media.map(m => m.id === mediaItem.id ? { ...m, comments: [...comments, newComment] } : m))
    setCommentInputs(prev => ({ ...prev, [mediaItem.id]: '' }))
  }

  if (media.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center py-20">
        <div>
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-400/10 to-pink-400/10 flex items-center justify-center mx-auto mb-4 border border-border/50">
            <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-muted text-lg font-medium">No media yet</p>
          <p className="text-muted text-sm mt-1">Follow people to see their uploads here</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto snap-y snap-mandatory"
      style={{ scrollSnapType: 'y mandatory' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {media.map((mediaItem, index) => {
        const author = profilesCache[mediaItem.user_id]
        const authorName = author?.display_name || 'User'
        const likes: string[] = (mediaItem.likes || []) as string[]
        const comments: any[] = (mediaItem.comments || []) as any[]
        const isLiked = likes.includes(currentUserId)
        const isCommentsExpanded = expandedComments.has(mediaItem.id)
        const isVideo = mediaItem.media_type === 'video'

        return (
          <div
            key={mediaItem.id}
            className="h-screen w-full snap-start flex items-center justify-center bg-black relative"
          >
            {/* Media content */}
            <div className="relative h-full w-full flex items-center justify-center">
              {isVideo ? (
                <video
                  ref={(el) => {
                    if (el) videoRefs.current.set(mediaItem.id, el)
                    else videoRefs.current.delete(mediaItem.id)
                  }}
                  src={mediaItem.media_url}
                  className="max-h-full max-w-full object-contain"
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img
                  src={mediaItem.media_url}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                />
              )}

              {/* Video play indicator */}
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0, scale: 1 }}
                    className="h-16 w-16 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
                  >
                    <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </motion.div>
                </div>
              )}
            </div>

            {/* Author info overlay - bottom left */}
            <div className="absolute bottom-24 left-4 right-20 z-10">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => openProfile(mediaItem.user_id, authorName, author?.photo_url)}
                  className="h-10 w-10 rounded-full overflow-hidden bg-black/30 flex items-center justify-center text-sm font-bold text-white shrink-0 backdrop-blur-sm ring-2 ring-white/20"
                >
                  {author?.photo_url ? (
                    <img src={author.photo_url} alt={authorName} className="h-full w-full object-cover" />
                  ) : authorName.charAt(0).toUpperCase()}
                </button>
                <div>
                  <span className="text-sm font-semibold text-white drop-shadow-sm flex items-center gap-1.5">
                    {authorName}
                    {author?.role === 'admin' && (
                      <svg className="w-3.5 h-3.5 text-amber-300" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z"/></svg>
                    )}
                    {author?.role === 'mod' && (
                      <svg className="w-3.5 h-3.5 text-blue-300" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z"/></svg>
                    )}
                  </span>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/30 text-white/80 backdrop-blur-sm uppercase font-medium">
                {mediaItem.media_type}
              </span>
            </div>

            {/* Action buttons - right side */}
            <div className="absolute right-4 bottom-32 flex flex-col items-center gap-5 z-10">
              {/* Like */}
              <button
                onClick={() => handleLike(mediaItem)}
                className="flex flex-col items-center gap-1"
              >
                <div className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${isLiked ? 'bg-red-500/20' : 'bg-black/20 backdrop-blur-sm'}`}>
                  <svg
                    className={`w-6 h-6 transition-all ${isLiked ? 'text-red-500 scale-110' : 'text-white'}`}
                    fill={isLiked ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <span className="text-[11px] font-semibold text-white drop-shadow-sm">{likes.length}</span>
              </button>

              {/* Comments */}
              <button
                onClick={() => {
                  if (isCommentsExpanded) {
                    setExpandedComments(prev => { const next = new Set(prev); next.delete(mediaItem.id); return next })
                  } else {
                    setExpandedComments(prev => { const next = new Set(prev); next.add(mediaItem.id); return next })
                  }
                }}
                className="flex flex-col items-center gap-1"
              >
                <div className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${isCommentsExpanded ? 'bg-accent/20' : 'bg-black/20 backdrop-blur-sm'}`}>
                  <svg className={`w-6 h-6 ${isCommentsExpanded ? 'text-accent' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <span className="text-[11px] font-semibold text-white drop-shadow-sm">{comments.length}</span>
              </button>
            </div>

            {/* Comments panel */}
            <AnimatePresence>
              {isCommentsExpanded && (
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="absolute bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md rounded-t-2xl max-h-[40vh] z-20 flex flex-col"
                >
                  <div className="p-3 border-b border-border/50 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-primary">Comments</h3>
                    <button
                      onClick={() => setExpandedComments(prev => { const next = new Set(prev); next.delete(mediaItem.id); return next })}
                      className="p-1 rounded-lg hover:bg-surface-muted text-muted hover:text-primary transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {comments.length === 0 ? (
                      <p className="text-xs text-muted text-center py-4">No comments yet</p>
                    ) : (
                      comments.map((c: any) => {
                        const commentProfile = profilesCache[c.user_id]
                        const commentName = c.name || commentProfile?.display_name || 'User'
                        const commentPhoto = c.photo || commentProfile?.photo_url
                        return (
                          <div key={c.id} className="flex gap-2 items-start">
                            <div className="h-7 w-7 rounded-full overflow-hidden bg-surface-hover flex items-center justify-center text-[8px] font-bold text-secondary shrink-0">
                              {commentPhoto ? (
                                <img src={commentPhoto} alt={commentName} className="h-full w-full object-cover" />
                              ) : commentName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-primary">{commentName}</span>
                                <span className="text-[9px] text-muted">{new Date(c.created_at).toLocaleDateString()}</span>
                                {c.user_id === currentUserId && (
                                  <button onClick={() => {
                                    deleteComment(mediaItem.id, c.id)
                                    onMediaUpdate(media.map(m => m.id === mediaItem.id ? { ...m, comments: comments.filter((cc: any) => cc.id !== c.id) } : m))
                                  }} className="ml-auto text-muted hover:text-red-400 transition-colors">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-secondary leading-relaxed">{c.text}</p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                  <div className="p-3 border-t border-border/50">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Write a comment..."
                        value={commentInputs[mediaItem.id] || ''}
                        onChange={(e) => setCommentInputs(prev => ({ ...prev, [mediaItem.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleComment(mediaItem) }}
                        className="flex-1 text-xs bg-surface-muted rounded-lg px-3 py-2 border border-border focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
                      />
                      <button
                        onClick={() => handleComment(mediaItem)}
                        disabled={!(commentInputs[mediaItem.id] || '').trim()}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-accent text-accent-content hover:bg-accent-hover disabled:opacity-40 transition-all"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scroll indicators */}
            {index > 0 && (
              <button
                onClick={() => scrollToIndex(index - 1)}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-10 p-2 rounded-full bg-black/20 backdrop-blur-sm text-white/60 hover:text-white transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            )}
            {index < media.length - 1 && (
              <button
                onClick={() => scrollToIndex(index + 1)}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 p-2 rounded-full bg-black/20 backdrop-blur-sm text-white/60 hover:text-white transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}

            {/* Page indicator */}
            <div className="absolute top-4 right-4 z-10 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-sm">
              <span className="text-[11px] font-semibold text-white">{index + 1} / {media.length}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
