import { db } from '../index'

export interface User {
  id: string
  email: string
  email_verified: number
  password_hash: string
  full_name: string | null
  avatar_url: string | null
  timezone: string | null
  timezone_updated_at: string | null
  timezone_confirmed: number  // 0 = unconfirmed, 1 = confirmed
  deleted_at: string | null   // soft delete — null = active
  created_at: string
  updated_at: string
}

export interface OtpCode {
  id: string
  email: string
  code: string
  purpose: string
  expires_at: string
  used: number
  attempts: number
  created_at: string
}

// Active users only (deleted_at IS NULL)
export async function getUserByEmail(email: string): Promise<User | null> {
  return db.queryOne<User>(
    'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL',
    [email]
  )
}

// Includes deactivated — used only in auth flows (check-email, login, reactivate)
export async function getUserByEmailIncludeDeleted(email: string): Promise<User | null> {
  return db.queryOne<User>('SELECT * FROM users WHERE email = ?', [email])
}

// Active users only
export async function getUserById(id: string): Promise<User | null> {
  return db.queryOne<User>(
    'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL',
    [id]
  )
}

export async function createUser(params: {
  email: string
  passwordHash: string
  fullName?: string
}): Promise<User> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO users (id, email, password_hash, full_name, email_verified)
     VALUES (?, ?, ?, ?, 1)`,
    [id, params.email, params.passwordHash, params.fullName ?? null]
  )
  return db.queryOne<User>('SELECT * FROM users WHERE id = ?', [id]) as Promise<User>
}

export async function updateUserName(userId: string, fullName: string): Promise<void> {
  await db.execute(
    `UPDATE users SET full_name = ?, updated_at = datetime('now') WHERE id = ?`,
    [fullName, userId]
  )
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await db.execute(
    `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
    [passwordHash, userId]
  )
}

export async function updateUserEmail(userId: string, newEmail: string): Promise<void> {
  const email = newEmail.toLowerCase()
  await db.execute(
    `UPDATE users SET email = ?, updated_at = datetime('now') WHERE id = ?`,
    [email, userId]
  )
  // Keep workspace_members.email in sync so invites + consent tokens still match
  await db.execute(
    `UPDATE workspace_members SET email = ? WHERE user_id = ?`,
    [email, userId]
  )
}

export async function updateUserTimezone(
  userId: string,
  timezone: string,
  confirm = false
): Promise<void> {
  await db.execute(
    `UPDATE users
     SET timezone = ?, timezone_updated_at = datetime('now'),
         timezone_confirmed = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [timezone, confirm ? 1 : 0, userId]
  )
}

// Soft delete — sets deleted_at timestamp. Data is preserved.
export async function deactivateUser(userId: string): Promise<void> {
  await db.execute(
    `UPDATE users SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [userId]
  )
}

// Reactivate — clears deleted_at. Called from the reactivate endpoint.
export async function reactivateUser(userId: string): Promise<void> {
  await db.execute(
    `UPDATE users SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?`,
    [userId]
  )
}

// ─── OTP ─────────────────────────────────────────────────────────────────────

export async function createOtp(params: {
  email: string
  code: string
  purpose: string
  expiresAt: string
}): Promise<void> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO otp_codes (id, email, code, purpose, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [id, params.email, params.code, params.purpose, params.expiresAt]
  )
}

export async function getLatestUnusedOtp(email: string, purpose: string): Promise<OtpCode | null> {
  return db.queryOne<OtpCode>(
    `SELECT * FROM otp_codes
     WHERE email = ? AND purpose = ? AND used = 0
       AND expires_at > datetime('now')
     ORDER BY created_at DESC LIMIT 1`,
    [email, purpose]
  )
}

export async function getValidOtp(email: string, code: string, purpose: string): Promise<OtpCode | null> {
  return db.queryOne<OtpCode>(
    `SELECT * FROM otp_codes
     WHERE email = ? AND code = ? AND purpose = ? AND used = 0
       AND expires_at > datetime('now')
     ORDER BY created_at DESC LIMIT 1`,
    [email, code, purpose]
  )
}

export async function incrementOtpAttempts(otpId: string): Promise<void> {
  await db.execute('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', [otpId])
}

export async function markOtpUsed(id: string): Promise<void> {
  await db.execute('UPDATE otp_codes SET used = 1 WHERE id = ?', [id])
}

export async function countRecentOtps(email: string, withinMinutes: number = 60): Promise<number> {
  const result = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM otp_codes
     WHERE email = ? AND created_at > datetime('now', ?)`,
    [email, `-${withinMinutes} minutes`]
  )
  return result?.count ?? 0
}

// ─── API Tokens ───────────────────────────────────────────────────────────────

export interface UserApiToken {
  id: string
  user_id: string
  name: string
  token_hash: string
  token_prefix: string | null
  scopes: string
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

export async function getUserApiTokens(userId: string): Promise<UserApiToken[]> {
  return db.query<UserApiToken>(
    `SELECT * FROM user_api_tokens WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`,
    [userId]
  )
}

export async function createApiToken(params: {
  userId: string
  name: string
  tokenHash: string
  tokenPrefix: string
}): Promise<UserApiToken> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO user_api_tokens (id, user_id, name, token_hash, token_prefix) VALUES (?, ?, ?, ?, ?)`,
    [id, params.userId, params.name, params.tokenHash, params.tokenPrefix]
  )
  const created = await db.queryOne<UserApiToken>('SELECT * FROM user_api_tokens WHERE id = ?', [id])
  if (!created) throw new Error('Failed to create API token')
  return created
}

export async function getApiTokensByPrefix(prefix: string): Promise<UserApiToken[]> {
  return db.query<UserApiToken>(
    `SELECT t.id, t.user_id, t.name, t.token_hash, t.scopes, t.last_used_at, t.revoked_at, t.created_at
     FROM user_api_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_prefix = ? AND t.revoked_at IS NULL AND u.deleted_at IS NULL`,
    [prefix]
  )
}

export async function revokeApiToken(tokenId: string, userId: string): Promise<void> {
  await db.execute(
    `UPDATE user_api_tokens SET revoked_at = datetime('now') WHERE id = ? AND user_id = ?`,
    [tokenId, userId]
  )
}

export async function getApiTokenByHash(tokenHash: string): Promise<UserApiToken | null> {
  return db.queryOne<UserApiToken>(
    `SELECT * FROM user_api_tokens WHERE token_hash = ? AND revoked_at IS NULL`,
    [tokenHash]
  )
}

export async function getAllActiveApiTokens(): Promise<UserApiToken[]> {
  return db.query<UserApiToken>(
    `SELECT * FROM user_api_tokens WHERE revoked_at IS NULL`
  )
}

export async function touchApiToken(tokenId: string): Promise<void> {
  await db.execute(
    `UPDATE user_api_tokens SET last_used_at = datetime('now') WHERE id = ?`,
    [tokenId]
  )
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

export async function getRateLimitCount(key: string, action: string, windowMinutes: number): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
  const row = await db.queryOne<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM rate_limit_log WHERE key = ? AND action = ? AND created_at >= ?',
    [key, action, since]
  )
  return row?.cnt ?? 0
}

export async function recordRateLimitHit(key: string, action: string): Promise<void> {
  await db.execute(
    'INSERT INTO rate_limit_log (key, action) VALUES (?, ?)',
    [key, action]
  )
}

export async function pruneRateLimitLog(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await db.execute('DELETE FROM rate_limit_log WHERE created_at < ?', [cutoff])
}
