export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024 // 5 MB
export const MAX_VIDEO_DURATION = 5 // 5 seconds

export function checkUploadSize(file: File): string | null {
  if (file.size > MAX_UPLOAD_SIZE) {
    const mb = Math.round(MAX_UPLOAD_SIZE / (1024 * 1024))
    return `Bestand is te groot (max ${mb} MB)`
  }
  return null
}

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('Could not load video'))
    }
    video.src = URL.createObjectURL(file)
  })
}

export function checkVideoDuration(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('video/')) {
      resolve(null)
      return
    }
    getVideoDuration(file).then((duration) => {
      if (duration > MAX_VIDEO_DURATION) {
        resolve(`Video is te lang (max ${MAX_VIDEO_DURATION} seconden)`)
      } else {
        resolve(null)
      }
    }).catch(() => resolve(null))
  })
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function trimVideo(
  file: File,
  startTime: number,
  endTime: number
): Promise<File> {
  const duration = endTime - startTime

  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  const objectUrl = URL.createObjectURL(file)
  video.src = objectUrl

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve()
    video.onerror = () => reject(new Error('Failed to load video for trimming'))
  })

  video.currentTime = startTime
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve()
  })

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 360
  const ctx = canvas.getContext('2d')!

  const stream = canvas.captureStream(30)
  const videoTrack = stream.getVideoTracks()[0]
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm'
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 })
  const chunks: Blob[] = []

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const done = new Promise<File>((resolve) => {
    recorder.onstop = () => {
      URL.revokeObjectURL(objectUrl)
      const blob = new Blob(chunks, { type: mimeType })
      const ext = mimeType.includes('webm') ? 'webm' : 'mp4'
      const trimmed = new File([blob], `trimmed.${ext}`, { type: mimeType, lastModified: Date.now() })
      resolve(trimmed)
    }
  })

  recorder.start()

  const drawFrame = () => {
    if (video.currentTime >= endTime || video.ended) {
      recorder.stop()
      return
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    requestAnimationFrame(drawFrame)
  }

  await video.play()
  drawFrame()

  const result = await done
  video.pause()
  return result
}

const VIDEO_MAX_DIMENSION = 640
const VIDEO_BITRATE = 700_000
const AUDIO_BITRATE = 64_000
const VIDEO_FPS = 24

export async function compressVideo(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file)

  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.src = objectUrl
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve()
    video.onerror = () => reject(new Error('Failed to load video for compression'))
  })

  const origW = video.videoWidth || 640
  const origH = video.videoHeight || 360

  let w: number, h: number
  if (origW >= origH) {
    w = Math.min(origW, VIDEO_MAX_DIMENSION)
    h = Math.round((origH / origW) * w)
  } else {
    h = Math.min(origH, VIDEO_MAX_DIMENSION)
    w = Math.round((origW / origH) * h)
  }
  if (w % 2 !== 0) w++
  if (h % 2 !== 0) h++

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const canvasStream = canvas.captureStream(VIDEO_FPS)
  const videoTrack = canvasStream.getVideoTracks()[0]

  let finalStream: MediaStream
  let audioCtx: AudioContext | null = null

  try {
    const srcAudioCtx = new AudioContext()
    const response = await fetch(objectUrl)
    const arrayBuf = await response.arrayBuffer()
    const audioBuffer = await srcAudioCtx.decodeAudioData(arrayBuf)
    await srcAudioCtx.close()

    audioCtx = new AudioContext({ sampleRate: 24000 })
    const source = audioCtx.createBufferSource()
    source.buffer = audioBuffer
    const dest = audioCtx.createMediaStreamDestination()
    source.connect(dest)
    source.start(0)

    finalStream = new MediaStream([
      videoTrack,
      ...dest.stream.getAudioTracks(),
    ])
  } catch {
    finalStream = new MediaStream([videoTrack])
  }

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'

  const recorder = new MediaRecorder(finalStream, {
    mimeType,
    videoBitsPerSecond: VIDEO_BITRATE,
    audioBitsPerSecond: AUDIO_BITRATE,
  })

  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const done = new Promise<string>((resolve, reject) => {
    recorder.onstop = () => {
      URL.revokeObjectURL(objectUrl)
      audioCtx?.close()
      const blob = new Blob(chunks, { type: mimeType })
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    }
    recorder.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      audioCtx?.close()
      reject(new Error('Video compression failed'))
    }
  })

  recorder.start()

  const drawFrame = () => {
    if (video.ended || video.paused) {
      if (recorder.state === 'recording') recorder.stop()
      return
    }
    ctx.drawImage(video, 0, 0, w, h)
    requestAnimationFrame(drawFrame)
  }

  await video.play()
  drawFrame()

  return done
}

export function playSound(url: string) {
  try {
    const audio = new Audio(url)
    audio.volume = 0.5
    audio.play().catch((err) => {
      console.warn('Failed to play sound:', err)
    })
  } catch (err) {
    console.warn('Error playing sound:', err)
  }
}

const MAX_DIMENSION = 800
const JPEG_QUALITY = 0.7

export async function compressImage(file: File): Promise<{ dataUri: string; mediaType: 'image' | 'gif' }> {
  const isGif = file.type === 'image/gif'

  if (isGif) {
    const dataUri = await fileToDataUri(file)
    return { dataUri, mediaType: 'gif' }
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height / width) * MAX_DIMENSION)
          width = MAX_DIMENSION
        } else {
          width = Math.round((width / height) * MAX_DIMENSION)
          height = MAX_DIMENSION
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      const dataUri = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
      resolve({ dataUri, mediaType: 'image' })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for compression'))
    }
    img.src = url
  })
}
