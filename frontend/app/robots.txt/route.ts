import { getSiteUrl } from "@/lib/site";

export function GET() {
  return new Response(
`User-agent: *
Allow: /
Disallow: /debug
Disallow: /refer
Disallow: /list-trial
Disallow: /account
Sitemap: ${getSiteUrl()}/sitemap.xml
`,
    { headers: { "Content-Type": "text/plain" } },
  );
}
