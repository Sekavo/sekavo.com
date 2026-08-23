import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app/", "/api/", "/onboarding"] },
    sitemap: "https://sekavo.com/sitemap.xml",
  };
}
