import { fetchAllConditions } from '@/shared/conditions';

const base = "https://patientmatch.com";

export async function GET() {
  const routes = [
    { path: "", priority: 1.0 },                                    // home
    { path: "match", priority: 0.9 },                              // match flow
    { path: "trials", priority: 0.8 },                             // trials listing
    { path: "resources", priority: 0.7 },                          // resources hub
    { path: "resources/how-it-works", priority: 0.6 },             // how it works
    { path: "resources/about-clinical-trials", priority: 0.6 },    // about trials
    { path: "conditions", priority: 0.5 },                         // conditions
    { path: "refer", priority: 0.4 },                              // for physicians
    { path: "list-trial", priority: 0.4 },                         // for research sites
    { path: "about", priority: 0.5 },                              // about page
    { path: "privacy", priority: 0.3 },                            // privacy policy
    { path: "terms", priority: 0.3 },                              // terms of service
  ];

  const urls = routes.map(route => {
    const url = `${base}/${route.path}`.replace(/\/+/g, "/");
    return `<url><loc>${url}</loc><priority>${route.priority}</priority></url>`;
  });

  // Add condition pages
  try {
    const conditions = await fetchAllConditions();
    const conditionUrls = conditions.slice(0, 100).map(c => {
      const url = `${base}/conditions/${c.slug}`;
      return `<url><loc>${url}</loc><priority>0.6</priority></url>`;
    });
    urls.push(...conditionUrls);
  } catch (e) {
    console.warn('Failed to fetch conditions for sitemap:', e);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.join("\n  ")}
</urlset>`;

  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}
