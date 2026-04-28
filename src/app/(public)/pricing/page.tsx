import Link from 'next/link'
import type { Metadata } from 'next'
import { en } from '@/locales/en'

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple CheckMark pricing for attendance, presence intelligence, and field force visit tracking. Start free, then upgrade as your team grows.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "CheckMark Pricing",
    description:
      "Start free with CheckMark, then upgrade for exports, longer history, and multi-site location signals.",
    url: "/pricing",
  },
};

const plans = [
  {
    key: "free",
    name: "Free",
    price: "₹0",
    per: "forever",
    tagline: "For small teams getting started.",
    cta: "Get started free",
    ctaHref: "'/login'",
    highlight: false,
    features: [
      "Up to 10 team members",
      "3 months of presence history",
      "1 location signal",
      "GPS & IP check-in signals",
      "Today dashboard",
      "Member consent & privacy controls",
      "Domain auto-enroll",
    ],
    missing: [
      "CSV export",
      "Up to 5 location signals",
      "7-year data retention",
    ],
  },
  {
    key: "starter",
    name: "Starter",
    price: "₹69",
    per: "per user / month",
    tagline: "For growing teams that need more history and exports.",
    cta: "Upgrade to Starter",
    ctaHref:
      "mailto:kabir.innovate@gmail.com?subject=CheckMark%20Plan%20Upgrade%20-%20Starter%20Plan&body=Hi%2C%20I'd%20like%20to%20upgrade%20my%20CheckMark%20workspace.%0A%0AWorkspace%3A%20%0ACurrent%20plan%3A%20free%0ADesired%20plan%3A%20starter%20plan",
    highlight: true,
    features: [
      "Unlimited team members",
      "12 months of presence history",
      "1 location signal",
      "GPS & IP check-in signals",
      "Today dashboard",
      "Member consent & privacy controls",
      "Domain auto-enroll",
      "CSV export",
    ],
    missing: ["Up to 5 location signals", "7-year data retention"],
  },
  {
    key: "growth",
    name: "Growth",
    price: "₹99",
    per: "per user / month",
    tagline: "For enterprise teams with multi-site and compliance needs.",
    cta: "Upgrade to Growth",
    ctaHref:
      "mailto:kabir.innovate@gmail.com?subject=CheckMark%20Plan%20Upgrade%20-%20Growth%20Plan&body=Hi%2C%20I'd%20like%20to%20upgrade%20my%20CheckMark%20workspace.%0A%0AWorkspace%3A%20%0ACurrent%20plan%3A%20free%0ADesired%20plan%3A%20growth%20plan",
    highlight: false,
    features: [
      "Unlimited team members",
      "7 years of presence history",
      "Up to 5 location signals",
      "GPS & IP check-in signals",
      "Today dashboard",
      "Member consent & privacy controls",
      "Domain auto-enroll",
      "CSV export",
      "Multi-site field force analytics",
    ],
    missing: [],
  },
];

