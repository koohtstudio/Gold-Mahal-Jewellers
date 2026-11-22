import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  if (!config.allowIndexing) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/reservation"] }, ...(config.siteUrl ? { sitemap: `${config.siteUrl}/sitemap.xml` } : {}) };
}
