import Link from 'next/link'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "CheckMark for You - Your presence record, forever",
  description:
    "CheckMark is free for individuals, forever. Own your work history and consent to which organisations can see your presence data.",
  alternates: {
    canonical: "/for-you",
  },
  openGraph: {
    title: "CheckMark for You - Your presence record, forever",
    description:
      "Own your work history with CheckMark. Free for individuals, forever.",
    url: "/for-you",
  },
};

const S = {
  section: { maxWidth: '1100px', margin: '0 auto', padding: '80px 24px' } as React.CSSProperties,
  label: { fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--brand)', fontFamily: 'DM Sans, sans-serif' },
  h1: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'clamp(34px, 5vw, 52px)', lineHeight: 1.1, letterSpacing: '-1.2px', color: 'var(--navy)', margin: 0 } as React.CSSProperties,
  h2: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'clamp(26px, 4vw, 38px)', lineHeight: 1.15, letterSpacing: '-0.8px', color: 'var(--navy)', margin: 0 } as React.CSSProperties,
  body: { fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 } as React.CSSProperties,
  sub: { fontSize: 'clamp(15px, 2vw, 18px)', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 } as React.CSSProperties,
  card: { background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px' } as React.CSSProperties,
  btnPrimary: { height: '50px', padding: '0 28px', background: 'var(--brand)', color: '#fff', borderRadius: 'var(--radius-md)', fontSize: '15px', fontWeight: 600, fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' } as React.CSSProperties,
}

const features = [
  {
    icon: "✅",
    title: "Tap once when you arrive",
    body: "Check in at the office, a client site, a coffee shop - anywhere. Check out when you leave. One tap each way.",
  },
  {
    icon: "📅",
    title: "See your complete history",
    body: "Every check-in, every location, every day. Month-by-month view. Search by date or location.",
  },
  {
    icon: "⏱️",
    title: "Time at each location",
    body: "See exactly how many hours you spent at each place. Your personal time log, always available.",
  },
  {
    icon: "🔒",
    title: "Your data, your rules",
    body: "You control which organisations see your data. Revoke access at any time with one click from your settings.",
  },
  {
    icon: "📤",
    title: "Export any time",
    body: "Download your full history as a CSV whenever you need it. Your data is never locked in.",
  },
  {
    icon: "💸",
    title: "Free forever",
    body: "No subscription. No trial period. checkmark is free for individuals, forever. Your employer pays for team features - not you.",
  },
];

const privacyFacts = [
  { q: 'What we store', a: 'Your check-in time, check-out time, GPS coordinates (if you share them), and IP address. That\'s it.' },
  { q: 'What we don\'t store', a: 'We don\'t track your location in the background. We don\'t read your contacts, calendar, or any other app data. We only record what you explicitly submit.' },
  { q: 'Who can see your data', a: 'Only you - and any organisation you explicitly consent to share with. You can see every organisation that has access and revoke it instantly.' },
  { q: 'How long we keep it', a: 'Your data is retained for 7 years from the date it was created, then permanently deleted. You can request deletion earlier from your account settings.' },
]

export default function ForYouPage() {
  return (
    <div style={{ background: "var(--surface-0)" }}>
      <MarketingNav />

      {/* Hero */}
      <section
        style={{ background: "var(--surface-1)", padding: "80px 0 64px" }}
      >
        <div style={S.section}>
          <p style={S.label}>For Individuals</p>
          <h1 style={{ ...S.h1, marginTop: "12px", marginBottom: "20px" }}>
            Your work history.
            <br />
            Owned by you.
          </h1>
          <p style={{ ...S.sub, maxWidth: "540px", marginBottom: "12px" }}>
            checkmark records where you were and for how long. Free forever. No
            employer required.
          </p>
          <p
            style={{
              display: "inline-block",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--brand)",
              background: "#1B4DFF10",
              padding: "6px 16px",
              borderRadius: "20px",
              marginBottom: "32px",
            }}
          >
            Free forever - no credit card required
          </p>
          <br />
          <Link href="/login" style={S.btnPrimary}>
            Create your free account
          </Link>
        </div>
      </section>

      {/* What you get */}
      <section style={{ padding: "80px 0" }}>
        <div style={S.section}>
          <div style={{ marginBottom: "48px" }}>
            <p style={S.label}>What you get</p>
            <h2 style={{ ...S.h2, marginTop: "12px" }}>
              Everything you need. Nothing you don&apos;t.
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            {features.map((f) => (
              <div
                key={f.title}
                style={{
                  ...S.card,
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "28px" }}>{f.icon}</span>
                <p
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontWeight: 600,
                    fontSize: "16px",
                    color: "var(--navy)",
                    margin: 0,
                  }}
                >
                  {f.title}
                </p>
                <p style={S.body}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Works with any employer */}
      <section style={{ background: "var(--surface-1)", padding: "80px 0" }}>
        <div style={S.section}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "48px",
              alignItems: "center",
            }}
          >
            <div>
              <p style={S.label}>Works with any employer</p>
              <h2 style={{ ...S.h2, marginTop: "12px", marginBottom: "20px" }}>
                Your data follows you, not your employer.
              </h2>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <p style={S.body}>
                  <strong style={{ color: "var(--navy)" }}>
                    If your company uses checkmark:
                  </strong>{" "}
                  your personal check-ins automatically count toward your
                  organisation&apos;s attendance records. No double check-in.
                </p>
                <p style={S.body}>
                  <strong style={{ color: "var(--navy)" }}>
                    If they don&apos;t:
                  </strong>{" "}
                  your data is still yours. Keep a personal presence log
                  regardless of whether your employer ever adopts checkmark.
                </p>
                <p style={S.body}>
                  <strong style={{ color: "var(--navy)" }}>
                    When you change jobs:
                  </strong>{" "}
                  your history stays with you. Revoke your old employer&apos;s
                  access instantly. Grant access to your new employer if you
                  choose.
                </p>
              </div>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {[
                {
                  label: "Your personal timeline",
                  desc: "Complete history of every check-in, always accessible to you.",
                },
                {
                  label: "Org consent management",
                  desc: "See exactly which orgs can see your data. Revoke with one click.",
                },
                {
                  label: "Data portability",
                  desc: "Export your full history at any time. CSV format, no lock-in.",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    ...S.card,
                    display: "flex",
                    gap: "14px",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "var(--brand)",
                      flexShrink: 0,
                      marginTop: "6px",
                    }}
                  />
                  <div>
                    <p
                      style={{
                        fontFamily: "Syne, sans-serif",
                        fontWeight: 600,
                        fontSize: "14px",
                        color: "var(--navy)",
                        margin: "0 0 4px",
                      }}
                    >
                      {item.label}
                    </p>
                    <p style={{ ...S.body, fontSize: "13px" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Privacy details */}
      <section style={{ padding: "80px 0" }}>
        <div style={S.section}>
          <div style={{ marginBottom: "48px" }}>
            <p style={S.label}>Privacy, in plain language</p>
            <h2 style={{ ...S.h2, marginTop: "12px" }}>
              No surprises. No fine print.
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {privacyFacts.map((f, i) => (
              <div
                key={f.q}
                style={{
                  padding: "24px 0",
                  borderBottom:
                    i < privacyFacts.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                  display: "grid",
                  gridTemplateColumns: "200px 1fr",
                  gap: "24px",
                }}
                className="privacy-row"
              >
                <p
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontWeight: 600,
                    fontSize: "15px",
                    color: "var(--navy)",
                    margin: 0,
                  }}
                >
                  {f.q}
                </p>
                <p style={S.body}>{f.a}</p>
              </div>
            ))}
          </div>
          <p
            style={{
              marginTop: "24px",
              fontSize: "14px",
              color: "var(--text-secondary)",
            }}
          >
            Read our full{" "}
            <Link
              href="/privacy"
              style={{ color: "var(--brand)", textDecoration: "none" }}
            >
              privacy policy →
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "var(--brand)", padding: "80px 0" }}>
        <div style={{ ...S.section, textAlign: "center" }}>
          <h2 style={{ ...S.h2, color: "#fff", marginBottom: "16px" }}>
            Start owning your presence history.
          </h2>
          <p
            style={{
              ...S.sub,
              color: "rgba(255,255,255,0.75)",
              maxWidth: "420px",
              margin: "0 auto 32px",
            }}
          >
            Free forever. No employer required. Takes 2 minutes.
          </p>
          <Link
            href="/login"
            style={{
              ...S.btnPrimary,
              background: "#fff",
              color: "var(--brand)",
              margin: "0 auto",
            }}
          >
            Create your free account
          </Link>
        </div>
      </section>

      <style>{`
        @media (max-width: 600px) {
          .privacy-row { grid-template-columns: 1fr !important; gap: 8px !important; }
        }
      `}</style>

      <MarketingFooter />
    </div>
  );
}
