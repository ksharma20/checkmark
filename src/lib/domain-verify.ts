import { createHmac } from 'crypto'
import dns from 'dns'
import { DNS_VERIFY_SUBDOMAIN, DNS_VERIFY_VALUE_PREFIX } from '@/lib/constants'

// Returns a deterministic HMAC token for a workspace+domain pair.
// Admin must add TXT record: {DNS_VERIFY_SUBDOMAIN}.{domain} IN TXT "{DNS_VERIFY_VALUE_PREFIX}={token}"
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
    const records = await dns.promises.resolveTxt(`${DNS_VERIFY_SUBDOMAIN}.${domain}`)
    const flat = records.flat()
    return flat.some(r => r.includes(`${DNS_VERIFY_VALUE_PREFIX}=${token}`))
  } catch {
    return false
  }
}
