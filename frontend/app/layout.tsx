import type { Metadata } from "next";
import "./globals.css";
import { Inter, Manrope, Merriweather, Fraunces } from "next/font/google";
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
import { getSiteUrl } from "@/lib/site";

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

// Fraunces: Warm, trustworthy display font for trial titles and key headlines
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "PatientMatch — Privacy-first clinical trial discovery",
  description: "Find clinical trials that are actively enrolling, see if they may fit you, and bring a clear summary to your doctor.",
  metadataBase: new URL(siteUrl),
  keywords:
    'clinical trials, patient matching, medical research, clinical study, trial finder',
  authors: [{ name: 'PatientMatch' }],
  openGraph: {
    title: 'PatientMatch — Privacy-first clinical trial discovery',
    description:
      'Find clinical trials that are actively enrolling, see if they may fit you, and bring a clear summary to your doctor.',
    url: siteUrl,
    siteName: 'PatientMatch',
    images: [{ url: `${siteUrl}/og-image.png`, width: 1200, height: 630, alt: 'PatientMatch - Find Your Clinical Trial' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PatientMatch — Privacy-first clinical trial discovery',
    description:
      'Find clinical trials that are actively enrolling, see if they may fit you, and bring a clear summary to your doctor.',
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
    "description": "Find clinical trials that are actively enrolling, see if they may fit you, and bring a clear summary to your doctor.",
    "url": siteUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${siteUrl}/trials?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    },
    "sameAs": [siteUrl]
  };

  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${merriweather.variable} ${fraunces.variable}`} suppressHydrationWarning>
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
              <Button
                asChild
                variant="brand"
                size="sm"
                className="ml-auto text-sm shadow-none md:hidden"
                aria-label="Find trials"
              >
                <Link href="/trials">Find trials</Link>
              </Button>
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
                  Privacy-first clinical trial discovery using public ClinicalTrials.gov data.
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
                    <Link href="/conditions">Conditions</Link>
                  </li>
                  <li>
                    <Link href="/how-it-works">How It Works</Link>
                  </li>
                </ul>
              </div>
              <div>
                <div className="mb-3 font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
                  Resources
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="/resources">Guides</Link>
                  </li>
                  <li>
                    <Link href="/resources/about-clinical-trials">About Clinical Trials</Link>
                  </li>
                  <li>
                    <Link href="/privacy">Privacy</Link>
                  </li>
                </ul>
              </div>
              <div>
                <div className="mb-3 font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
                  Your privacy
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  No accounts required. We do not collect your contact information. Use PatientMatch to
                  explore trial options and prepare questions for your doctor or the study team.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
