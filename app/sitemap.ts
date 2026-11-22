import type { MetadataRoute } from "next";
import { config } from "@/lib/config";
import { buildPieces } from "@/lib/mock/seed";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!config.allowIndexing || !config.siteUrl) return [];
  const base = config.siteUrl;
  return [
    ...["", "/shop", "/rate", "/trade-in", "/visit", "/policies"].map((p) => ({ url: `${base}${p}` })),
    ...buildPieces(new Date()).filter((p) => p.visible).map((p) => ({ url: `${base}/shop/${p.slug}` })),
  ];
}
