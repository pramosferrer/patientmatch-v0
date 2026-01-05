/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

function cspValue() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const connectSrc = [
    "'self'",
    "https://*.supabase.co", // Safe default for Supabase
    ...(supabaseUrl ? [supabaseUrl] : []), // Add specific URL if defined
    ...(isDev ? ["ws:", "wss:"] : []), // WebSocket support for HMR in dev only
  ].join(" ");

  const base = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com https:",
    `connect-src ${connectSrc}`,
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  return base.join("; ");
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: cspValue() },
];

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
