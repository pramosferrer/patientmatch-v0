import Link from 'next/link';

export const metadata = { title: "About Us • PatientMatch" };

export default function AboutPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-16 md:py-20">
      <div className="max-w-4xl">
        <h1 className="font-heading tracking-tightish leading-tight text-4xl md:text-5xl text-pm-ink font-bold mb-6">About PatientMatch</h1>
        <p className="text-pm-body text-base leading-7 mb-8">
          PatientMatch makes it fast and simple for people to discover clinical trials that fit.
          We translate complex criteria into plain language, pre‑screen privately, and connect
          patients with high‑quality studies—without requiring PII to get started.
        </p>

        <section className="mb-12">
          <h2 className="font-heading text-pm-ink text-2xl font-semibold mb-4">Our Mission</h2>
          <p className="text-pm-body leading-relaxed">
            Bridge the gap between patients and clinical research with a privacy‑first, human‑friendly
            experience. We aim to reduce friction and confusion so more people can access promising
            options—while saving time for research teams.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="font-heading text-pm-ink text-2xl font-semibold mb-4">Founder</h2>
          <p className="text-pm-body leading-relaxed">
            <strong>Pablo Ramos Ferrer</strong> is building PatientMatch with a product and data mindset:
            focus the experience on what people actually need, automate the busywork, and keep privacy
            non‑negotiable. If you&apos;re interested in partnering or giving feedback, we&apos;d love to hear from you.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="font-heading text-pm-ink text-2xl font-semibold mb-4">Company</h2>
          <p className="text-pm-body leading-relaxed">
            We&apos;re an early‑stage project focused on conditions with high unmet need and active research.
            We collaborate with physicians, research sites, and advocacy groups. Sponsors and sites can
            list trials and receive qualified, de‑identified leads.
          </p>
        </section>

        <div className="flex flex-wrap gap-4">
          <Link href="/contact" className="inline-flex items-center rounded-xl px-6 py-3 border border-pm-accent/20 bg-pm-accent/5 text-pm-accent hover:bg-pm-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-ring font-medium">
            Contact
          </Link>
          <Link href="/list-trial" className="inline-flex items-center rounded-xl px-6 py-3 border border-pm-accent/10 bg-pm-accent/5 text-pm-accent hover:bg-pm-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-ring font-medium">
            For Research Sites
          </Link>
        </div>
      </div>
    </main>
  );
}


