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
      // `/dashboard` renders nothing - it reads the session and redirects to
      // `/ws` or `/me`, both of which are disallowed below. A crawler following
      // it only ever reaches `/login`, so there is nothing to index and no
      // reason to spend the request.
      disallow: ["/api/", "/me/", "/ws/", "/login", "/consent/", "/dashboard"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
