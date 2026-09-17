// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import "./globals.css";

import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Syne } from "next/font/google";

import { en } from "@/locales/en";
import SwRegister from "@/components/SwRegister";
import TopProgressBar from "@/components/shared/TopProgressBar";
import RippleProvider from "@/components/RippleProvider";

/**
 * The three brand families, SELF-HOSTED.
 *
 * `globals.css` used to pull them from Google with an `@import url(...)`. Two
 * things went wrong with that and only one of them was visible: the production
 * CSS build hoists and then strips the remote `@import`, so every deployed page
 * rendered in the system sans and nobody saw Syne at all; and even where it did
 * load it cost a render-blocking round trip to a third party plus a flash of
 * unstyled text.
 *
 * `next/font/google` downloads the files at BUILD time, serves them from our own
 * origin and generates a size-adjusted local fallback, so there is no layout
 * shift and no request to fonts.googleapis.com at runtime.
 *
 * No `weight` is passed on purpose - all three are variable fonts, so this ships
 * the whole axis (Syne 400-800, DM Sans 100-1000, JetBrains Mono 100-800) as one
 * file per family. It also means a weight past the axis CLAMPS rather than being
 * synthesised: `font-black` on a Syne heading renders Syne 800, not a smeared
 * fake bold. Syne has no italic axis at all, which is why nothing in the
 * marketing surface sets `italic` on it any more - that was synthetic oblique.
 *
 * The variables are `--ff-*`, not `--font-*`: `--font-heading` and friends are
 * Tailwind theme keys declared in globals.css and built ON these, and one name
 * carrying both ends would be circular.
 */
const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  variable: "--ff-syne",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--ff-dm-sans",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--ff-mono",
});

const fontVariables = `${syne.variable} ${dmSans.variable} ${jetBrainsMono.variable}`;

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_APP_URL || `https://${en.brand.domain}`,
);
const siteName = `${en.brand.name} - ${en.brand.tagline}`;
/* Leads with ownership, like the page it describes, and every clause is one the
   code backs: two signal types, AND semantics, no payment integration anywhere,
   Apache 2.0. Nothing here promises a retention window or a metric. */
const siteDescription =
  "CheckMark is a free, open-source presence platform. Your check-ins belong to your account and are never edited or deleted; the workspaces you join verify them against GPS and IP rules they set. Self-hostable under Apache 2.0.";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: en.brand.name,
  title: {
    default: siteName,
    template: `%s | ${en.brand.name}`,
  },
  description: siteDescription,
  keywords: [
    "CheckMark",
    "checkmark.kabirinnovations.com",
    "presence intelligence platform",
    "office attendance software",
    "hybrid attendance tracker",
    "GPS attendance app",
    "field force visit tracking",
    "employee check-in app",
  ],
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-logo.png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: en.brand.shortName,
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: en.brand.name,
    title: siteName,
    description: siteDescription,
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: `${en.brand.name} logo`,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: siteName,
    description: siteDescription,
    images: ["/icon-512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0D1B2A", // --bg-dark: the public shell is bg-checkmark-bg-dark
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: en.brand.name,
  alternateName: "checkmark.kabirinnovations.com",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl.toString(),
  description: siteDescription,
  license: "https://www.apache.org/licenses/LICENSE-2.0",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
  },
  publisher: {
    "@type": "Organization",
    name: en.brand.owner,
    url: siteUrl.toString(),
    logo: new URL("/icon-512.png", siteUrl).toString(),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <TopProgressBar />
        <SwRegister />
        <RippleProvider />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
