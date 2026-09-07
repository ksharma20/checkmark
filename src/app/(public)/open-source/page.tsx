import Link from 'next/link'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Open Source - CheckMark",
  description:
    "CheckMark is open source. Audit the code, self-host, or contribute on GitHub.",
  alternates: {
    canonical: "/open-source",
  },
  openGraph: {
    title: "Open Source - CheckMark",
    description:
      "Audit the CheckMark code, self-host, or contribute on GitHub.",
    url: "/open-source",
  },
};

const S = {
  section: { maxWidth: '1100px', margin: '0 auto', padding: '80px 24px' } as React.CSSProperties,
  label: { fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--brand)', fontFamily: 'DM Sans, sans-serif' },
  h1: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'clamp(34px, 5vw, 52px)', lineHeight: 1.1, letterSpacing: '-1.2px', color: 'var(--navy)', margin: 0 } as React.CSSProperties,
  h2: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'clamp(24px, 3.5vw, 36px)', lineHeight: 1.15, letterSpacing: '-0.8px', color: 'var(--navy)', margin: 0 } as React.CSSProperties,
  body: { fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 } as React.CSSProperties,
  sub: { fontSize: 'clamp(15px, 2vw, 18px)', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 } as React.CSSProperties,
  card: { background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px' } as React.CSSProperties,
}

const openItems = [
  {
    icon: "🖥️",
    title: "Complete Next.js application",
    body: "The full frontend and API - every page, every endpoint, every component - is in the open.",
  },
  {
    icon: "🗄️",
    title: "Database schema and migrations",
    body: "Every table, index, and migration script. You can inspect exactly how your data is structured.",
  },
  {
    icon: "📡",
    title: "Signal matching algorithm",
    body: 'The logic that determines whether a check-in counts as "present" based on GPS and IP signals.',
  },
  {
    icon: "📖",
    title: "Self-hosting documentation",
    body: "A full guide to running your own checkmark instance on any Node.js host. SQLite out of the box.",
  },
];

const managedItems = [
  { icon: '🚀', title: 'Managed hosting', body: 'Reliable infrastructure with 99.5% uptime SLA. We handle scaling, backups, and deployments.' },
  { icon: '🔐', title: 'Automated backups', body: 'Daily encrypted backups with 30-day point-in-time restore. Your data is never at risk.' },
  { icon: '📦', title: '7-year data retention', body: 'Compliance-grade retention with automated purging. Required by many labour law jurisdictions.' },
  { icon: '📧', title: 'Email and consent flows', body: 'Transactional email, OTP delivery, and the domain verification pipeline.' },
  { icon: '💳', title: 'Billing and plan management', body: 'Subscription management, invoice generation, and plan enforcement for organisation workspaces.' },
]

const selfHostSteps = [
  {
    step: "1",
    cmd: "git clone https://github.com/ksharma20/checkmark",
    desc: "Clone the repository.",
  },
  {
    step: "2",
    cmd: "npm install && cp .env.example .env",
    desc: "Install dependencies and configure environment.",
  },
  {
    step: "3",
    cmd: "npm run migrate",
    desc: "Run database migrations to set up SQLite schema.",
  },
  {
    step: "4",
    cmd: "npm run dev",
    desc: "Start the development server. Or `npm run build && npm start` for production.",
  },
];

