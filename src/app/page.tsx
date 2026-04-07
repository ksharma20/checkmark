import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

const S = {
  // typography
  h1: {
    fontFamily: "Syne, sans-serif",
    fontWeight: 700,
    fontSize: "clamp(36px, 6vw, 58px)",
    lineHeight: 1.1,
    letterSpacing: "-1.5px",
    color: "var(--navy)",
    margin: 0,
  } as React.CSSProperties,
  h2: {
    fontFamily: "Syne, sans-serif",
    fontWeight: 700,
    fontSize: "clamp(26px, 4vw, 40px)",
    lineHeight: 1.15,
    letterSpacing: "-0.8px",
    color: "var(--navy)",
    margin: 0,
  } as React.CSSProperties,
  h3: {
    fontFamily: "Syne, sans-serif",
    fontWeight: 600,
    fontSize: "18px",
    color: "var(--navy)",
    margin: 0,
  } as React.CSSProperties,
  sub: {
    fontSize: "clamp(16px, 2.5vw, 20px)",
    color: "var(--text-secondary)",
    lineHeight: 1.65,
    margin: 0,
  } as React.CSSProperties,
  body: {
    fontSize: "15px",
    color: "var(--text-secondary)",
    lineHeight: 1.7,
    margin: 0,
  } as React.CSSProperties,
  label: {
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--brand)",
    fontFamily: "DM Sans, sans-serif",
  },
  // layout
  section: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "96px 24px",
  } as React.CSSProperties,
  card: {
    background: "var(--surface-0)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "28px",
  } as React.CSSProperties,
  // buttons
  btnPrimary: {
    height: "52px",
    padding: "0 32px",
    background: "var(--brand)",
    color: "#fff",
    borderRadius: "var(--radius-md)",
    fontSize: "16px",
    fontWeight: 600,
    fontFamily: "DM Sans, sans-serif",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  } as React.CSSProperties,
  btnSecondary: {
    height: "52px",
    padding: "0 32px",
    background: "transparent",
    color: "var(--text-primary)",
    border: "1.5px solid var(--border)",
    borderRadius: "var(--radius-md)",
    fontSize: "16px",
    fontFamily: "DM Sans, sans-serif",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  } as React.CSSProperties,
};

// Static phone / dashboard mockups
function PhoneMockup() {
  return (
    <div
      style={{
        width: "180px",
        flexShrink: 0,
        background: "var(--navy)",
        borderRadius: "28px",
        padding: "16px 12px",
        border: "3px solid #1e2d3d",
        boxShadow: "0 24px 64px rgba(13,27,42,0.18)",
      }}
    >
      <div
        style={{
          background: "#1a2635",
          borderRadius: "16px",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            color: "#94a3b8",
            fontFamily: "DM Sans, sans-serif",
          }}
        >
          Tuesday, 17 Mar
        </div>
        <div
          style={{
            background: "#1B4DFF",
            borderRadius: "10px",
            padding: "12px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.7)",
              marginBottom: "4px",
            }}
          >
            STATUS
          </div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#fff",
              fontFamily: "Syne, sans-serif",
            }}
          >
            Checked In
          </div>
          <div
            style={{
              fontSize: "10px",
              color: "rgba(255,255,255,0.6)",
              marginTop: "4px",
            }}
          >
            9:14 AM · Office WiFi
          </div>
        </div>
        <div
          style={{
            background: "#0f1923",
            borderRadius: "8px",
            padding: "10px",
          }}
        >
          <div
            style={{ fontSize: "9px", color: "#64748b", marginBottom: "6px" }}
          >
            TODAY
          </div>
          {["09:14 In · Office", "13:02 Out · Lunch", "14:15 In · Office"].map(
            (l, i) => (
              <div
                key={i}
                style={{
                  fontSize: "10px",
                  color: "#94a3b8",
                  padding: "3px 0",
                  borderBottom: i < 2 ? "1px solid #1a2635" : "none",
                }}
              >
                {l}
              </div>
            ),
          )}
        </div>
        <div
          style={{
            background: "rgba(0,212,170,0.15)",
            border: "1px solid rgba(0,212,170,0.3)",
            borderRadius: "8px",
            padding: "8px",
            textAlign: "center",
            fontSize: "10px",
            color: "#00D4AA",
            fontWeight: 600,
          }}
        >
          I&apos;m leaving →
        </div>
      </div>
    </div>
  );
}

