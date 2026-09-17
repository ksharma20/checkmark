import Link from 'next/link'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import type { Metadata } from 'next'
import { en } from '@/locales/en'

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    `Terms for using the hosted CheckMark instance run by ${en.brand.owner}.`,
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "CheckMark Terms of Service",
    description:
      `Terms for using the hosted CheckMark instance run by ${en.brand.owner}.`,
    url: "/terms",
  },
};

const S = {
  section: { maxWidth: '760px', margin: '0 auto', padding: '80px 24px' } as React.CSSProperties,
  h1: { fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'clamp(30px, 4vw, 44px)', lineHeight: 1.1, letterSpacing: '-1px', color: 'var(--navy)', margin: '0 0 8px' } as React.CSSProperties,
  h2: { fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '22px', color: 'var(--navy)', margin: '48px 0 12px', letterSpacing: '-0.3px' } as React.CSSProperties,
  body: { fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 16px' } as React.CSSProperties,
  li: { fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8 } as React.CSSProperties,
  code: { fontSize: '13px', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px' } as React.CSSProperties,
}

const CONTACT_EMAIL = en.brand.contactEmail
const OWNER = en.brand.owner
const REPO_URL = 'https://github.com/ksharma20/checkmark'

export default function TermsPage() {
  return (
    <div style={{ background: "var(--surface-0)" }}>
      <MarketingNav />

      <section style={S.section}>
        <p
          style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            margin: "0 0 12px",
            fontFamily: "var(--font-body)",
          }}
        >
          Effective date: 17 September 2026 · Last updated: 17 September 2026
        </p>
        <h1 style={S.h1}>Terms of Service</h1>
        <p
          style={{ ...S.body, fontSize: "17px", color: "var(--text-primary)" }}
        >
          CheckMark is a simple open-source project by {OWNER}{" "}
          (Gurgaon, India). By using the hosted instance you agree to these
          terms. They are written in plain language. If anything is unclear,
          email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--brand)" }}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>

        <h2 style={S.h2}>1. Who these terms apply to</h2>
        <p style={S.body}>
          These terms cover the instance of CheckMark that {OWNER}{" "}
          operates at{" "}
          <code style={S.code}>{en.brand.domain}</code> - for
          individuals using the personal timeline and for organisations using
          workspaces. &quot;You&quot; means the person or organisation using it;
          &quot;we&quot; means {OWNER}.
        </p>
        <p style={S.body}>
          If you use CheckMark on an instance someone else has deployed - for
          example, one your employer runs itself - that instance is operated by
          them, not by us, and their own terms apply. {OWNER} has no
          control over or access to self-hosted instances.
        </p>

        <h2 style={S.h2}>2. The software and its licence</h2>
        <p style={S.body}>
          The CheckMark source code is published at{" "}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--brand)" }}
          >
            github.com/ksharma20/checkmark
          </a>{" "}
          under the Apache License 2.0. Your rights to copy, modify, run and
          redistribute the code come from that licence, not from these terms.
          These terms only govern your use of the hosted instance.
        </p>

        <h2 style={S.h2}>3. Price</h2>
        <p style={S.body}>
          The hosted instance is free to use. There are no paid plans and we do
          not take payment. If that ever changes, we will tell you in advance
          and you will never be charged without agreeing to it.
        </p>

        <h2 style={S.h2}>4. Your account</h2>
        <p style={S.body}>
          You are responsible for keeping your account credentials secure. Do
          not share your password. If you think your account has been
          compromised, change your password immediately from{" "}
          <code style={S.code}>/me/settings</code>.
        </p>
        <p style={S.body}>
          Provide accurate information when registering. The email address you
          use decides which workspaces can enrol you automatically through
          domain verification.
        </p>

        <h2 style={S.h2}>5. Acceptable use</h2>
        <p style={S.body}>You must not use CheckMark to:</p>
        <ul
          style={{
            margin: "0 0 24px",
            paddingLeft: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {[
            "Submit false or spoofed check-in data (checking in remotely while claiming to be at the office).",
            "Circumvent signal verification through technical means (VPN spoofing, GPS faking).",
            "Access another user's data without their consent or outside the permissions a workspace has given you.",
            "Use the API or the application in a way that degrades the service for other users.",
            "Collect, scrape, or export data belonging to other users.",
            "Upload unlawful material or files you have no right to share.",
          ].map((r) => (
            <li key={r} style={S.li}>
              {r}
            </li>
          ))}
        </ul>
        <p style={S.body}>
          We may suspend or remove accounts or workspaces that break these
          rules.
        </p>

        <h2 style={S.h2}>6. Organisation admin responsibilities</h2>
        <p style={S.body}>
          If you run a workspace to record your team&apos;s attendance, or to
          keep employee records and documents, you are responsible for making
          sure that use complies with the law that applies to you - including
          labour law, employment contracts and data protection law (such as
          India&apos;s Digital Personal Data Protection Act, or the GDPR).
        </p>
        <p style={S.body}>
          CheckMark&apos;s invitation and consent flow is designed to keep
          members informed, but it is not legal advice or a compliance
          service. If you are unsure of your obligations around employee
          monitoring or employee data, consult a qualified lawyer before
          deploying CheckMark.
        </p>
        <p style={S.body}>
          Do not add people to your workspace without their knowledge, and only
          record personal data about employees that you have a legitimate
          reason to keep.
        </p>

        <h2 style={S.h2}>7. Data accuracy</h2>
        <p style={S.body}>
          GPS and IP-based presence verification are probabilistic signals, not
          absolute proof. GPS can be off by tens to hundreds of metres, and IP
          geolocation is approximate.
        </p>
        <p style={S.body}>
          Do not use CheckMark data as the sole basis for disciplinary action or
          payroll decisions without corroborating evidence.
        </p>

        <h2 style={S.h2}>8. No warranty and availability</h2>
        <p style={S.body}>
          CheckMark is maintained on a best-effort basis. The hosted instance is
          provided{" "}
          <strong style={{ color: "var(--navy)" }}>
            &quot;as is&quot; and &quot;as available&quot;
          </strong>
          , without warranties of any kind, and with no uptime guarantee or
          service level. It may be unavailable, change, or lose data. Keep your
          own copies of anything you cannot afford to lose, or run your own
          instance.
        </p>
        <p style={S.body}>
          We may change or discontinue the hosted instance. If we plan to shut
          it down, we will try to give reasonable notice by email so you can
          move to a self-hosted instance.
        </p>

        <h2 style={S.h2}>9. Limitation of liability</h2>
        <p style={S.body}>
          To the maximum extent permitted by law, {OWNER} is not
          liable for any indirect, incidental, consequential or punitive
          damages, or for any loss of data, profits or business, arising from
          your use of the hosted instance. Because the service is provided free
          of charge, our total liability for any claim is limited to the extent
          the law allows.
        </p>

        <h2 style={S.h2}>10. Ending your use</h2>
        <p style={S.body}>
          You can stop using the hosted instance at any time and deactivate
          your account from <code style={S.code}>/me/settings</code>. What
          happens to your data afterwards is described in the{" "}
          <Link href="/privacy" style={{ color: "var(--brand)" }}>
            Privacy Policy
          </Link>
          .
        </p>

        <h2 style={S.h2}>11. Changes to these terms</h2>
        <p style={S.body}>
          We may update these terms. When we do, we will update this page and
          the date at the top. Continuing to use the hosted instance after a
          change means you accept the updated terms.
        </p>

        <h2 style={S.h2}>12. Governing law</h2>
        <p style={S.body}>
          These terms are governed by the laws of India. Any disputes are
          subject to the jurisdiction of the courts at Gurugram, Haryana, India.
        </p>

        <h2 style={S.h2}>13. Contact</h2>
        <p style={S.body}>
          {OWNER}, Gurgaon, India -{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--brand)" }}>
            {CONTACT_EMAIL}
          </a>
          . For bugs and feature requests, please{" "}
          <a
            href={`${REPO_URL}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--brand)" }}
          >
            open an issue on GitHub
          </a>
          .
        </p>
      </section>

      <MarketingFooter />
    </div>
  );
}