export default function OpenSourcePage() {
  return (
    <div style={{ background: "var(--surface-0)" }}>
      <MarketingNav />

      {/* Hero */}
      <section style={{ background: "var(--navy)", padding: "80px 0 64px" }}>
        <div style={S.section}>
          <p style={{ ...S.label, color: "var(--teal)" }}>Open Source</p>
          <h1
            style={{
              ...S.h1,
              color: "#fff",
              marginTop: "12px",
              marginBottom: "20px",
            }}
          >
            checkmark is open source.
          </h1>
          <p
            style={{
              ...S.sub,
              color: "rgba(255,255,255,0.7)",
              maxWidth: "580px",
              marginBottom: "32px",
            }}
          >
            The application code - everything you see at checkmark.kabirinnovations.com - is
            available on GitHub. Anyone can run their own instance, audit the
            code, or contribute. We believe presence data should be owned by
            individuals, not locked in proprietary systems.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <a
              href="https://github.com/ksharma20/checkmark"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                height: "50px",
                padding: "0 28px",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                border: "1.5px solid rgba(255,255,255,0.2)",
                borderRadius: "var(--radius-md)",
                fontSize: "15px",
                fontWeight: 600,
                fontFamily: "DM Sans, sans-serif",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              View on GitHub →
            </a>
            <Link
              href="/login"
              style={{
                height: "50px",
                padding: "0 28px",
                background: "var(--brand)",
                color: "#fff",
                borderRadius: "var(--radius-md)",
                fontSize: "15px",
                fontWeight: 600,
                fontFamily: "DM Sans, sans-serif",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Use the hosted version
            </Link>
          </div>
        </div>
      </section>

      {/* What's open source */}
      <section style={{ padding: "80px 0" }}>
        <div style={S.section}>
          <div style={{ marginBottom: "48px" }}>
            <p style={S.label}>What&apos;s open source</p>
            <h2 style={{ ...S.h2, marginTop: "12px" }}>
              The whole application. No black boxes.
            </h2>
            <p style={{ ...S.sub, maxWidth: "520px", marginTop: "16px" }}>
              Licensed under MIT. Use it, fork it, run your own instance. No
              strings attached.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            {openItems.map((i) => (
              <div
                key={i.title}
                style={{
                  ...S.card,
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "28px" }}>{i.icon}</span>
                <p
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontWeight: 600,
                    fontSize: "16px",
                    color: "var(--navy)",
                    margin: 0,
                  }}
                >
                  {i.title}
                </p>
                <p style={S.body}>{i.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we run as a service */}
      <section style={{ background: "var(--surface-1)", padding: "80px 0" }}>
        <div style={S.section}>
          <div style={{ marginBottom: "48px" }}>
            <p style={S.label}>What we run as a service</p>
            <h2 style={{ ...S.h2, marginTop: "12px" }}>
              The operational layer organisations pay for.
            </h2>
            <p style={{ ...S.sub, maxWidth: "520px", marginTop: "16px" }}>
              Running a reliable data platform is different from running an app.
              This is what we monetise - not the code itself.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            {managedItems.map((i) => (
              <div
                key={i.title}
                style={{
                  ...S.card,
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "28px" }}>{i.icon}</span>
                <p
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontWeight: 600,
                    fontSize: "16px",
                    color: "var(--navy)",
                    margin: 0,
                  }}
                >
                  {i.title}
                </p>
                <p style={S.body}>{i.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Self-host */}
      <section style={{ padding: "80px 0" }}>
        <div style={S.section}>
          <div style={{ marginBottom: "48px" }}>
            <p style={S.label}>Self-hosting</p>
            <h2 style={{ ...S.h2, marginTop: "12px" }}>
              Run it yourself in 4 steps.
            </h2>
            <p style={{ ...S.sub, maxWidth: "460px", marginTop: "16px" }}>
              Requires Node.js 20+ and nothing else. SQLite is the default
              database.
            </p>
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {selfHostSteps.map((s) => (
              <div
                key={s.step}
                style={{
                  ...S.card,
                  display: "flex",
                  gap: "16px",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontWeight: 700,
                    fontSize: "20px",
                    color: "var(--brand)",
                    flexShrink: 0,
                    minWidth: "24px",
                  }}
                >
                  {s.step}.
                </span>
                <div style={{ flex: 1 }}>
                  <code
                    style={{
                      display: "block",
                      background: "var(--navy)",
                      color: "var(--teal)",
                      padding: "10px 14px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "13px",
                      fontFamily: "JetBrains Mono, monospace",
                      marginBottom: "8px",
                      wordBreak: "break-all",
                    }}
                  >
                    {s.cmd}
                  </code>
                  <p style={{ ...S.body, fontSize: "14px" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "var(--navy)", padding: "80px 0" }}>
        <div style={{ ...S.section, textAlign: "center" }}>
          <h2 style={{ ...S.h2, color: "#fff", marginBottom: "16px" }}>
            Questions or contributions?
          </h2>
          <p
            style={{
              ...S.sub,
              color: "rgba(255,255,255,0.65)",
              maxWidth: "460px",
              margin: "0 auto 32px",
            }}
          >
            Open an issue or submit a pull request on GitHub. We review all
            contributions.
          </p>
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <a
              href="https://github.com/ksharma20/checkmark/issues"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                height: "50px",
                padding: "0 28px",
                background: "transparent",
                color: "#fff",
                border: "1.5px solid rgba(255,255,255,0.25)",
                borderRadius: "var(--radius-md)",
                fontSize: "15px",
                fontFamily: "DM Sans, sans-serif",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Open an issue
            </a>
            <a
              href="https://github.com/ksharma20/checkmark"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                height: "50px",
                padding: "0 28px",
                background: "var(--brand)",
                color: "#fff",
                borderRadius: "var(--radius-md)",
                fontSize: "15px",
                fontWeight: 600,
                fontFamily: "DM Sans, sans-serif",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              View on GitHub →
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