function DashboardMockup() {
  const members = [
    { name: "Arjun S.", status: "present", time: "9:02 AM", signal: "WiFi" },
    { name: "Priya M.", status: "present", time: "9:47 AM", signal: "GPS" },
    {
      name: "Rohan K.",
      status: "visited",
      time: "Left 1:30 PM",
      signal: "WiFi",
    },
    { name: "Nadia P.", status: "absent", time: "—", signal: "—" },
  ];
  const statusColor = (s: string) =>
    s === "present" ? "#00D4AA" : s === "visited" ? "#F59E0B" : "#94A3B8";

  return (
    <div
      style={{
        flex: 1,
        background: "var(--surface-1)",
        borderRadius: "16px",
        border: "1px solid var(--border)",
        padding: "16px",
        boxShadow: "0 24px 64px rgba(13,27,42,0.08)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            fontFamily: "Syne, sans-serif",
            fontWeight: 700,
            fontSize: "13px",
            color: "var(--navy)",
          }}
        >
          Today · Mar 17
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          {[
            ["3", "#00D4AA", "In"],
            ["1", "#F59E0B", "Out"],
            ["0", "#94a3b8", "Away"],
          ].map(([n, c, l]) => (
            <div
              key={l}
              style={{
                fontSize: "10px",
                color: c,
                fontWeight: 600,
                background: c + "18",
                padding: "2px 8px",
                borderRadius: "20px",
              }}
            >
              {n} {l}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {members.map((m) => (
          <div
            key={m.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "var(--surface-0)",
              borderRadius: "8px",
              padding: "8px 10px",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                flexShrink: 0,
                background: statusColor(m.status),
              }}
            />
            <div
              style={{
                flex: 1,
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              {m.name}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              {m.time}
            </div>
            {m.signal !== "—" && (
              <div
                style={{
                  fontSize: "9px",
                  color: "var(--brand)",
                  background: "#1B4DFF12",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                {m.signal}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const steps = {
  teams: [
    {
      n: "01",
      title: "Register your workspace",
      body: "Add your office WiFi SSID, GPS coordinates, and team members. Takes under 10 minutes.",
    },
    {
      n: "02",
      title: "Team checks in, one tap",
      body: 'Employees tap "I\'m here" on any device. No app install. Works in browser.',
    },
    {
      n: "03",
      title: "See real-time dashboard",
      body: "Today view shows who's in right now. Monthly view shows attendance history. Export CSV.",
    },
  ],
  you: [
    {
      n: "01",
      title: "Create your free account",
      body: "Sign up with your email. No credit card. Free forever for individuals.",
    },
    {
      n: "02",
      title: 'Tap "I\'m here" when you arrive',
      body: "Check in at the office, at a client site, anywhere. Tap once to check out when you leave.",
    },
    {
      n: "03",
      title: "Own your history",
      body: "See every day you were present, for how long, and where. Export it anytime.",
    },
  ],
};

const pricingPlans = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    desc: "Perfect for individuals and small teams trying checkmark.",
    features: [
      "Up to 10 members",
      "1 office location",
      "3 months history",
      "WiFi + GPS signals",
      "Personal timeline",
    ],
    cta: "Get started free",
    href: "/login",
    accent: false,
  },
  {
    name: "Starter",
    price: "₹49",
    period: "/user/month",
    desc: "For growing teams who need full history and exports.",
    features: [
      "Unlimited members",
      "1 office location",
      "12 months history",
      "All signals",
      "CSV export",
      "Email support (48h)",
    ],
    cta: "Start free trial",
    href: "/login",
    accent: true,
  },
  {
    name: "Growth",
    price: "₹89",
    period: "/user/month",
    desc: "For scaling organisations with multiple sites.",
    features: [
      "Unlimited members",
      "Up to 5 locations",
      "Unlimited history",
      "All signals",
      "Analytics (coming soon)",
      "Priority support (12h)",
    ],
    cta: "Start free trial",
    href: "/login",
    accent: false,
  },
];

export default function LandingPage() {
  return (
    <div style={{ background: "var(--surface-0)", minHeight: "100dvh" }}>
      <MarketingNav />

      {/* HERO */}
      <section
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "80px 24px 64px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "32px",
            alignItems: "flex-start",
          }}
        >
          <p style={S.label}>Presence Intelligence Platform</p>
          <h1 style={S.h1}>
            Presence intelligence
            <br />
            for modern teams.
          </h1>
          <p style={{ ...S.sub, maxWidth: "560px" }}>
            Your employees tap once. You see who showed up, where they went, and
            for how long — without hardware, app installs, or IT. Free for
            individuals, forever.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link href="/login" style={S.btnPrimary}>
              Start for free
            </Link>
            <Link href="#how-it-works" style={S.btnSecondary}>
              See how it works
            </Link>
          </div>
        </div>

        {/* Visual mockup */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            alignItems: "center",
            marginTop: "56px",
            flexWrap: "wrap",
          }}
        >
          <PhoneMockup />
          <DashboardMockup />
        </div>
      </section>

      {/* FOR ORGS */}
      <section style={{ background: "var(--surface-1)", padding: "80px 0" }}>
        <div style={S.section}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              marginBottom: "48px",
            }}
          >
            <p style={S.label}>For Organisations</p>
            <h2 style={S.h2}>Works wherever your team works.</h2>
            <p style={{ ...S.sub, maxWidth: "520px" }}>
              Hybrid offices, co-working spaces, field teams. checkmark adapts to
              your setup.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {[
              {
                icon: "🏢",
                title: "Hybrid offices",
                body: "Works in your own office or a co-working space. Uses WiFi SSID, GPS, and IP geofencing together. If one signal is unavailable, the others pick it up. Set up in under 10 minutes. No hardware. No app install.",
              },
              {
                icon: "🗺️",
                title: "Field force teams",
                body: "Insurance agents. Pharma reps. FMCG distributors. Replace WhatsApp photo groups with a structured visit log. See where every agent went, every day, verified by GPS.",
              },
            ].map((c) => (
              <div
                key={c.title}
                style={{
                  ...S.card,
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <span style={{ fontSize: "32px" }}>{c.icon}</span>
                <h3 style={S.h3}>{c.title}</h3>
                <p style={S.body}>{c.body}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "24px", textAlign: "center" }}>
            <Link
              href="/for-teams"
              style={{ ...S.btnSecondary, margin: "0 auto" }}
            >
              Learn more for teams →
            </Link>
          </div>
        </div>
      </section>

      {/* FOR INDIVIDUALS */}
      <section style={{ padding: "80px 0" }}>
        <div style={S.section}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              marginBottom: "48px",
            }}
          >
            <p style={S.label}>For Individuals</p>
            <h2 style={S.h2}>Your presence record. Forever.</h2>
            <p style={{ ...S.sub, maxWidth: "520px" }}>
              Free forever. No employer required. Your data belongs to you.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {[
              {
                icon: "✅",
                title: "Tap once when you arrive",
                body: "Check in at the office, a client site, or anywhere. Check out when you leave.",
              },
              {
                icon: "📅",
                title: "Complete history",
                body: "See every day you were present, for how long, and where. Month by month.",
              },
              {
                icon: "🔒",
                title: "Your data, your rules",
                body: "You control which organisations see your data. Revoke access at any time with one click.",
              },
            ].map((c) => (
              <div
                key={c.title}
                style={{
                  ...S.card,
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "28px" }}>{c.icon}</span>
                <h3 style={S.h3}>{c.title}</h3>
                <p style={S.body}>{c.body}</p>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: "32px",
              padding: "24px 28px",
              background: "#1B4DFF0D",
              border: "1px solid #1B4DFF30",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontWeight: 700,
                  fontSize: "17px",
                  color: "var(--navy)",
                  margin: "0 0 4px",
                }}
              >
                Free forever. No employer required.
              </p>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                Create a personal account and own your work history.
              </p>
            </div>
            <Link href="/login" style={S.btnPrimary}>
              Create free account
            </Link>
          </div>
          <div style={{ marginTop: "16px", textAlign: "right" }}>
            <Link
              href="/for-you"
              style={{
                fontSize: "14px",
                color: "var(--brand)",
                textDecoration: "none",
              }}
            >
              Learn more for individuals →
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        style={{ background: "var(--surface-1)", padding: "80px 0" }}
      >
        <div style={S.section}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              marginBottom: "48px",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <p style={S.label}>How it works</p>
            <h2 style={S.h2}>Simple by design.</h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: "32px",
            }}
          >
            {(["teams", "you"] as const).map((tab) => (
              <div key={tab}>
                <p
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontWeight: 600,
                    fontSize: "15px",
                    color: "var(--brand)",
                    marginBottom: "20px",
                    textTransform: "capitalize",
                  }}
                >
                  {tab === "teams" ? "For Teams" : "For You"}
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                  }}
                >
                  {steps[tab].map((s) => (
                    <div
                      key={s.n}
                      style={{
                        display: "flex",
                        gap: "16px",
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "11px",
                          color: "var(--brand)",
                          background: "#1B4DFF10",
                          padding: "4px 8px",
                          borderRadius: "6px",
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
                            fontSize: "15px",
                            color: "var(--navy)",
                            margin: "0 0 4px",
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
            ))}
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section style={{ padding: "80px 0" }}>
        <div style={S.section}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              marginBottom: "48px",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <p style={S.label}>Pricing</p>
            <h2 style={S.h2}>Simple pricing. Free for individuals.</h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
            }}
          >
            {pricingPlans.map((p) => (
              <div
                key={p.name}
                style={{
                  ...S.card,
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  ...(p.accent
                    ? {
                        border: "2px solid var(--brand)",
                        background: "#1B4DFF06",
                      }
                    : {}),
                }}
              >
                {p.accent && (
                  <div
                    style={{
                      display: "inline-block",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--brand)",
                      background: "#1B4DFF15",
                      padding: "3px 10px",
                      borderRadius: "20px",
                      width: "fit-content",
                    }}
                  >
                    Most popular
                  </div>
                )}
                <div>
                  <p
                    style={{
                      fontFamily: "Syne, sans-serif",
                      fontWeight: 700,
                      fontSize: "20px",
                      color: "var(--navy)",
                      margin: "0 0 4px",
                    }}
                  >
                    {p.name}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "4px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "Syne, sans-serif",
                        fontWeight: 700,
                        fontSize: "32px",
                        color: "var(--navy)",
                      }}
                    >
                      {p.price}
                    </span>
                    <span
                      style={{ fontSize: "13px", color: "var(--text-muted)" }}
                    >
                      {p.period}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      margin: "8px 0 0",
                    }}
                  >
                    {p.desc}
                  </p>
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {p.features.map((f) => (
                    <li
                      key={f}
                      style={{
                        fontSize: "14px",
                        color: "var(--text-primary)",
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          color: "#00D4AA",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </span>{" "}
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  style={{
                    display: "block",
                    textAlign: "center",
                    height: "44px",
                    lineHeight: "44px",
                    borderRadius: "var(--radius-md)",
                    fontSize: "14px",
                    fontWeight: 600,
                    textDecoration: "none",
                    background: p.accent ? "var(--brand)" : "transparent",
                    color: p.accent ? "#fff" : "var(--brand)",
                    border: p.accent ? "none" : "1.5px solid var(--brand)",
                  }}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: "24px" }}>
            <Link
              href="/pricing"
              style={{
                fontSize: "14px",
                color: "var(--brand)",
                textDecoration: "none",
              }}
            >
              See full pricing details →
            </Link>
          </p>
        </div>
      </section>

      {/* OPEN SOURCE */}
      <section style={{ background: "var(--navy)", padding: "80px 0" }}>
        <div style={{ ...S.section, textAlign: "center" }}>
          <p style={{ ...S.label, color: "#00D4AA" }}>Open Source</p>
          <h2 style={{ ...S.h2, color: "#fff", margin: "16px 0" }}>
            Built in the open.
          </h2>
          <p
            style={{
              ...S.sub,
              color: "rgba(255,255,255,0.65)",
              maxWidth: "580px",
              margin: "0 auto 36px",
            }}
          >
            checkmark&apos;s application code is open source. The managed data
            platform that powers your organisation&apos;s insights is what we
            monetise — not the app itself. We believe presence data should be
            owned by individuals, not locked in proprietary systems.
          </p>
          <Link
            href="/open-source"
            style={{
              ...S.btnSecondary,
              color: "#fff",
              border: "1.5px solid rgba(255,255,255,0.25)",
              margin: "0 auto",
            }}
          >
            View on GitHub →
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
