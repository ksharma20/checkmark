// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import "./globals.css";

import type { Metadata, Viewport } from "next";

import { en } from "@/locales/en";
import SwRegister from "@/components/SwRegister";
import TopProgressBar from "@/components/shared/TopProgressBar";
import RippleProvider from "@/components/RippleProvider";

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_APP_URL || `https://${en.brand.domain}`,
);
const siteName = `${en.brand.name} - ${en.brand.tagline}`;
const siteDescription =
  "CheckMark is a presence intelligence platform for verified office attendance, hybrid teams, and field force visit logs.";

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
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
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
  themeColor: "#1a1a2e",
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
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
  },
  publisher: {
    "@type": "Organization",
    name: en.brand.name,
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
    <html lang="en">
      <body>
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
