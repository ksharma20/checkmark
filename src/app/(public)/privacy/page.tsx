import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How CheckMark collects, uses, and protects your presence data.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "CheckMark Privacy Policy",
    description: "How CheckMark collects, uses, and protects your presence data.",
    url: "/privacy",
  },
};

const S = {
  section: { maxWidth: '760px', margin: '0 auto', padding: '80px 24px' } as React.CSSProperties,
  h1: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'clamp(30px, 4vw, 44px)', lineHeight: 1.1, letterSpacing: '-1px', color: 'var(--navy)', margin: '0 0 8px' } as React.CSSProperties,
  h2: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '22px', color: 'var(--navy)', margin: '48px 0 12px', letterSpacing: '-0.3px' } as React.CSSProperties,
  body: { fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 16px' } as React.CSSProperties,
  li: { fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8 } as React.CSSProperties,
}

const dataCollected = [
  { field: 'Email address', why: 'Account creation, OTP verification, consent invitations.' },
  { field: 'Full name', why: 'Displayed to workspace admins you consent to share with.' },
  { field: 'Password (bcrypt hash)', why: 'Authentication. The plaintext password is never stored.' },
  { field: 'Check-in timestamp (UTC)', why: 'Core presence record. When you tapped "I\'m here".' },
  { field: 'Check-out timestamp (UTC)', why: 'When you tapped "I\'m leaving". Null if not checked out.' },
  { field: 'GPS coordinates (lat, lng, accuracy)', why: 'Captured only when you grant browser GPS permission at check-in.' },
  { field: 'IP address', why: 'Captured server-side at check-in. Used for IP-geofence signal matching.' },
  { field: 'Timezone', why: 'Detected from your browser and stored so timestamps display correctly in your local time.' },
  { field: 'Location label', why: 'Human-readable name derived from GPS coordinates (e.g. "Thapar University, Patiala"). Generated once at check-in, never updated.' },
]

