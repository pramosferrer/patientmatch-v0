import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Search, HelpCircle, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Resources | PatientMatch',
  description: 'Guides and explanations to help you get started with clinical trial matching.',
  openGraph: {
    title: 'Resources | PatientMatch',
    description: 'Guides and explanations to help you get started with clinical trial matching.',
    type: 'website',
  },
};

const resources = [
  {
    icon: Search,
    title: 'Browse Trials',
    description: 'Explore all available clinical trials by condition, location, and study phase.',
    href: '/trials',
  },
  {
    icon: HelpCircle,
    title: 'How PatientMatch Works',
    description: 'Learn our simple 4-step process from initial screening to connecting with research sites.',
    href: '/resources/how-it-works',
  },
  {
    icon: BookOpen,
    title: 'About Clinical Trials',
    description: 'Understand trial phases, types, safety measures, and what to expect as a participant.',
    href: '/resources/about-clinical-trials',
  },
];

export default function ResourcesPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
      <div className="space-y-12">
        {/* Hero Section */}
        <section className="text-center">
          <h1 className="font-heading tracking-tightish leading-tight text-4xl md:text-5xl text-pm-ink font-bold mb-6">
            Resources
          </h1>
          <p className="text-pm-body text-xl leading-relaxed max-w-3xl mx-auto">
            Everything you need to understand clinical trials and how PatientMatch can help you find the right study.
          </p>
        </section>

        {/* Resources Grid */}
        <section className="grid md:grid-cols-3 gap-6">
          {resources.map((resource, index) => {
            const IconComponent = resource.icon;
            return (
              <div 
                key={index} 
                className="pm-card p-6 group hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-xl bg-pm-sky/50 text-pm-accent">
                    <IconComponent className="h-6 w-6" />
                  </div>
                </div>
                <h3 className="font-heading text-pm-ink text-lg font-semibold mb-4 group-hover:text-pm-accent transition-colors">
                  {resource.title}
                </h3>
                <p className="text-pm-body leading-relaxed mb-6">
                  {resource.description}
                </p>
                <Button 
                  asChild 
                  variant="outline" 
                  className="w-full justify-between border-pm-accent/20 text-pm-accent hover:bg-pm-accent hover:text-white transition-colors"
                >
                  <Link href={resource.href}>
                    Learn more
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </section>

        {/* Bottom CTA */}
        <section className="pm-card p-8 text-center">
          <h2 className="font-heading tracking-tightish leading-tight text-3xl text-pm-ink font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-pm-body text-lg mb-8 max-w-2xl mx-auto">
            Use our simple matching process to find clinical trials that may be right for you.
          </p>
          <Button asChild size="lg" className="px-8 py-3 text-lg rounded-xl bg-pm-accent hover:bg-pm-accentHover text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-ring">
            <Link href="/trials">Find My Match</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
