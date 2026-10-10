import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Fixed per-page dates: bump a page's date when its content actually changes.
// (/signup is noindex, so it is intentionally left out.)
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: "2026-09-27", changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified: "2026-09-27", changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/what-is-ember-ai`, lastModified: "2026-10-10", changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/login`, lastModified: "2026-10-10", changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, lastModified: "2026-08-22", changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: "2026-07-04", changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: "2026-09-27", changeFrequency: "yearly", priority: 0.2 },
  ];
}
