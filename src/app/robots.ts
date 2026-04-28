import type { MetadataRoute } from "next";
import { en } from "@/locales/en";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${en.brand.domain}`;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/for-teams",
        "/for-you",
        "/pricing",
        "/open-source",
        "/privacy",
        "/terms",
      ],
      disallow: ["/api/", "/me/", "/ws/", "/login", "/consent/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
