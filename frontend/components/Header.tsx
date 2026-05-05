"use client";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-white/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" aria-label="PatientMatch home" className="flex items-center gap-2">
          <Image src="/logo-word.svg" alt="PatientMatch" width={120} height={24} className="h-6 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/conditions" className="text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">Conditions</Link>
          <Link href="/resources" className="text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">Resources</Link>
          <Link href="/about" className="text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">About</Link>

          <Link href="/privacy" className="text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">Privacy</Link>

          <Button asChild className="ml-2">
            <Link
              href="/trials"
              aria-label="Find trials"
            >
              Find trials
            </Link>
          </Button>
        </nav>
        <Button asChild className="md:hidden" size="sm">
          <Link href="/trials" aria-label="Start matching">
            Start
          </Link>
        </Button>
      </div>
    </header>
  );
}
