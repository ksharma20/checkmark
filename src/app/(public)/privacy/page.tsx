import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import type { Metadata } from 'next'
import { en } from '@/locales/en'

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    `What CheckMark stores, which services it talks to, who can see your data, and how to reach ${en.brand.owner} about it.`,
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "CheckMark Privacy Policy",
    description:
      `What CheckMark stores, which services it talks to, who can see your data, and how to reach ${en.brand.owner} about it.`,
    url: "/privacy",
  },
};

const S = {
  section: { maxWidth: '760px', margin: '0 auto', padding: '80px 24px' } as React.CSSProperties,
  h1: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'clamp(30px, 4vw, 44px)', lineHeight: 1.1, letterSpacing: '-1px', color: 'var(--navy)', margin: '0 0 8px' } as React.CSSProperties,
  h2: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '22px', color: 'var(--navy)', margin: '48px 0 12px', letterSpacing: '-0.3px' } as React.CSSProperties,
  body: { fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 16px' } as React.CSSProperties,
  li: { fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8 } as React.CSSProperties,
  ul: { margin: '0 0 24px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' } as React.CSSProperties,
  strong: { color: 'var(--navy)' } as React.CSSProperties,
  code: { fontSize: '13px', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px' } as React.CSSProperties,
}

const CONTACT_EMAIL = en.brand.contactEmail
const OWNER = en.brand.owner

const dataCollected = [
  { field: 'Email address and full name', why: 'Your account. Used to sign you in, send one-time codes and workspace invitations, and show your name to the workspaces you belong to.' },
  { field: 'Password (bcrypt hash)', why: 'Authentication. The plaintext password is never stored.' },
  { field: 'One-time sign-in codes', why: 'Emailed to verify your address. Each code expires after 10 minutes and can be used once.' },
  { field: 'Timezone', why: 'So times are shown in your local time.' },
  { field: 'Check-in and check-out times', why: 'The core presence record, plus any note you add to it.' },
  { field: 'GPS coordinates and accuracy', why: 'Captured at check-in and check-out, and only if you grant your browser location permission. Compared against the locations your workspace has configured.' },
  { field: 'IP address and approximate IP location', why: 'Captured at check-in and check-out. Its approximate location is compared against the IP locations your workspace has configured, and the address is checked for VPN, proxy or hosting use.' },
  { field: 'Location label', why: 'A human-readable place name derived from your GPS coordinates (for example "Cyber City, Gurgaon").' },
  { field: 'Device information', why: 'Sent with a check-in: browser user agent, platform, language, screen size, processor cores and memory, network type, battery level, graphics renderer and timezone. Used as a trust signal when verifying presence.' },
  { field: 'Employee record', why: 'Entered by your workspace’s admins: contact details, date of birth, gender, marital status, blood group, addresses, emergency contact and employment details.' },
  { field: 'PAN, Aadhaar and bank account number', why: 'Part of the employee record, if your workspace records them. Encrypted field by field with AES-256-GCM. Other identifiers in the record (such as UAN, passport number, bank name and IFSC) are not field-encrypted.' },
  { field: 'Documents', why: 'Files uploaded by you or your workspace’s admins (PDF, PNG or JPEG, up to 2 MB each), such as ID proof or an offer letter. Stored in the database.' },
  { field: 'Leave, corrections and parental leave', why: 'Requests you submit and the decisions on them: dates, reasons, notes and, for parental leave, the dates of the case.' },
  { field: 'Push subscription and reminder settings', why: 'If you enable notifications, your browser’s push endpoint and keys, plus the reminder times you choose.' },
  { field: 'Notifications and announcements', why: 'The in-app notifications addressed to you and the notices your workspace posts.' },
  { field: 'Rate-limit records', why: 'Your IP address or account ID with a timestamp, recorded on sign-in and check-in attempts to prevent abuse.' },
]

const services = [
  { name: 'Resend', what: 'Delivers email (sign-in codes and workspace invitations). Receives your email address and the message.' },
  { name: 'ip-api.com', what: 'Looks up the approximate location of the IP address used for a check-in or check-out, and whether it belongs to a VPN, proxy or hosting provider. Receives that IP address. The request is made over plain HTTP.' },
  { name: 'Nominatim (OpenStreetMap)', what: 'Turns GPS coordinates into a location label. Receives the coordinates of a check-in or check-out.' },
  { name: 'Your browser’s push service', what: 'If you enable notifications, reminders are delivered through the push service your browser vendor runs (for example Google, Mozilla or Apple).' },
  { name: 'Google Fonts', what: 'The site’s fonts are loaded from Google’s servers, which receive your IP address and browser details when a page loads.' },
  { name: 'Hosting and database providers', what: 'The hosted instance runs on third-party cloud infrastructure, which stores and processes the data above on our behalf.' },
]

const cookies = [
  { name: 'cm_session', what: 'Keeps you signed in. HttpOnly, expires after 30 days.' },
  { name: 'cm_otp_ok', what: 'Proves you verified a one-time code during sign-up. HttpOnly, expires after 15 minutes.' },
  { name: 'cm_ui', what: 'Tells public pages you are signed in, so they can show "Dashboard". Expires with your session.' },
  { name: 'cm_ws', what: 'Remembers which workspace you last selected.' },
  { name: 'cm_nav', what: 'Remembers whether the admin sidebar is collapsed.' },
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
          Effective date: 17 September 2026 · Last updated: 17 September 2026
        </p>
        <h1 style={S.h1}>Privacy Policy</h1>
        <p
          style={{ ...S.body, fontSize: "17px", color: "var(--text-primary)" }}
        >
          CheckMark is a simple open-source project by {OWNER}{" "}
          (Gurgaon, India). This policy explains what the application stores,
          which outside services it talks to, who can see your data, and how to
          reach us. It is written in plain language.
        </p>

        <h2 style={S.h2}>Who this policy covers</h2>
        <p style={S.body}>
          {OWNER} operates{" "}
          <strong style={S.strong}>one</strong> instance of CheckMark, at{" "}
          <code style={S.code}>{en.brand.domain}</code>. This
          policy applies to that hosted instance only.
        </p>
        <p style={S.body}>
          CheckMark is open source, so anyone can run their own copy. A
          self-hosted instance is operated by whoever deployed it - usually your
          employer. They decide where it runs, how long data is kept and who can
          access it, and {OWNER} has no access to it. If you use a
          self-hosted instance, direct your privacy questions to its operator.
        </p>

        <h2 style={S.h2}>1. What data is stored</h2>
        <p style={S.body}>
          The table below lists what the application stores and why. Some of it
          you enter yourself; some is entered by the admins of a workspace you
          belong to.
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
                  Data
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
                  Why it is stored
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
          Location is captured only when you check in or check out - never in
          the background. The application does not read your contacts,
          calendar, messages or other apps, does not use advertising or
          analytics trackers, and we do not sell your data.
        </p>

        <h2 style={S.h2}>2. Services CheckMark talks to</h2>
        <p style={S.body}>
          To work, the hosted instance sends some data to these outside
          services:
        </p>
        <ul style={S.ul}>
          {services.map((s) => (
            <li key={s.name} style={S.li}>
              <strong style={S.strong}>{s.name}</strong> - {s.what}
            </li>
          ))}
        </ul>

        <h2 style={S.h2}>3. Who can see your data</h2>
        <p style={S.body}>
          <strong style={S.strong}>You</strong> - your own presence history is
          always visible to you at <code style={S.code}>/me/timeline</code>.
        </p>
        <p style={S.body}>
          <strong style={S.strong}>Workspace admins</strong> - people holding
          the relevant permissions in a workspace you belong to can see your
          presence events for that workspace, and the employee record,
          documents and requests that workspace keeps about you. What each
          person can see depends on the role the workspace has given them. The
          workspaces you belong to are listed at{" "}
          <code style={S.code}>/me/orgs</code>.
        </p>
        <p style={S.body}>
          <strong style={S.strong}>{OWNER}</strong> - as the operator
          of the hosted instance we have technical access to its database. We
          look at individual data only when needed to run the service, fix a
          problem, or act on a request you have made.
        </p>
        <p style={S.body}>
          <strong style={S.strong}>No one else</strong>, apart from the services
          listed in section 2 for the purpose described there.
        </p>

        <h2 style={S.h2}>4. How long data is kept</h2>
        <p style={S.body}>
          Presence events are treated as a permanent record: the application
          does not edit or delete them, and there is no automatic expiry.
          Workspaces, employee records, holidays and similar records are
          archived rather than erased when removed.
        </p>
        <p style={S.body}>
          You can deactivate your account from{" "}
          <code style={S.code}>/me/settings</code>. Deactivation hides your
          account but keeps its data; signing in again reactivates it. The
          application has no self-serve permanent deletion - to ask for your
          data on the hosted instance to be erased, email us (see section 9).
          Where a workspace is required to keep records about you, we may need
          to discuss that with the workspace first.
        </p>
        <p style={S.body}>
          When a document is deleted, its file is removed from storage. Sign-in
          codes expire after 10 minutes.
        </p>

        <h2 style={S.h2}>5. Workspace membership</h2>
        <p style={S.body}>
          If an organisation invites you to its workspace, you receive an email
          link and must accept before you become a member. If an organisation
          has verified its email domain (e.g.{" "}
          <code style={S.code}>acmecorp.com</code>) and you register with a
          matching address, you are enrolled as a member automatically.
        </p>
        <p style={S.body}>
          You can leave a workspace at any time from{" "}
          <code style={S.code}>/me/orgs</code>. Leaving stops that workspace
          from seeing your presence events. The employee record and documents
          the workspace created are part of its own records and stay with it.
        </p>

        <h2 style={S.h2}>6. Your choices</h2>
        <ul style={S.ul}>
          {[
            "Access: see your presence history at /me/timeline, and your leave, documents and profile under /me.",
            "Correction: change your name, email, password and timezone from /me/settings. Ask your workspace admins to correct your employee record.",
            "Location: you can decline your browser's location permission. An office check-in needs it; a remote check-in records your IP address and device information but no GPS.",
            "Notifications: turn push notifications off in your browser, or clear your reminder times in /me/settings.",
            "Leaving: leave any workspace from /me/orgs.",
            "Copies and erasure: email us to ask for a copy of your data on the hosted instance, or for it to be erased.",
          ].map((r) => (
            <li key={r} style={S.li}>
              {r}
            </li>
          ))}
        </ul>
        <p style={S.body}>
          You may have further rights under the data protection law that
          applies to you. Email us and we will do our best to help.
        </p>

        <h2 style={S.h2}>7. Cookies and browser storage</h2>
        <p style={S.body}>
          CheckMark uses only first-party cookies needed for the application to
          work - none for advertising or tracking:
        </p>
        <ul style={S.ul}>
          {cookies.map((c) => (
            <li key={c.name} style={S.li}>
              <code style={S.code}>{c.name}</code> - {c.what}
            </li>
          ))}
        </ul>
        <p style={S.body}>
          The app also keeps a few small values in your browser&apos;s local
          storage (for example, whether you dismissed the install prompt), and
          registers a service worker so it can receive push notifications.
        </p>

        <h2 style={S.h2}>8. Security</h2>
        <p style={S.body}>
          Passwords are hashed with bcrypt (cost factor 12). Sessions are JWTs
          signed with HS256, kept in an HttpOnly, SameSite=Lax cookie that is
          marked Secure on the hosted instance, and revoked when you sign out.
          PAN, Aadhaar and bank account numbers are encrypted with AES-256-GCM.
          API tokens are stored as hashes, with only a short prefix kept in clear to look them up. The hosted instance is served
          over HTTPS.
        </p>
        <p style={S.body}>
          No system is perfectly secure. If you find a vulnerability, please
          report it privately as described in the project&apos;s{" "}
          <a
            href="https://github.com/ksharma20/checkmark/blob/main/SECURITY.md"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--brand)" }}
          >
            security policy
          </a>
          .
        </p>

        <h2 style={S.h2}>9. Changes and contact</h2>
        <p style={S.body}>
          If this policy changes, we will update this page and the date at the
          top.
        </p>
        <p style={S.body}>
          For privacy questions or requests about the hosted instance, email{" "}
          {OWNER} at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--brand)" }}>
            {CONTACT_EMAIL}
          </a>
          . CheckMark is maintained on a best-effort basis, so a reply may take a
          few days.
        </p>
      </section>

      <MarketingFooter />
    </div>
  );
}
