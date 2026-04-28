// Shared slug validation - used by check-slug, workspace creation, and org registration.
// Single source of truth so all three paths enforce identical rules.

export const RESERVED_SLUGS = new Set([
  'api', 'admin', 'app', 'auth', 'login', 'logout', 'register', 'signup',
  'me', 'ws', 'workspace', 'workspaces', 'dashboard', 'settings', 'billing',
  'help', 'support', 'docs', 'legal', 'privacy', 'terms', 'status',
  'www', 'mail', 'smtp', 'ftp', 'ssh', 'cdn', 'static', 'assets',
  'health', 'ping', 'metrics', 'internal', 'system', 'root', 'null', 'undefined',
  'join', 'consent', 'verify', 'about', 'pricing', 'open-source', 'new',
])

// 3–50 chars, lowercase letters/digits/hyphens, no leading/trailing hyphen
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{1,2}$/

export function validateSlug(slug: string): { valid: true } | { valid: false; error: string } {
  if (!slug) return { valid: false, error: 'URL handle is required' }
  if (slug.length < 3) return { valid: false, error: 'URL handle must be at least 3 characters' }
  if (slug.length > 50) return { valid: false, error: 'URL handle must be 50 characters or fewer' }
  if (!SLUG_RE.test(slug)) {
    return { valid: false, error: 'Only lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen.' }
  }
  if (RESERVED_SLUGS.has(slug)) return { valid: false, error: 'This URL handle is reserved' }
  return { valid: true }
}