export default function PrivacyPage() {
  return (
    <div style={{ background: "var(--surface-0)" }}>
      <MarketingNav />

      <section style={S.section}>
        <p
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            margin: "0 0 12px",
            fontFamily: "DM Sans, sans-serif",
          }}
        >
          Effective date: 17 March 2026 · Last updated: 17 March 2026
        </p>
        <h1 style={S.h1}>Privacy Policy</h1>
        <p
          style={{ ...S.body, fontSize: "17px", color: "var(--text-primary)" }}
        >
          checkmark is a presence intelligence platform. This policy explains what
          data we collect, why we collect it, who can see it, and your rights
          over it. We have written it in plain language - not legal boilerplate.
        </p>

        <h2 style={S.h2}>1. What data we collect</h2>
        <p style={S.body}>
          We only collect data that is necessary for checkmark to function. The
          table below lists every field we store, and why.
        </p>
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            marginBottom: "24px",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            <thead>
              <tr style={{ background: "var(--surface-1)" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "12px 16px",
                    fontWeight: 600,
                    color: "var(--navy)",
                    borderBottom: "1px solid var(--border)",
                    width: "40%",
                  }}
                >
                  Data field
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "12px 16px",
                    fontWeight: 600,
                    color: "var(--navy)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  Why we collect it
                </th>
              </tr>
            </thead>
            <tbody>
              {dataCollected.map((d, i) => (
                <tr
                  key={d.field}
                  style={{
                    background:
                      i % 2 === 0 ? "var(--surface-0)" : "var(--surface-1)",
                  }}
                >
                  <td
                    style={{
                      padding: "11px 16px",
                      color: "var(--text-primary)",
                      fontWeight: 500,
                      borderBottom:
                        i < dataCollected.length - 1
                          ? "1px solid var(--border)"
                          : "none",
                      verticalAlign: "top",
                    }}
                  >
                    {d.field}
                  </td>
                  <td
                    style={{
                      padding: "11px 16px",
                      color: "var(--text-secondary)",
                      borderBottom:
                        i < dataCollected.length - 1
                          ? "1px solid var(--border)"
                          : "none",
                      verticalAlign: "top",
                    }}
                  >
                    {d.why}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={S.body}>
          We do not collect location data in the background. We do not read your
          contacts, calendar, messages, or any other app data. We do not use
          advertising trackers or sell your data to third parties.
        </p>

        <h2 style={S.h2}>2. Who can see your data</h2>
        <p style={S.body}>
          <strong style={{ color: "var(--navy)" }}>You</strong> - always. Your
          full presence history is visible only to you at{" "}
          <code
            style={{
              fontSize: "13px",
              background: "var(--surface-2)",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            /me/timeline
          </code>
          .
        </p>
        <p style={S.body}>
          <strong style={{ color: "var(--navy)" }}>Workspace admins</strong> —
          only for workspaces you have explicitly consented to share with. You
          can see every workspace that has access to your data at{" "}
          <code
            style={{
              fontSize: "13px",
              background: "var(--surface-2)",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            /me/orgs
          </code>
          . You can revoke any organisation&apos;s access instantly from that
          page.
        </p>
        <p style={S.body}>
          <strong style={{ color: "var(--navy)" }}>checkmark staff</strong> - we do
          not access individual user data unless you explicitly ask us for
          support, and only for the purpose of resolving your issue.
        </p>
        <p style={S.body}>
          <strong style={{ color: "var(--navy)" }}>No one else</strong> - we do
          not share, sell, or rent your data to any third party. We do not use
          it for advertising.
        </p>

        <h2 style={S.h2}>3. How long we keep your data</h2>
        <p style={S.body}>
          Presence events (check-ins) are retained for{" "}
          <strong style={{ color: "var(--navy)" }}>7 years</strong> from the
          date they were created. This is consistent with many countries&apos;
          employment record-keeping requirements. After 7 years, records are
          permanently and automatically deleted.
        </p>
        <p style={S.body}>
          You can request earlier deletion of your data from your account
          settings at{" "}
          <code
            style={{
              fontSize: "13px",
              background: "var(--surface-2)",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            /me/settings
          </code>
          . Deletion is permanent and cannot be undone.
        </p>
        <p style={S.body}>
          When you deactivate your account, your data enters a 30-day grace
          period. You can reactivate within 30 days and recover your full
          history. After 30 days, your account and all associated data are
          permanently deleted.
        </p>

        <h2 style={S.h2}>4. Consent and workspace membership</h2>
        <p style={S.body}>
          If an organisation invites you to their workspace, you will receive a
          consent link by email. You must explicitly accept before your presence
          data becomes visible to that organisation&apos;s admin.
        </p>
        <p style={S.body}>
          If your organisation has verified their email domain (e.g.{" "}
          <code
            style={{
              fontSize: "13px",
              background: "var(--surface-2)",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            acmecorp.com
          </code>
          ) and you register with a matching email address, you will be
          automatically enrolled as a member. Your check-in data becomes visible
          to that organisation&apos;s admin. You can revoke this at any time
          from{" "}
          <code
            style={{
              fontSize: "13px",
              background: "var(--surface-2)",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            /me/orgs
          </code>
          .
        </p>

        <h2 style={S.h2}>5. Your rights</h2>
        <ul
          style={{
            margin: "0 0 24px",
            paddingLeft: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {[
            "Access: download your full history as CSV from /me/timeline at any time.",
            "Correction: edit your name, email, or timezone from /me/settings.",
            'Deletion: request account deletion from /me/settings → "Delete account".',
            "Portability: your exported CSV is in standard format, importable anywhere.",
            "Revocation: remove any organisation's access instantly from /me/orgs.",
            "Objection: if you believe your data has been accessed inappropriately, contact us.",
          ].map((r) => (
            <li key={r} style={S.li}>
              {r}
            </li>
          ))}
        </ul>

        <h2 style={S.h2}>6. Security</h2>
        <p style={S.body}>
          Passwords are hashed with bcrypt (cost factor 12). Session tokens are
          JWTs signed with HS256, stored in HttpOnly, Secure, SameSite=Strict
          cookies. Sessions are invalidated on logout. All data is transmitted
          over HTTPS. API access requires a valid session or API token.
        </p>

        <h2 style={S.h2}>7. Contact</h2>
        <p style={S.body}>
          For data requests, corrections, or privacy concerns, email us at{" "}
          <a href="mailto:kabir.innovate@gmail.com" style={{ color: "var(--brand)" }}>
            kabir.innovate@gmail.com
          </a>
          . We respond to all privacy requests within 48 hours.
        </p>
      </section>

      <MarketingFooter />
    </div>
  );
}
