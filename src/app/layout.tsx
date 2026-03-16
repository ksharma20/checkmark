import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CheckMark — Presence Intelligence",
  description: "Know where your team is. Own where you've been.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