function PricingCardSection() {
  return (
    <section>
      {/* Plan cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {plans.map((plan) => (
          <div
            key={plan.key}
            style={{
              background: plan.highlight ? "var(--brand)" : "var(--surface-0)",
              border: `1px solid ${plan.highlight ? "var(--brand)" : "var(--border)"}`,
              borderRadius: "var(--radius-lg)",
              padding: "32px 28px",
              position: "relative",
              boxShadow: plan.highlight
                ? "0 8px 32px color-mix(in srgb, var(--brand) 25%, transparent)"
                : "none",
            }}
          >
            {plan.highlight && (
              <div
                style={{
                  position: "absolute",
                  top: "-12px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "var(--teal)",
                  color: "#fff",
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  padding: "4px 12px",
                  borderRadius: "20px",
                }}
              >
                Most popular
              </div>
            )}

            <p
              style={{
                fontFamily: "Syne, sans-serif",
                fontWeight: 700,
                fontSize: "18px",
                color: plan.highlight ? "#fff" : "var(--navy)",
                margin: "0 0 4px",
              }}
            >
              {plan.name}
            </p>
            <p
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "13px",
                color: plan.highlight
                  ? "rgba(255,255,255,0.75)"
                  : "var(--text-secondary)",
                margin: "0 0 20px",
              }}
            >
              {plan.tagline}
            </p>

            <div style={{ marginBottom: "24px" }}>
              <span
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontWeight: 800,
                  fontSize: "36px",
                  color: plan.highlight ? "#fff" : "var(--navy)",
                }}
              >
                {plan.price}
              </span>
              <span
                style={{
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "13px",
                  color: plan.highlight
                    ? "rgba(255,255,255,0.65)"
                    : "var(--text-muted)",
                  marginLeft: "6px",
                }}
              >
                {plan.per}
              </span>
            </div>

            <Link
              href={plan.ctaHref}
              style={{
                display: "block",
                textAlign: "center",
                padding: "10px 0",
                borderRadius: "var(--radius-md)",
                fontFamily: "DM Sans, sans-serif",
                fontWeight: 600,
                fontSize: "14px",
                textDecoration: "none",
                background: plan.highlight ? "#fff" : "var(--brand)",
                color: plan.highlight ? "var(--brand)" : "#fff",
                marginBottom: "24px",
              }}
            >
              {plan.cta}
            </Link>

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
              {plan.features.map((f) => (
                <li
                  key={f}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "14px",
                    color: plan.highlight
                      ? "rgba(255,255,255,0.9)"
                      : "var(--text-primary)",
                  }}
                >
                  <span
                    style={{
                      color: plan.highlight
                        ? "rgba(255,255,255,0.7)"
                        : "var(--teal)",
                      flexShrink: 0,
                      marginTop: "1px",
                    }}
                  >
                    ✓
                  </span>
                  {f}
                </li>
              ))}
              {plan.missing.map((f) => (
                <li
                  key={f}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "14px",
                    color: plan.highlight
                      ? "rgba(255,255,255,0.4)"
                      : "var(--text-muted)",
                  }}
                >
                  <span style={{ flexShrink: 0, marginTop: "1px" }}>–</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PricingPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface-1)" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-0)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          height: "56px",
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "Syne, sans-serif",
            fontWeight: 700,
            fontSize: "18px",
            color: "var(--brand)",
            textDecoration: "none",
          }}
        >
          {en.brand.name}
        </Link>
        <nav style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <Link
            href="/login"
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "14px",
              color: "var(--text-secondary)",
              textDecoration: "none",
              padding: "6px 14px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            Sign in
          </Link>
        </nav>
      </header>

      <main
        style={{ maxWidth: "1080px", margin: "0 auto", padding: "64px 24px" }}
      >
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <h1
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: "40px",
              fontWeight: 800,
              color: "var(--navy)",
              margin: "0 0 12px",
            }}
          >
            Simple, transparent pricing
          </h1>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "17px",
              color: "var(--text-secondary)",
              maxWidth: "520px",
              margin: "0 auto",
            }}
          >
            Free for users. Affordable for organisations. No per-seat surprises
            on the free plan.
          </p>
        </div>

        <PricingCardSection />

        {/* Billing Contact */}
        <section
          style={{
            maxWidth: "600px",
            margin: "64px auto 0",
            textAlign: "center",
            padding: "48px 24px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <h2
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--navy)",
              marginBottom: "12px",
            }}
          >
            Ready to upgrade?
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "15px",
              lineHeight: 1.6,
              marginBottom: "32px",
            }}
          >
            We handle upgrades personally. Send us a message and we&apos;ll get
            you set up within 24 hours.
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
              href="mailto:kabir.innovate@gmail.com?subject=CheckMark%20Plan%20Upgrade%20Request&body=Hi%2C%20I'd%20like%20to%20upgrade%20my%20CheckMark%20workspace.%0A%0AWorkspace%3A%20%0ACurrent%20plan%3A%20free%0ADesired%20plan%3A%20"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 24px",
                background: "var(--brand)",
                color: "#fff",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "14px",
                textDecoration: "none",
              }}
            >
              Email us to upgrade
            </a>
            <a
              href="mailto:kabir.innovate@gmail.com?subject=Schedule%20CheckMark%20Demo&body=Hi%2C%20I'd%20like%20to%20schedule%20a%20call%20to%20discuss%20CheckMark%20for%20my%20team."
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 24px",
                background: "var(--surface-0)",
                color: "var(--navy)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "14px",
                textDecoration: "none",
              }}
            >
              Schedule a call
            </a>
          </div>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "12px",
              marginTop: "16px",
            }}
          >
            kabir.innovate@gmail.com · typically responds within 24h
          </p>
        </section>

        {/* Footer note */}
        <p
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "13px",
            color: "var(--text-muted)",
            textAlign: "center",
            marginTop: "40px",
          }}
        >
          All plans include end-to-end employee data ownership. Users always
          control their own presence data. Billed per active workspace member
          per month.
        </p>
      </main>
    </div>
  );
}
