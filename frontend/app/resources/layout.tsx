import Link from "next/link";
import { ArrowLeft, BookOpen, Users, FileText } from "lucide-react";

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-pm-bg/30">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <nav className="mb-8">
          <Link 
            href="/" 
            className="flex items-center gap-1 hover:text-pm-secondary transition-colors text-pm-muted"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </nav>

        {/* Header */}
        <header className="py-8 border-b border-pm-border/20">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-pm-ink mb-2">Resources</h1>
            <p className="text-pm-body text-lg">Educational content to help you understand clinical trials and make informed decisions.</p>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap justify-center gap-4 mb-8">
          <Link 
            href="/resources" 
            className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-pm-bg/50 hover:text-pm-secondary transition-colors"
          >
            <BookOpen size={16} />
            Overview
          </Link>
          <Link 
            href="/resources/how-it-works" 
            className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-pm-bg/50 hover:text-pm-secondary transition-colors"
          >
            <Users size={16} />
            How It Works
          </Link>
          <Link 
            href="/resources/about-clinical-trials" 
            className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-pm-bg/50 hover:text-pm-secondary transition-colors"
          >
            <FileText size={16} />
            About Clinical Trials
          </Link>
        </nav>

        {/* Content */}
        {children}
      </div>
    </div>
  );
}
