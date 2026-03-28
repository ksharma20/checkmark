// Technical brand identifiers — single source of truth for things that are
// identifiers (not display strings) and appear across multiple files.
// Display strings (brand name, taglines, email copy) live in src/locales/en.ts.

// ─── Auth cookies ─────────────────────────────────────────────────────────────
export const COOKIE_SESSION = 'cm_session'
export const COOKIE_OTP = 'cm_otp_ok'

// ─── Domain verification ──────────────────────────────────────────────────────
// DNS TXT record: _checkmark-verify.{domain}  IN TXT  "checkmark-verify={token}"
export const DNS_VERIFY_SUBDOMAIN = '_checkmark-verify'
export const DNS_VERIFY_VALUE_PREFIX = 'checkmark-verify'

// ─── Database ─────────────────────────────────────────────────────────────────
export const DB_FILE = 'checkmark.db'

// ─── HTTP ─────────────────────────────────────────────────────────────────────
export const GEO_USER_AGENT = 'CheckMark/1.0 (presence-platform)'

// ─── Browser storage / notification tags (CheckinButtons) ────────────────────
export const STALE_NOTIF_KEY = 'cm_stale_notif_count'
export const STALE_NOTIF_EVENT_KEY = 'cm_stale_notif_event'
export const NOTIF_TAG_STALE = 'cm-stale-checkin'
export const NOTIF_TAG_AUTO_CHECKOUT = 'cm-auto-checkout'
