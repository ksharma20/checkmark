import { db } from '../index'

// ─── JWT Revocation (Node.js only — not imported by Edge middleware) ──────────

export async function revokeToken(jti: string, expiresAt: string): Promise<void> {
  await db.execute(
    `INSERT OR IGNORE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)`,
    [jti, expiresAt]
  )
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const row = await db.queryOne<{ jti: string }>(
    `SELECT jti FROM revoked_tokens WHERE jti = ?`,
    [jti]
  )
  return row !== null
}

/** Purge expired entries — call periodically to keep the table small. */
export async function pruneRevokedTokens(): Promise<void> {
  await db.execute(
    `DELETE FROM revoked_tokens WHERE expires_at < datetime('now')`
  )
}
