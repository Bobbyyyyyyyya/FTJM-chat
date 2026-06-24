import CryptoJS from 'crypto-js'

const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY
if (!SECRET_KEY) {
  throw new Error('VITE_ENCRYPTION_KEY is required. Set it in your .env.local file')
}
export const GC_PREFIX = 'gc:'

export function encryptText(plaintext: string) {
  const encrypted = CryptoJS.AES.encrypt(plaintext, SECRET_KEY).toString()
  return `${GC_PREFIX}${encrypted}`
}

const LEGACY_KEY = 'app-chat-secret-key-2024'

export function decryptText(ciphertext: string) {
  if (!ciphertext) return ciphertext

  const payload = ciphertext.startsWith(GC_PREFIX)
    ? ciphertext.slice(GC_PREFIX.length)
    : ciphertext

  const tryDecrypt = (key: string) => {
    try {
      const bytes = CryptoJS.AES.decrypt(payload, key)
      const decrypted = bytes.toString(CryptoJS.enc.Utf8)
      return decrypted || null
    } catch {
      return null
    }
  }

  let decrypted = tryDecrypt(SECRET_KEY)
  if (!decrypted && SECRET_KEY !== LEGACY_KEY) {
    decrypted = tryDecrypt(LEGACY_KEY)
  }
  return decrypted || ciphertext
}

export function maybeDecryptText(text: string, isEncrypted = false) {
  if (!text) return text
  if (isEncrypted || text.startsWith(GC_PREFIX)) {
    return decryptText(text)
  }
  return text
}
