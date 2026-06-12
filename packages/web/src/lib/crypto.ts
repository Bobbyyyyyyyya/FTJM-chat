import CryptoJS from 'crypto-js'

const SECRET_KEY = 'app-chat-secret-key-2024'
export const GC_PREFIX = 'gc:'

export function encryptText(plaintext: string) {
  const encrypted = CryptoJS.AES.encrypt(plaintext, SECRET_KEY).toString()
  return `${GC_PREFIX}${encrypted}`
}

export function decryptText(ciphertext: string) {
  if (!ciphertext) return ciphertext

  const payload = ciphertext.startsWith(GC_PREFIX)
    ? ciphertext.slice(GC_PREFIX.length)
    : ciphertext

  try {
    const bytes = CryptoJS.AES.decrypt(payload, SECRET_KEY)
    const decrypted = bytes.toString(CryptoJS.enc.Utf8)
    return decrypted || ciphertext
  } catch (error) {
    console.error('Failed to decrypt text:', error)
    return ciphertext
  }
}

export function maybeDecryptText(text: string, isEncrypted = false) {
  if (!text) return text
  if (isEncrypted || text.startsWith(GC_PREFIX)) {
    return decryptText(text)
  }
  return text
}
