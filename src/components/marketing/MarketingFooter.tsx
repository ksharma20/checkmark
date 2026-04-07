import Link from 'next/link'

const footerLinks = [
  { label: 'For Teams', href: '/for-teams' },
  { label: 'For You', href: '/for-you' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Open Source', href: '/open-source' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
]

export default function MarketingFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--surface-0)",
        padding: "40px 24px",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          alignItems: "center",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              fontSize: "16px",
              color: "var(--brand)",
            }}
          >
            checkmark
          </span>
        </Link>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px 24px",
            justifyContent: "center",
          }}
        >
          {footerLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                fontSize: "13px",
                color: "var(--text-muted)",
                textDecoration: "none",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <p
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            margin: 0,
            textAlign: "center",
          }}
        >
          © {new Date().getFullYear()} checkmark. Presence intelligence for modern
          teams.
        </p>
      </div>
    </footer>
  );
}
