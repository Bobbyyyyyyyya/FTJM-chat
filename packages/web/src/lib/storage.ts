export const MAX_UPLOAD_SIZE = 4 * 1024 * 1024 // 4 MB

export function checkUploadSize(file: File): string | null {
  if (file.size > MAX_UPLOAD_SIZE) {
    const mb = Math.round(MAX_UPLOAD_SIZE / (1024 * 1024))
    return `Bestand is te groot (max ${mb} MB)`
  }
  return null
}

export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
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
