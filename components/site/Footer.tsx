import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-pm-border/60">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Image src="/logo-word.svg" alt="PatientMatch" width={120} height={32} className="h-8 w-auto" />
            </div>
            <p className="text-pm-body mb-4 max-w-md">
              Privacy-first clinical trial discovery using public ClinicalTrials.gov data. We do
              not collect your contact information.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-pm-ink mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link className="hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-secondary rounded" href="/about">About</Link>
              </li>
              <li>
                <Link className="hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-secondary rounded" href="/faq">FAQ</Link>
              </li>
              <li>
                <Link className="hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-secondary rounded" href="/privacy">Privacy</Link>
              </li>
              <li>
                <Link className="hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-secondary rounded" href="/terms">Terms</Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold text-pm-ink mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link className="hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-secondary rounded" href="/resources">Guides</Link>
              </li>
              <li>
                <Link className="hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-secondary rounded" href="/resources/about-clinical-trials">About Trials</Link>
              </li>
              <li>
                <Link className="hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-secondary rounded" href="/resources/how-it-works">How It Works</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-pm-border/60 mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-pm-muted">
            © 2026 PatientMatch.
          </p>
          <div className="flex items-center gap-6 text-sm text-pm-muted">
            <span>Local-first privacy</span>
            <span>•</span>
            <span>No contact information collected</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
