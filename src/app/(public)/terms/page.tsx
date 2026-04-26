import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Terms of Service — checkmark",
  description:
    "Terms governing your use of checkmark, the presence intelligence platform.",
};

const S = {
  section: { maxWidth: '760px', margin: '0 auto', padding: '80px 24px' } as React.CSSProperties,
  h1: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'clamp(30px, 4vw, 44px)', lineHeight: 1.1, letterSpacing: '-1px', color: 'var(--navy)', margin: '0 0 8px' } as React.CSSProperties,
  h2: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '22px', color: 'var(--navy)', margin: '48px 0 12px', letterSpacing: '-0.3px' } as React.CSSProperties,
  body: { fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 16px' } as React.CSSProperties,
  li: { fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8 } as React.CSSProperties,
}

export default function TermsPage() {
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
        <h1 style={S.h1}>Terms of Service</h1>
        <p
          style={{ ...S.body, fontSize: "17px", color: "var(--text-primary)" }}
        >
          By using checkmark, you agree to these terms. They are written in plain
          language. If anything is unclear, email us at{" "}
          <a href="mailto:kabir.innovate@gmail.com" style={{ color: "var(--brand)" }}>
            kabir.innovate@gmail.com
          </a>
          .
        </p>

        <h2 style={S.h2}>1. Who these terms apply to</h2>
        <p style={S.body}>
          These terms apply to all users of checkmark — individuals using the
          personal timeline feature and organisation admins using workspace
          features. &quot;You&quot; refers to the person or entity using checkmark.
        </p>

        <h2 style={S.h2}>2. Your account</h2>
        <p style={S.body}>
          You are responsible for keeping your account credentials secure. Do
          not share your password. If you suspect your account has been
          compromised, change your password immediately from Settings →
          Password.
        </p>
        <p style={S.body}>
          You must provide accurate information when registering. Using a work
          email address for a personal account, or a personal email for an
          organisation account, does not violate these terms — but may affect
          how your data interacts with workspace domain verification.
        </p>

        <h2 style={S.h2}>3. Acceptable use</h2>
        <p style={S.body}>You must not use checkmark to:</p>
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
            "Submit false or spoofed check-in data (checking in remotely while claiming to be at the office).",
            "Circumvent signal verification through technical means (VPN spoofing, GPS faking).",
            "Access another user's data without their consent.",
            "Use the API in a way that degrades service for other users.",
            "Collect, scrape, or export data belonging to other users.",
          ].map((r) => (
            <li key={r} style={S.li}>
              {r}
            </li>
          ))}
        </ul>
        <p style={S.body}>
          Violations may result in immediate account termination.
        </p>

        <h2 style={S.h2}>4. Organisation admin responsibilities</h2>
        <p style={S.body}>
          If you are an organisation admin using checkmark to track employee
          attendance, you are responsible for ensuring your use complies with
          applicable local labour law, employment contracts, and employee
          privacy regulations (including GDPR, DPDPA, or equivalent).
        </p>
        <p style={S.body}>
          checkmark&apos;s consent model (opt-in, revocable) is designed to support
          compliance in most jurisdictions. However, we are not a legal
          compliance service. If you are uncertain about your legal obligations
          around employee monitoring, consult a qualified employment lawyer in
          your jurisdiction before deploying checkmark.
        </p>
        <p style={S.body}>
          You must not add members to your workspace without their knowledge.
          All members must consent before their data becomes visible to you.
        </p>

        <h2 style={S.h2}>5. Data accuracy and no warranty on signals</h2>
        <p style={S.body}>
          GPS and IP-based presence verification are probabilistic
          signals, not absolute proof. GPS can be imprecise by tens to hundreds
          of metres. IP geolocation is approximate.
        </p>
        <p style={S.body}>
          checkmark provides presence data on an{" "}
          <strong style={{ color: "var(--navy)" }}>
            &quot;as is&quot; basis
          </strong>{" "}
          without warranty of accuracy. Do not use checkmark data as the sole basis
          for disciplinary action or payroll decisions without corroborating
          evidence.
        </p>

        <h2 style={S.h2}>6. Service availability</h2>
        <p style={S.body}>
          We aim for 99.5% uptime on paid plans. We do not guarantee
          uninterrupted availability. Planned maintenance windows are announced
          24 hours in advance. We are not liable for losses caused by service
          downtime.
        </p>

        <h2 style={S.h2}>7. Limitation of liability</h2>
        <p style={S.body}>
          To the maximum extent permitted by law, checkmark is not liable for
          indirect, incidental, consequential, or punitive damages arising from
          your use of the service. Our total liability to you for any claim is
          limited to the amount you paid us in the 12 months prior to the claim.
          For free accounts, our liability is zero.
        </p>

        <h2 style={S.h2}>8. Termination</h2>
        <p style={S.body}>
          You can delete your account at any time from Settings → Danger zone.
          We can terminate your account for violations of these terms, with
          notice where feasible. Upon termination, your data enters the 30-day
          grace period described in the Privacy Policy, then is permanently
          deleted.
        </p>
        <p style={S.body}>
          If we terminate your account for cause (terms violation), you forfeit
          any remaining paid subscription period. If we terminate without cause,
          we will refund any unused prepaid fees.
        </p>

        <h2 style={S.h2}>9. Changes to these terms</h2>
        <p style={S.body}>
          We may update these terms. Material changes will be communicated by
          email at least 14 days before taking effect. Continued use of checkmark
          after the effective date constitutes acceptance of the updated terms.
        </p>

        <h2 style={S.h2}>10. Governing law</h2>
        <p style={S.body}>
          These terms are governed by the laws of India. Any disputes will be
          resolved in the courts of New Delhi, India.
        </p>

        <h2 style={S.h2}>11. Contact</h2>
        <p style={S.body}>
          For legal enquiries:{" "}
          <a href="mailto:kabir.innovate@gmail.com" style={{ color: "var(--brand)" }}>
            kabir.innovate@gmail.com
          </a>
          . For general support:{" "}
          <a href="mailto:kabir.innovate@gmail.com" style={{ color: "var(--brand)" }}>
            kabir.innovate@gmail.com
          </a>
          .
        </p>
      </section>

      <MarketingFooter />
    </div>
  );
}
