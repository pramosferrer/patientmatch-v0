import type { Metadata } from "next";
import "./globals.css";
import "./debug/env-check";
import { Inter, Manrope, Merriweather } from "next/font/google";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import Script from "next/script";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthSessionBridge } from "@/components/auth/AuthSessionBridge";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-serif",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "PatientMatch — Find the right clinical trial",
  description: "Plain‑English trial matching. Fast, free, confidential.",
  metadataBase: new URL(siteUrl),
  keywords:
    'clinical trials, patient matching, medical research, clinical study, trial finder',
  authors: [{ name: 'PatientMatch' }],
  openGraph: {
    title: 'PatientMatch — Find the right clinical trial',
    description:
      'Plain‑English trial matching. Fast, free, confidential.',
    url: 'https://patientmatch.com',
    siteName: 'PatientMatch',
    images: [{ url: `${siteUrl}/og-image.png`, width: 1200, height: 630, alt: 'PatientMatch - Find Your Clinical Trial' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PatientMatch — Find the right clinical trial',
    description:
      'Plain‑English trial matching. Fast, free, confidential.',
    images: [`${siteUrl}/og-image.png`],
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "PatientMatch",
    "description": "Find the right clinical trial — fast, free, and confidential.",
    "url": siteUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${siteUrl}/match`
      },
      "query-input": "required name=search_term_string"
    },
    "sameAs": [
      "https://patientmatch.com"
    ]
  };

  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${merriweather.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" />
        <Script
          id="website-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.className} bg-[var(--color-background)] text-foreground antialiased`}>
        <div className="relative min-h-screen">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black focus:shadow"
          >
            Skip to content
          </a>

          {/* Top nav */}
          <header className="sticky top-0 z-40 border-b border-[color:var(--pm-hairline)]/75 bg-[color:var(--color-card)]/80 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-card)]/65">
            <div className="pm-container flex items-center justify-between gap-6 py-3">
              <Link
                href="/"
                className="text-lg font-semibold tracking-tight transition hover:opacity-85"
              >
                <span className="font-heading text-xl text-foreground">PatientMatch</span>
              </Link>
              <nav className="hidden items-center gap-6 text-sm md:flex">
                <Link
                  href="/conditions"
                  className="rounded text-muted-foreground transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  Conditions
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-1 rounded text-muted-foreground transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2">
                    Resources <ChevronDown className="h-3 w-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 border border-hairline bg-white/90 text-foreground shadow-card backdrop-blur"
                  >
                    <DropdownMenuItem asChild>
                      <Link href="/how-it-works" className="w-full">
                        How PatientMatch Works
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/resources/about-clinical-trials" className="w-full">
                        About Clinical Trials
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Link
                  href="/about"
                  className="rounded text-muted-foreground transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  About
                </Link>

                <Button
                  asChild
                  variant="brand"
                  size="sm"
                  className="ml-2 text-sm shadow-none"
                  aria-label="Find trials"
                >
                  <Link href="/trials">Find trials</Link>
                </Button>
              </nav>
            </div>
          </header>

          <main id="main-content" className="relative overflow-hidden">
            <TooltipProvider>
              <AuthSessionBridge />
              {children}
            </TooltipProvider>
          </main>

          <footer className="mt-24 pb-12 pt-12">
            <div className="pm-container grid gap-12 md:grid-cols-4">
              <div>
                <div className="font-serif text-xl text-foreground">PatientMatch</div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Find the right clinical trial — fast, free, confidential.
                </p>
              </div>
              <div>
                <div className="mb-3 font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
                  Company
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="/about">About</Link>
                  </li>
                  <li>
                    <Link href="/resources">Resources</Link>
                  </li>
                  <li>
                    <Link href="/privacy">Privacy</Link>
                  </li>
                </ul>
              </div>
              <div>
                <div className="mb-3 font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
                  For Professionals
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="/refer">For Physicians</Link>
                  </li>
                  <li>
                    <Link href="/list-trial">For Research Sites</Link>
                  </li>
                </ul>
              </div>
              <div>
                <div className="mb-3 font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
                  Get Updates
                </div>
                <form className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Email"
                    className="w-full rounded-xl border border-hairline bg-white/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    type="submit"
                    variant="brand"
                    size="sm"
                    className="whitespace-nowrap px-5"
                  >
                    Subscribe
                  </Button>
                </form>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
