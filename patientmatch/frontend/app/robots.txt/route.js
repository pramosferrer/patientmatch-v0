export function GET() {
  return new Response(
`User-agent: *
Allow: /
Sitemap: https://patientmatch.com/sitemap.xml
`, { headers: { "Content-Type": "text/plain" } }
  );
}
