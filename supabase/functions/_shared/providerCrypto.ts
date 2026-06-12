const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function importKey(secret: string) {
  const keyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(secret))
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptProviderKey(plainText: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await importKey(secret)
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plainText),
  )

  return {
    ciphertext: toBase64(new Uint8Array(cipherBuffer)),
    iv: toBase64(iv),
  }
}

export async function decryptProviderKey(ciphertext: string, iv: string, secret: string) {
  const key = await importKey(secret)
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext),
  )

  return decoder.decode(plainBuffer)
}

export function maskProviderKey(ciphertextPresent: boolean) {
  return ciphertextPresent ? '已设置' : '未设置'
}
