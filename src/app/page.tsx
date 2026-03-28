import Link from 'next/link'
import { en } from '@/locales/en'

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--surface-1)",
        fontFamily: "DM Sans, sans-serif",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          background: "var(--surface-0)",
          borderBottom: "1px solid var(--border)",
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            padding: "0 24px",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              fontSize: "18px",
              color: "var(--brand)",
              letterSpacing: "-0.3px",
            }}
          >
            {en.brand.name}
          </span>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <Link
              href="/login"
              style={{
                height: "40px",
                padding: "0 28px",
                background: "transparent",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: "14px",
                fontFamily: "DM Sans, sans-serif",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          maxWidth: "780px",
          margin: "0 auto",
          padding: "80px 24px 64px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontFamily: "Syne, sans-serif",
            fontSize: "clamp(36px, 6vw, 56px)",
            fontWeight: 700,
            color: "var(--navy)",
            lineHeight: 1.15,
            marginBottom: "20px",
            letterSpacing: "-1px",
            whiteSpace: "pre-line",
          }}
        >
          {en.landing.heroHeadline}
        </h1>
        <p
          style={{
            fontSize: "clamp(16px, 2.5vw, 20px)",
            color: "var(--text-secondary)",
            maxWidth: "560px",
            margin: "0 auto 36px",
            lineHeight: 1.6,
          }}
        >
          {en.landing.heroSubtitle}
        </p>
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/login"
            style={{
              height: "48px",
              padding: "0 28px",
              background: "var(--brand)",
              color: "#fff",
              borderRadius: "var(--radius-md)",
              fontSize: "16px",
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Get started
          </Link>
        </div>
      </section>

      {/* Features */}
      <section
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 24px 80px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        {en.landing.features.map((f) => (
          <div
            key={f.title}
            style={{
              background: "var(--surface-0)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "24px",
            }}
          >
            <h3
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--navy)",
                marginBottom: "10px",
              }}
            >
              {f.title}
            </h3>
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              {f.body}
            </p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          © {new Date().getFullYear()} {en.brand.name}. {en.landing.footerText}
        </p>
      </footer>
    </div>
  );
}
