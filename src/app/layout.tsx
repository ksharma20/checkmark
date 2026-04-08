import type { Metadata, Viewport } from "next";
import "./globals.css";
import { en } from "@/locales/en";
import SwRegister from "@/components/SwRegister";
import TopProgressBar from "@/components/shared/TopProgressBar";

export const metadata: Metadata = {
  title: `${en.brand.name} — ${en.brand.tagline}`,
  description: en.brand.taglineLong,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: en.brand.shortName,
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1a2e",
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
        {children}
      </body>
    </html>
  );
}
