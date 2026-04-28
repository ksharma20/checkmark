import type { MetadataRoute } from "next";
import { en } from "@/locales/en";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${en.brand.domain}`;

const routes = [
  { url: "/", priority: 1 },
  { url: "/for-teams", priority: 0.9 },
  { url: "/pricing", priority: 0.8 },
  { url: "/for-you", priority: 0.7 },
  { url: "/open-source", priority: 0.6 },
  { url: "/privacy", priority: 0.3 },
  { url: "/terms", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteUrl}${route.url}`,
    lastModified: new Date(),
    changeFrequency: route.url === "/" ? "weekly" : "monthly",
    priority: route.priority,
  }));
}
