import Link from 'next/link'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "CheckMark for You - Your presence record, owned by you",
  description:
    "CheckMark is free and open source. Your check-ins belong to your account; workspaces you join can see them but never edit them.",
  alternates: {
    canonical: "/for-you",
  },
  openGraph: {
    title: "CheckMark for You - Your presence record, owned by you",
    description:
      "Own your work history with CheckMark. Free for everyone, and open source.",
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
    title: "See your history",
    body: "Every check-in, when it happened, how long you stayed and where. Filter by date.",
  },
  {
    icon: "👀",
    title: "The same answer your admin sees",
    body: "Each check-in shows whether it counted as verified or partial for your workspace. Nothing is judged behind your back.",
  },
  {
    icon: "🔒",
    title: "History you own",
    body: "Check-ins are never edited or deleted - not by you, not by an admin. A correction sits beside the original, never over it.",
  },
  {
    icon: "🚪",
    title: "Leave when you like",
    body: "See every workspace you belong to or are invited to, and leave any of them from your organisations page.",
  },
  {
    icon: "💸",
    title: "Free for everyone",
    body: "No subscription, no trial, no paid tier. CheckMark is open source, and nobody pays - not you, and not your employer.",
  },
];

const privacyFacts = [
  { q: 'What we store', a: 'Your check-in and check-out times, GPS coordinates (if you allow location), your IP address and basic device information. The privacy policy has the full list.' },
  { q: 'What we don\'t store', a: 'We don\'t track your location in the background. We don\'t read your contacts, calendar, or any other app data. We only record what you explicitly submit.' },
  { q: 'Who can see your data', a: 'You, and the admins of the workspaces you belong to - what each admin sees depends on the role that workspace gives them. Your organisations page lists every workspace, and you can leave any of them.' },
  { q: 'How long we keep it', a: 'Check-ins are a permanent record: they are never edited or deleted, and there is no automatic expiry. You can deactivate your account from settings; to ask for your data on the hosted instance to be erased, email us.' },
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
            CheckMark records where you checked in and for how long - only when
            you tap. A personal tool, not a surveillance system.
          </p>
          <p
            style={{
              display: "inline-block",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--brand)",
              background: "color-mix(in srgb, var(--brand) 8%, transparent)",
              padding: "6px 16px",
              borderRadius: "20px",
              marginBottom: "32px",
            }}
          >
            Free and open source - no credit card
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
                Your account is yours, not your employer&apos;s.
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
                    If your company uses CheckMark:
                  </strong>{" "}
                  your check-ins count toward your organisation&apos;s
                  attendance, judged against its own office signals.
                </p>
                <p style={S.body}>
                  <strong style={{ color: "var(--navy)" }}>
                    If you work with more than one organisation:
                  </strong>{" "}
                  one account holds every membership. A single check-in counts
                  for each, and the switcher at the top moves between them.
                </p>
                <p style={S.body}>
                  <strong style={{ color: "var(--navy)" }}>
                    When you change jobs:
                  </strong>{" "}
                  your account stays with you. Leave your old workspace, and
                  accept your new employer&apos;s invitation when it arrives.
                </p>
              </div>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {[
                {
                  label: "Your personal timeline",
                  desc: "Every check-in for the workspace you are viewing, always open to you.",
                },
                {
                  label: "Your organisations",
                  desc: "Every workspace you belong to or are invited to, in one list. Leave any of them.",
                },
                {
                  label: "Open source",
                  desc: "The code that decides whether a check-in counts is public. Read it yourself.",
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
            Free for everyone. Open source. Yours.
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


      <MarketingFooter />
    </div>
  );
}
