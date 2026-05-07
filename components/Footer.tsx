import Link from "next/link";

export default function Footer() {
  return (
    <footer className="py-12 border-t border-pm-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 text-pm-ink/80">
          <span>© 2024 PatientMatch</span>
          <span>•</span>
          <Link href="/privacy" className="hover:text-pm-secondary transition-colors">Privacy</Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-pm-secondary transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
