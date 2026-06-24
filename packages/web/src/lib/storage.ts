import { supabase } from './supabase'

const SOUNDS_BUCKET = 'sounds'

export async function uploadSound(file: File, userId: string): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() || 'mp3'
    const path = `${userId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(SOUNDS_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      if (uploadError.message.includes('bucket')) {
        const { error: createError } = await supabase.storage.createBucket(SOUNDS_BUCKET, {
          public: true,
        })
        if (createError) {
          console.error('Failed to create sounds bucket:', createError)
          return null
        }
        const { error: retryError } = await supabase.storage
          .from(SOUNDS_BUCKET)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          })
        if (retryError) {
          console.error('Failed to upload sound after bucket creation:', retryError)
          return null
        }
      } else {
        console.error('Failed to upload sound:', uploadError)
        return null
      }
    }

    const { data: publicUrl } = supabase.storage
      .from(SOUNDS_BUCKET)
      .getPublicUrl(path)

    return publicUrl?.publicUrl || null
  } catch (error) {
    console.error('Error uploading sound:', error)
    return null
  }
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
