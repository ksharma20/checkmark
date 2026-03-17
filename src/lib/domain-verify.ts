import { createHmac } from 'crypto'
import dns from 'dns'

// Returns a deterministic HMAC token for a workspace+domain pair.
// Admin must add TXT record: _checkmark-verify.{domain} IN TXT "checkmark-verify={token}"
export function domainVerifyToken(workspaceId: string, domain: string): string {
  const secret = process.env.JWT_SECRET ?? 'dev-secret'
  return createHmac('sha256', secret)
    .update(`domain-verify:${workspaceId}:${domain.toLowerCase()}`)
    .digest('hex')
    .slice(0, 32)
}

// Checks DNS TXT record for the verification token.
export async function checkDnsVerification(domain: string, token: string): Promise<boolean> {
  try {
    const records = await dns.promises.resolveTxt(`_checkmark-verify.${domain}`)
    const flat = records.flat()
    return flat.some(r => r.includes(`checkmark-verify=${token}`))
  } catch {
    return false
  }
}
