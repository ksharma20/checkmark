import Link from 'next/link'

const navLinks = [
  { label: 'For Teams', href: '/for-teams' },
  { label: 'For You', href: '/for-you' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Open Source', href: '/open-source' },
]

export default function MarketingNav() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 24px",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              fontSize: "18px",
              color: "var(--brand)",
              letterSpacing: "-0.3px",
            }}
          >
            checkmark
          </span>
        </Link>

        {/* Center links — hidden on mobile */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            alignItems: "center",
          }}
          className="nav-links-center"
        >
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                padding: "6px 14px",
                fontSize: "14px",
                color: "var(--text-secondary)",
                textDecoration: "none",
                borderRadius: "var(--radius-sm)",
                fontFamily: "DM Sans, sans-serif",
                transition: "color 0.15s",
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right CTAs */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <Link
            href="/login"
            style={{
              padding: "0 18px",
              height: "38px",
              display: "inline-flex",
              alignItems: "center",
              fontSize: "14px",
              color: "var(--text-primary)",
              textDecoration: "none",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            Sign in
          </Link>
          <Link
            href="/login"
            style={{
              padding: "0 20px",
              height: "38px",
              display: "inline-flex",
              alignItems: "center",
              background: "var(--brand)",
              color: "#fff",
              borderRadius: "var(--radius-md)",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            Get started
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .nav-links-center { display: none !important; }
        }
      `}</style>
    </nav>
  );
}
