"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/conditions", label: "Conditions" },
  { href: "/resources", label: "Resources" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-white/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" aria-label="PatientMatch home" className="flex items-center gap-2">
          <Image src="/logo-word.svg" alt="PatientMatch" width={120} height={24} className="h-6 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            >
              {link.label}
            </Link>
          ))}

          <Button asChild className="ml-2">
            <Link
              href="/trials"
              aria-label="Find trials"
            >
              Find trials
            </Link>
          </Button>
        </nav>
        <div className="flex items-center gap-2 md:hidden">
          <Button asChild size="sm">
            <Link href="/trials" aria-label="Find trials" onClick={() => setMobileOpen(false)}>
              Find trials
            </Link>
          </Button>
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-white text-foreground transition hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="border-t border-border/40 bg-white px-4 py-3 shadow-sm md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
