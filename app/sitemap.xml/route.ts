import { fetchAllConditions } from "@/shared/conditions";
import { getSiteUrl } from "@/lib/site";

const base = getSiteUrl();

function absoluteUrl(path: string) {
  return new URL(path, base).toString();
}

export async function GET() {
  const routes = [
    { path: "", priority: 1.0 },
    { path: "trials", priority: 0.8 },
    { path: "conditions", priority: 0.7 },
    { path: "how-it-works", priority: 0.7 },
    { path: "resources", priority: 0.7 },
    { path: "resources/how-it-works", priority: 0.6 },
    { path: "resources/about-clinical-trials", priority: 0.6 },
    { path: "faq", priority: 0.5 },
    { path: "about", priority: 0.5 },
    { path: "privacy", priority: 0.3 },
    { path: "terms", priority: 0.3 },
  ];

  const urls = routes.map((route) => {
    const url = absoluteUrl(`/${route.path}`);
    return `<url><loc>${url}</loc><priority>${route.priority}</priority></url>`;
  });

  try {
    const conditions = await fetchAllConditions();
    const conditionUrls = conditions.slice(0, 100).map((condition) => {
      const url = absoluteUrl(`/conditions/${condition.slug}`);
      return `<url><loc>${url}</loc><priority>0.6</priority></url>`;
    });
    urls.push(...conditionUrls);
  } catch (error) {
    console.warn("Failed to fetch conditions for sitemap:", error);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.join("\n  ")}
</urlset>`;

  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}
