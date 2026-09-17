import Link from 'next/link'
import type { Metadata } from 'next'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import { marketing } from '@/locales/en/marketing'

const copy = marketing.pricing

export const metadata: Metadata = {
  title: copy.metaTitle,
  description: copy.metaDescription,
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: copy.ogTitle,
    description: copy.ogDescription,
    url: "/pricing",
  },
};

const S = {
  label: { fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--brand)', fontFamily: 'DM Sans, sans-serif', margin: 0 },
  h1: { fontFamily: 'Syne, sans-serif', fontSize: '40px', fontWeight: 800, color: 'var(--navy)', margin: '12px 0 12px' } as React.CSSProperties,
  h2: { fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 12px' } as React.CSSProperties,
  body: { fontFamily: 'DM Sans, sans-serif', fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 } as React.CSSProperties,
  card: { background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '32px 28px' } as React.CSSProperties,
  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'var(--brand)', color: '#fff', borderRadius: '8px', fontWeight: 600, fontSize: '14px', textDecoration: 'none' } as React.CSSProperties,
  btnSecondary: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'var(--surface-0)', color: 'var(--navy)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '14px', textDecoration: 'none' } as React.CSSProperties,
}

function OptionCards() {
  return (
    <section>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
          alignItems: "stretch",
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        {copy.options.map((option) => {
          const ctaStyle: React.CSSProperties = {
            display: "block",
            textAlign: "center",
            padding: "10px 0",
            borderRadius: "var(--radius-md)",
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 600,
            fontSize: "14px",
            textDecoration: "none",
            background: option.highlight ? "#fff" : "var(--brand)",
            color: option.highlight ? "var(--brand)" : "#fff",
            marginBottom: "24px",
          };

          return (
            <div
              key={option.key}
              style={{
                ...S.card,
                background: option.highlight ? "var(--brand)" : "var(--surface-0)",
                border: `1px solid ${option.highlight ? "var(--brand)" : "var(--border)"}`,
              }}
            >
              <p
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontWeight: 700,
                  fontSize: "18px",
                  color: option.highlight ? "#fff" : "var(--navy)",
                  margin: "0 0 4px",
                }}
              >
                {option.name}
              </p>
              <p
                style={{
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "13px",
                  color: option.highlight
                    ? "rgba(255,255,255,0.75)"
                    : "var(--text-secondary)",
                  margin: "0 0 20px",
                }}
              >
                {option.tagline}
              </p>

              <div style={{ marginBottom: "24px" }}>
                <span
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontWeight: 800,
                    fontSize: "36px",
                    color: option.highlight ? "#fff" : "var(--navy)",
                  }}
                >
                  {option.price}
                </span>
                <span
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "13px",
                    color: option.highlight
                      ? "rgba(255,255,255,0.65)"
                      : "var(--text-muted)",
                    marginLeft: "6px",
                  }}
                >
                  {option.per}
                </span>
              </div>

              {option.external ? (
                <a
                  href={option.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={ctaStyle}
                >
                  {option.cta}
                </a>
              ) : (
                <Link href={option.href} style={ctaStyle}>
                  {option.cta}
                </Link>
              )}

              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {option.points.map((point) => (
                  <li
                    key={point}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      fontFamily: "DM Sans, sans-serif",
                      fontSize: "14px",
                      color: option.highlight
                        ? "rgba(255,255,255,0.9)"
                        : "var(--text-primary)",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        color: option.highlight
                          ? "rgba(255,255,255,0.7)"
                          : "var(--teal)",
                        flexShrink: 0,
                        marginTop: "1px",
                      }}
                    >
                      ✓
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function PricingPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface-1)" }}>
      <MarketingNav />

      <main
        style={{ maxWidth: "1080px", margin: "0 auto", padding: "64px 24px" }}
      >
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <p style={S.label}>{copy.eyebrow}</p>
          <h1 style={S.h1}>{copy.heading}</h1>
          <p
            style={{
              ...S.body,
              fontSize: "17px",
              maxWidth: "560px",
              margin: "0 auto",
            }}
          >
            {copy.subtitle}
          </p>
        </div>

        <OptionCards />

        {/* What's included */}
        <section style={{ maxWidth: "800px", margin: "64px auto 0" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <p style={S.label}>{copy.includedEyebrow}</p>
            <h2 style={{ ...S.h2, marginTop: "12px" }}>
              {copy.includedHeading}
            </h2>
          </div>
          <ul
            style={{
              ...S.card,
              listStyle: "none",
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "12px 24px",
            }}
          >
            {copy.included.map((item) => (
              <li
                key={item}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "14px",
                  color: "var(--text-primary)",
                }}
              >
                <span
                  aria-hidden
                  style={{ color: "var(--teal)", flexShrink: 0, marginTop: "1px" }}
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Contact */}
        <section
          style={{
            maxWidth: "600px",
            margin: "64px auto 0",
            textAlign: "center",
            padding: "48px 24px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <h2 style={S.h2}>{copy.contactHeading}</h2>
          <p style={{ ...S.body, marginBottom: "32px" }}>{copy.contactBody}</p>
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <a href={copy.contactHref} style={S.btnPrimary}>
              {copy.contactCta}
            </a>
            <a
              href={copy.issuesHref}
              target="_blank"
              rel="noopener noreferrer"
              style={S.btnSecondary}
            >
              {copy.issuesCta}
            </a>
          </div>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "12px",
              marginTop: "16px",
            }}
          >
            {copy.contactEmail}
          </p>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
