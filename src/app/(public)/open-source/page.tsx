import Link from 'next/link'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import type { Metadata } from 'next'
import { en } from '@/locales/en'

export const metadata: Metadata = {
  title: "Open Source - CheckMark",
  description:
    "CheckMark is open source under the Apache 2.0 licence. Audit the code, self-host, or contribute on GitHub.",
  alternates: {
    canonical: "/open-source",
  },
  openGraph: {
    title: "Open Source - CheckMark",
    description:
      "Audit the CheckMark code, self-host it under Apache 2.0, or contribute on GitHub.",
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

const REPO_URL = "https://github.com/ksharma20/checkmark";
const OWNER = en.brand.owner;

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
    body: "The README walks through running your own CheckMark instance on any Node.js host. SQLite out of the box.",
  },
];

const hostedItems = [
  { icon: '🆓', title: 'Free to use', body: 'No paid plans, no card, no payment integration. Sign in and create a workspace.' },
  { icon: '🧾', title: 'The same code', body: 'The hosted instance runs the code in the public repository. There is no private edition.' },
  { icon: '🛠️', title: 'Best effort', body: `Run by ${en.brand.owner} as a convenience, with no uptime guarantee or service level.` },
  { icon: '📤', title: 'Leave any time', body: 'If you outgrow it or want full control, deploy your own instance from the same repository.' },
]

const selfHostSteps = [
  {
    step: "1",
    cmd: "git clone https://github.com/ksharma20/checkmark",
    desc: "Clone the repository.",
  },
  {
    step: "2",
    cmd: "npm install && cp .env.example .env.local",
    desc: "Install dependencies, then fill in .env.local - generate JWT_SECRET, CRON_SECRET and FIELD_ENCRYPTION_KEY with the commands in the file.",
  },
  {
    step: "3",
    cmd: "node scripts/migrate.js",
    desc: "Create the database schema. With no Turso URL set, this is a local SQLite file.",
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
            CheckMark is open source.
          </h1>
          <p
            style={{
              ...S.sub,
              color: "rgba(255,255,255,0.7)",
              maxWidth: "580px",
              marginBottom: "32px",
            }}
          >
            CheckMark is a simple open-source project by {OWNER}.
            The whole application is on GitHub under the Apache 2.0 licence:
            run your own instance, audit the code, or contribute. Presence data
            should be owned by the people it describes, not locked in
            proprietary systems.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <a
              href={REPO_URL}
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
              Licensed under Apache 2.0. Use it, modify it, run your own
              instance - just keep the licence and notices with your copy.
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
            <p style={S.label}>The hosted instance</p>
            <h2 style={{ ...S.h2, marginTop: "12px" }}>
              Don&apos;t want to run a server? Use ours.
            </h2>
            <p style={{ ...S.sub, maxWidth: "520px", marginTop: "16px" }}>
              {OWNER} runs one instance at {en.brand.domain}. It is free, and
              it is optional.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            {hostedItems.map((i) => (
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
              Requires Node.js 20+. SQLite is the default database; point it at
              Turso / libSQL for production.
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
            Open an issue or a pull request on GitHub - see CONTRIBUTING.md to
            get set up. For anything else, email {en.brand.contactEmail}.
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
              href={`${REPO_URL}/issues`}
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
              href={REPO_URL}
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
