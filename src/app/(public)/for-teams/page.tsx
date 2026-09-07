import Link from 'next/link'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "CheckMark for Teams - Attendance without the hardware",
  description:
    "CheckMark helps teams manage hybrid office attendance and field force visit logs with GPS and IP verification. No hardware, no app installs.",
  alternates: {
    canonical: "/for-teams",
  },
  openGraph: {
    title: "CheckMark for Teams - Attendance without the hardware",
    description:
      "Manage hybrid office attendance and field force visit logs with CheckMark. No hardware, no app installs.",
    url: "/for-teams",
  },
};

const S = {
  section: { maxWidth: '1100px', margin: '0 auto', padding: '80px 24px' } as React.CSSProperties,
  label: { fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--brand)', fontFamily: 'DM Sans, sans-serif' },
  h1: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'clamp(34px, 5vw, 52px)', lineHeight: 1.1, letterSpacing: '-1.2px', color: 'var(--navy)', margin: 0 } as React.CSSProperties,
  h2: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'clamp(26px, 4vw, 38px)', lineHeight: 1.15, letterSpacing: '-0.8px', color: 'var(--navy)', margin: 0 } as React.CSSProperties,
  h3: { fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '17px', color: 'var(--navy)', margin: 0 },
  body: { fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 } as React.CSSProperties,
  sub: { fontSize: 'clamp(15px, 2vw, 18px)', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 } as React.CSSProperties,
  card: { background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px' } as React.CSSProperties,
  btnPrimary: { height: '50px', padding: '0 28px', background: 'var(--brand)', color: '#fff', borderRadius: 'var(--radius-md)', fontSize: '15px', fontWeight: 600, fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' } as React.CSSProperties,
  btnSecondary: { height: '50px', padding: '0 28px', background: 'transparent', color: 'var(--text-primary)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '15px', fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' } as React.CSSProperties,
}

const teamTypes = [
  {
    icon: "🏢",
    title: "Hybrid office teams",
    subtitle: "Office attendance, simplified.",
    body: `Employees tap once when they arrive. checkmark verifies presence using GPS and IP geofencing.
    The admin dashboard shows who's in right now, who visited today, and who worked remote.
    No clocking machines. No app installs. Works in any browser.`,
    points: [
      "Works in co-working spaces and private offices",
      "Multi-signal verification (GPS + IP)",
      "Monthly attendance grid with CSV export",
      "Allowance calculation (coming soon)",
    ],
  },
  {
    icon: "🗺️",
    title: "Field force teams",
    subtitle: "Client visit verification, not WhatsApp.",
    body: `Insurance agents. Pharma medical representatives. FMCG distributors. If your team visits
    clients in the field, checkmark gives you a structured, GPS-verified log of every visit —
    replacing informal WhatsApp check-ins with real data your organisation can act on.`,
    points: [
      "GPS-verified client visits",
      "See where every agent went, every day",
      "Time-stamped visit log with location labels",
      "No dedicated device required",
    ],
  },
];

const setupSteps = [
  {
    n: "01",
    title: "Create your workspace",
    body: "Sign up and create a workspace with your organisation name and URL handle. Takes 2 minutes.",
  },
  {
    n: "02",
    title: "Register your office location",
    body: "Add GPS coordinates (we detect them automatically) or set a geofence radius. Mix and match signals.",
  },
  {
    n: "03",
    title: "Add your domain or invite members",
    body: "Verify your company domain (e.g. acmecorp.com) and everyone with a matching email is auto-enrolled. Or send personal invite links.",
  },
  {
    n: "04",
    title: "Team starts checking in",
    body: "Members visit your checkmark link on any device. One tap to check in, one tap to check out.",
  },
  {
    n: "05",
    title: "View the dashboard",
    body: "See who's in today in real time. View monthly history. Filter by name, signal type, or attendance status. Export to CSV.",
  },
];

const signals = [
  { icon: '📍', name: 'GPS geofence', body: 'A GPS radius around your office. Members within the fence when they check in are verified. Configurable radius from 50m to 2km.' },
  { icon: '🌐', name: 'IP geofencing', body: 'If the member\'s IP address resolves to a location near your office, it counts as a supporting signal.' },
  { icon: '✍️', name: 'Manual override', body: 'Admin can mark any member present manually. Useful for guests, hardware failures, or mixed-signal environments.' },
]

export default function ForTeamsPage() {
  return (
    <div style={{ background: "var(--surface-0)" }}>
      <MarketingNav />

      {/* Hero */}
      <section
        style={{ background: "var(--surface-1)", padding: "80px 0 64px" }}
      >
        <div style={S.section}>
          <p style={S.label}>For Teams</p>
          <h1 style={{ ...S.h1, marginTop: "12px", marginBottom: "20px" }}>
            Track attendance
            <br />
            without the hassle.
          </h1>
          <p style={{ ...S.sub, maxWidth: "560px", marginBottom: "32px" }}>
            Works in co-working spaces, private offices, and in the field. No
            hardware. No app installs. No IT department. Set up in under 10
            minutes.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link href="/login" style={S.btnPrimary}>
              Create your workspace
            </Link>
            <Link href="/pricing" style={S.btnSecondary}>
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Two types of teams */}
      <section style={{ padding: "80px 0" }}>
        <div style={S.section}>
          <div style={{ marginBottom: "48px" }}>
            <p style={S.label}>Two types of teams</p>
            <h2 style={{ ...S.h2, marginTop: "12px" }}>
              Built for how your team actually works.
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "20px",
            }}
          >
            {teamTypes.map((t) => (
              <div
                key={t.title}
                style={{
                  ...S.card,
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <span style={{ fontSize: "36px" }}>{t.icon}</span>
                <div>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "var(--brand)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      margin: "0 0 6px",
                      fontFamily: "DM Sans, sans-serif",
                    }}
                  >
                    {t.subtitle}
                  </p>
                  <h3 style={S.h3}>{t.title}</h3>
                </div>
                <p style={S.body}>{t.body}</p>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {t.points.map((p) => (
                    <li
                      key={p}
                      style={{
                        fontSize: "14px",
                        color: "var(--text-primary)",
                        display: "flex",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--brand)",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </span>{" "}
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Signal verification */}
      <section style={{ background: "var(--surface-1)", padding: "80px 0" }}>
        <div style={S.section}>
          <div style={{ marginBottom: "48px" }}>
            <p style={S.label}>Signal verification</p>
            <h2 style={{ ...S.h2, marginTop: "12px" }}>
              Triple-signal presence verification.
            </h2>
            <p style={{ ...S.sub, maxWidth: "520px", marginTop: "16px" }}>
              If one signal is unavailable, the others pick it up. No single
              point of failure.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {signals.map((s) => (
              <div
                key={s.name}
                style={{
                  ...S.card,
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "28px" }}>{s.icon}</span>
                <p
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontWeight: 600,
                    fontSize: "15px",
                    color: "var(--navy)",
                    margin: 0,
                  }}
                >
                  {s.name}
                </p>
                <p style={{ ...S.body, fontSize: "14px" }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Setup walkthrough */}
      <section style={{ padding: "80px 0" }}>
        <div style={S.section}>
          <div style={{ marginBottom: "48px" }}>
            <p style={S.label}>Setup walkthrough</p>
            <h2 style={{ ...S.h2, marginTop: "12px" }}>
              Under 10 minutes to get your team on checkmark.
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {setupSteps.map((s, i) => (
              <div
                key={s.n}
                style={{
                  display: "flex",
                  gap: "20px",
                  alignItems: "flex-start",
                  padding: "24px 0",
                  borderBottom:
                    i < setupSteps.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "11px",
                    color: "var(--brand)",
                    background: "color-mix(in srgb, var(--brand) 8%, transparent)",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {s.n}
                </span>
                <div>
                  <p
                    style={{
                      fontFamily: "Syne, sans-serif",
                      fontWeight: 600,
                      fontSize: "16px",
                      color: "var(--navy)",
                      margin: "0 0 6px",
                    }}
                  >
                    {s.title}
                  </p>
                  <p style={S.body}>{s.body}</p>
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
            Ready to get your team on checkmark?
          </h2>
          <p
            style={{
              ...S.sub,
              color: "rgba(255,255,255,0.65)",
              maxWidth: "460px",
              margin: "0 auto 32px",
            }}
          >
            Free for up to 10 members. No credit card. Takes 10 minutes.
          </p>
          <Link href="/login" style={{ ...S.btnPrimary, margin: "0 auto" }}>
            Create your workspace →
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
