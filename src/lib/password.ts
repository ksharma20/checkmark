// Shared password validation — used by register and password-change routes.

const WEAK_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'iloveyou', 'admin123', 'welcome1', 'letmein1', 'monkey123',
  'checkmark', 'checkmark1', 'abc12345', 'pass1234', 'test1234',
])

export function validatePassword(password: string): { valid: true } | { valid: false; error: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' }
  }
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, error: 'Please choose a stronger password' }
  }
  return { valid: true }
}
