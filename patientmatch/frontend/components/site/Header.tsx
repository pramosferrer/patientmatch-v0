"use client";
import React from 'react';
import { Menu, User as UserIcon } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { MagicLinkDialog } from '@/components/auth/MagicLinkDialog';
import { useRouter } from 'next/navigation';

export default function Header() {
  const [open, setOpen] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false);
  const { user, supabase, status } = useSupabaseAuth();
  const router = useRouter();

  const initials = React.useMemo(() => {
    if (!user?.email) return null;
    return user.email.charAt(0).toUpperCase();
  }, [user?.email]);

  const handleSignOut = React.useCallback(async () => {
    try {
      await supabase?.auth.signOut();
      setOpen(false);
      setIsOpen(false);
      router.refresh();
    } catch {
      /* silent */
    }
  }, [router, supabase]);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
        {/* Left: logo */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Image src="/logo-mark.svg" alt="PatientMatch" width={24} height={24} className="h-6 w-6" />
          <span className="text-slate-900 font-semibold text-[17px] tracking-[-0.01em]">PatientMatch</span>
        </Link>

        {/* Center/Right: nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/conditions" className="text-[15px] md:text-[16px] text-slate-700 hover:text-slate-900">Conditions</Link>

          {/* Replace the hover-only div with an accessible disclosure */}
          <div className="relative">
            <button
              className="hover:underline text-pm-body flex items-center gap-1 text-[15px] md:text-[16px] text-slate-700 hover:text-slate-900"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              aria-controls="resources-menu"
              onClick={() => setIsOpen((v) => !v)}
              onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
            >
              Resources <span className="text-xs">⌄</span>
            </button>

            <div
              id="resources-menu"
              role="menu"
              className={cn(
                "absolute top-full left-0 mt-2 w-56 bg-white border border-pm-sky/20 rounded-lg shadow-soft transition-all duration-200 z-50",
                isOpen ? "opacity-100 visible" : "opacity-0 invisible"
              )}
              onMouseLeave={() => setIsOpen(false)}
            >
              <Link role="menuitem" className="block px-4 py-3 text-pm-body hover:bg-pm-sky/10 rounded-t-lg" href="/trials">Browse Trials</Link>
              <Link role="menuitem" className="block px-4 py-3 text-pm-body hover:bg-pm-sky/10" href="/how-it-works">How PatientMatch Works</Link>
              <Link role="menuitem" className="block px-4 py-3 text-pm-body hover:bg-pm-sky/10 rounded-b-lg" href="/resources/about-clinical-trials">About Clinical Trials</Link>
            </div>
          </div>

          <Link href="/refer" className="text-[15px] md:text-[16px] text-slate-700 hover:text-slate-900">For Physicians</Link>
          <Link href="/list-trial" className="text-[15px] md:text-[16px] text-slate-700 hover:text-slate-900">For Research Sites</Link>
          <Link href="/about" className="text-[15px] md:text-[16px] text-slate-700 hover:text-slate-900">About</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/match" className="hidden sm:block">
            <Button size="sm" variant="brand">
              Find My Match
            </Button>
          </Link>

          {status === "ready" ? (
            user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-white text-sm font-semibold uppercase text-pm-ink transition hover:bg-pm-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/40">
                  {initials ?? <UserIcon className="h-4 w-4" />}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 border border-hairline bg-white/95 backdrop-blur">
                  <DropdownMenuItem asChild>
                    <Link href="/account">Account</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account#saved">Saved studies</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      handleSignOut();
                    }}
                  >
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAuthDialogOpen(true)}>
                Sign in
              </Button>
            )
          ) : null}

          <button
            className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded border border-slate-200 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-300"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {open ? (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-0 h-full w-80 max-w-[80%] bg-white shadow-xl p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Menu</span>
              <button
                className="inline-flex h-9 px-3 rounded border border-slate-200 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-300"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <nav className="flex flex-col gap-4">
              <Button size="sm" variant="brand" onClick={() => setOpen(false)}>
                Find My Match
              </Button>

              {status === "ready" ? (
                user ? (
                  <>
                    <Link
                      href="/account"
                      className="text-[15px] text-slate-700 hover:text-slate-900"
                      onClick={() => setOpen(false)}
                    >
                      Account
                    </Link>
                    <Link
                      href="/account#saved"
                      className="text-[15px] text-slate-700 hover:text-slate-900"
                      onClick={() => setOpen(false)}
                    >
                      Saved studies
                    </Link>
                    <button
                      className="text-left text-[15px] text-slate-700 hover:text-slate-900"
                      onClick={() => {
                        handleSignOut();
                        setOpen(false);
                      }}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAuthDialogOpen(true);
                      setOpen(false);
                    }}
                  >
                    Sign in
                  </Button>
                )
              ) : null}

              <Link href="/conditions" className="text-[15px] text-slate-700 hover:text-slate-900" onClick={() => setOpen(false)}>Conditions</Link>

              {/* Mobile Resources dropdown */}
              <div className="relative">
                <button
                  className="text-[15px] text-slate-700 hover:text-slate-900 flex items-center justify-between w-full"
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  aria-controls="mobile-resources-menu"
                  onClick={() => setIsOpen((v) => !v)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
                >
                  Resources <span className="text-xs">⌄</span>
                </button>

                <div
                  id="mobile-resources-menu"
                  role="menu"
                  className={cn(
                    "mt-2 bg-slate-50 rounded-lg overflow-hidden",
                    isOpen ? "block" : "hidden"
                  )}
                >
                  <Link role="menuitem" className="block px-4 py-3 text-[15px] text-slate-700 hover:text-slate-900" href="/trials" onClick={() => { setOpen(false); setIsOpen(false); }}>Browse Trials</Link>
                  <Link role="menuitem" className="block px-4 py-3 text-[15px] text-slate-700 hover:text-slate-900" href="/how-it-works" onClick={() => { setOpen(false); setIsOpen(false); }}>How PatientMatch Works</Link>
                  <Link role="menuitem" className="block px-4 py-3 text-[15px] text-slate-700 hover:text-slate-900" href="/resources/about-clinical-trials" onClick={() => { setOpen(false); setIsOpen(false); }}>About Clinical Trials</Link>
                </div>
              </div>

              <Link href="/refer" className="text-[15px] text-slate-700 hover:text-slate-900" onClick={() => setOpen(false)}>For Physicians</Link>
              <Link href="/list-trial" className="text-[15px] text-slate-900" onClick={() => setOpen(false)}>For Research Sites</Link>
              <Link href="/about" className="text-[15px] text-slate-700 hover:text-slate-900" onClick={() => setOpen(false)}>About</Link>
            </nav>
          </div>
        </div>
      ) : null}

      <MagicLinkDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </header>
  );
}
