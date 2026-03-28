import { Resend } from 'resend'
import { en } from '@/locales/en'

let resend: Resend | null = null

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

const FROM = `${en.brand.name} <${en.brand.email}>`

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const client = getResend()

  if (!client) {
    // Dev fallback — print to console so the flow still works without Resend
    console.log(`\n[DEV] OTP for ${email}: ${code}\n`)
    return
  }

  await client.emails.send({
    from: FROM,
    to: email,
    subject: en.email.otp.subject(code),
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #0D1B2A; margin-bottom: 8px;">
          ${en.email.otp.heading}
        </h2>
        <p style="color: #64748B; margin-bottom: 24px;">
          ${en.email.otp.body}
        </p>
        <div style="background: #F1F5F9; border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1B4DFF;">
            ${code}
          </span>
        </div>
        <p style="color: #94A3B8; font-size: 13px;">
          ${en.email.otp.footer}
        </p>
      </div>
    `,
  })
}

export async function sendConsentEmail(params: {
  to: string
  workspaceName: string
  consentToken: string
  appUrl: string
}): Promise<void> {
  const client = getResend()
  const acceptUrl = `${params.appUrl}/consent/${params.consentToken}?action=accept`
  const declineUrl = `${params.appUrl}/consent/${params.consentToken}?action=decline`

  if (!client) {
    console.log(`\n[DEV] Consent email for ${params.to}:`)
    console.log(`  Accept:  ${acceptUrl}`)
    console.log(`  Decline: ${declineUrl}\n`)
    return
  }

  await client.emails.send({
    from: FROM,
    to: params.to,
    subject: en.email.consent.subject(params.workspaceName),
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #0D1B2A; margin-bottom: 8px;">
          ${en.email.consent.heading(params.workspaceName)}
        </h2>
        <p style="color: #64748B; margin-bottom: 8px;">
          ${en.email.consent.body(params.workspaceName)}
        </p>
        <p style="color: #64748B; margin-bottom: 24px;">
          ${en.email.consent.revoke}
        </p>
        <div style="display: flex; gap: 12px; margin-bottom: 32px;">
          <a href="${acceptUrl}" style="background: #1B4DFF; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
            Accept
          </a>
          <a href="${declineUrl}" style="background: #F1F5F9; color: #0D1B2A; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
            Decline
          </a>
        </div>
        <p style="color: #94A3B8; font-size: 13px;">
          ${en.email.consent.footer}
        </p>
      </div>
    `,
  })
}
