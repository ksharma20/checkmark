// AES-256-GCM field-level encryption for sensitive employee data.
// Storage format: "<iv_base64>:<authTag_base64>:<ciphertext_base64>"
// Key source: FIELD_ENCRYPTION_KEY env var — 64-char hex string (32 bytes).
// Audit logs must never include decrypted values.

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const SEPARATOR = ':'

function resolveKey(): Buffer {
  const hex = process.env.FIELD_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return Buffer.from(hex, 'hex')
}

export function encryptField(plaintext: string): string {
  const key = resolveKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(SEPARATOR)
}

export function decryptField(encrypted: string): string {
  const key = resolveKey()
  const parts = encrypted.split(SEPARATOR)
  if (parts.length !== 3) throw new Error('decryptField: malformed ciphertext — expected iv:authTag:ciphertext')
  const [ivB64, authTagB64, ciphertextB64] = parts
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]).toString('utf8')
}

// Convenience wrappers that treat null/undefined/empty-string as null.
export function encryptFieldOrNull(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  return encryptField(value)
}

export function decryptFieldOrNull(encrypted: string | null | undefined): string | null {
  if (encrypted == null) return null
  return decryptField(encrypted)
}
