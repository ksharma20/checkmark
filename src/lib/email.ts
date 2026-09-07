import { Resend } from 'resend'
import { en } from '@/locales/en'

let resend: Resend | null = null

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

// Allow RESEND_FROM_EMAIL env override - needed when using Resend's shared
// domain (onboarding@resend.dev) before a custom domain is verified.
const FROM = process.env.RESEND_FROM_EMAIL
  ? `${en.brand.name} <${process.env.RESEND_FROM_EMAIL}>`
  : `${en.brand.name} <${en.brand.email}>`

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const client = getResend()

  if (!client) {
    // Dev fallback - print to console so the flow still works without Resend
    console.log(`\n[DEV] OTP for ${email}: ${code}\n`)
    return
  }

  await client.emails.send({
    from: FROM,
    to: email,
    subject: en.email.otp.subject(code),
    html: `
      <div style="background: #F8FAFC; padding: 40px 16px; font-family: 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 480px; margin: 0 auto;">

          <!-- Logo -->
          <div style="text-align: center; margin-bottom: 32px;">
            <span style="font-size: 22px; font-weight: 800; color: #1B4DFF; letter-spacing: -0.5px;">
              CheckMark
            </span>
          </div>

          <!-- Card -->
          <div style="background: #ffffff; border-radius: 16px; padding: 40px 36px; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">

            <h2 style="font-size: 20px; font-weight: 700; color: #0D1B2A; margin: 0 0 8px 0;">
              ${en.email.otp.heading}
            </h2>
            <p style="color: #64748B; font-size: 14px; line-height: 1.6; margin: 0 0 28px 0;">
              ${en.email.otp.body}
            </p>

            <!-- OTP block -->
            <div style="background: #F8FAFC; border: 1.5px solid #1B4DFF; border-radius: 12px; padding: 28px 24px; text-align: center; margin-bottom: 28px;">
              <span style="font-family: 'Courier New', monospace; font-size: 40px; font-weight: 800; letter-spacing: 10px; color: #1B4DFF;">
                ${code}
              </span>
            </div>

            <p style="color: #94A3B8; font-size: 13px; line-height: 1.5; margin: 0;">
              ${en.email.otp.footer}
            </p>
          </div>

          <!-- Footer -->
          <p style="text-align: center; color: #94A3B8; font-size: 12px; margin-top: 28px;">
            © ${new Date().getFullYear()} CheckMark · You received this because a sign-in was requested for your account.
          </p>
        </div>
      </div>
    `,
  })
}

export async function sendConsentEmail(params: {
  to: string
  workspaceName: string
  consentToken: string
  appUrl: string
  /**
   * The name on their employee record, when one was filled in before the
   * invitation went out - which is the normal order now that People has an
   * Add employee flow rather than a bare email box.
   */
  recipientName?: string | null
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
      <div style="background: #F8FAFC; padding: 40px 16px; font-family: 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 480px; margin: 0 auto;">

          <!-- Logo -->
          <div style="text-align: center; margin-bottom: 32px;">
            <span style="font-size: 22px; font-weight: 800; color: #1B4DFF; letter-spacing: -0.5px;">
              CheckMark
            </span>
          </div>

          <!-- Card -->
          <div style="background: #ffffff; border-radius: 16px; padding: 40px 36px; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">

            <!-- Workspace badge -->
            <div style="display: inline-block; background: #F8FAFC; border: 1px solid #1B4DFF; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; color: #1B4DFF; margin-bottom: 20px; letter-spacing: 0.04em; text-transform: uppercase;">
              Workspace Invite
            </div>

            <h2 style="font-size: 20px; font-weight: 700; color: #0D1B2A; margin: 0 0 12px 0;">
              ${params.recipientName
                ? en.email.consent.headingNamed(params.recipientName, params.workspaceName)
                : en.email.consent.heading(params.workspaceName)}
            </h2>
            <p style="color: #64748B; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
              ${en.email.consent.body(params.workspaceName)}
            </p>
            <p style="color: #64748B; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
              ${en.email.consent.revoke}
            </p>
            ${params.recipientName ? `<p style="color: #64748B; font-size: 14px; line-height: 1.6; margin: 0 0 32px 0;">${en.email.consent.profileReady}</p>` : '<div style="height: 22px;"></div>'}

            <!-- Action buttons -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
              <tr>
                <td style="padding-right: 12px;">
                  <a href="${acceptUrl}"
                     style="display: inline-block; background: #1B4DFF; color: #ffffff; padding: 13px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 700; letter-spacing: 0.02em;">
                    ✓ &nbsp;Accept Invite
                  </a>
                </td>
                <td>
                  <a href="${declineUrl}"
                     style="display: inline-block; background: #ffffff; color: #64748B; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; border: 1.5px solid #E2E8F0; letter-spacing: 0.02em;">
                    Decline
                  </a>
                </td>
              </tr>
            </table>

            <p style="color: #94A3B8; font-size: 13px; line-height: 1.5; margin: 0;">
              ${en.email.consent.footer}
            </p>
          </div>

          <!-- Footer -->
          <p style="text-align: center; color: #94A3B8; font-size: 12px; margin-top: 28px;">
            © ${new Date().getFullYear()} CheckMark · You received this because your email was added to a workspace.
          </p>
        </div>
      </div>
    `,
  })
}
