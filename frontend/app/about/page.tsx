import Link from 'next/link';

export const metadata = { title: "About Us • PatientMatch" };

export default function AboutPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-16 md:py-20">
      <div className="max-w-4xl">
        <h1 className="font-heading tracking-tightish leading-tight text-4xl md:text-5xl text-pm-ink font-bold mb-6">About PatientMatch</h1>
        <p className="text-pm-body text-base leading-7 mb-8">
          PatientMatch makes it fast and simple for people to discover clinical trials that fit.
          We translate complex criteria into plain language and pre-screen privately without
          requiring contact information.
        </p>

        <section className="mb-12">
          <h2 className="font-heading text-pm-ink text-2xl font-semibold mb-4">Our Mission</h2>
          <p className="text-pm-body leading-relaxed">
            Bridge the gap between patients and public clinical trial information with a privacy‑first, human‑friendly
            experience. We aim to reduce friction and confusion so more people can access promising
            options and have better conversations with clinicians or study teams.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="font-heading text-pm-ink text-2xl font-semibold mb-4">Founder</h2>
          <p className="text-pm-body leading-relaxed">
            <strong>Pablo Ramos Ferrer</strong> is building PatientMatch with a product and data mindset:
            focus the experience on what people actually need, automate the busywork, and keep privacy
            non‑negotiable.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="font-heading text-pm-ink text-2xl font-semibold mb-4">About this project</h2>
          <p className="text-pm-body leading-relaxed">
            We&apos;re an early-stage public-good project focused on conditions with high unmet need and
            active research. PatientMatch does not collect patient leads or send patient details to
            research sites.
          </p>
          <p className="mt-4 text-pm-body leading-relaxed">
            Trial listings come from public ClinicalTrials.gov data and are translated into plain-English
            summaries, screening questions, and discussion points. PatientMatch is not medical advice;
            final eligibility always comes from the study team.
          </p>
        </section>

        <div className="flex flex-wrap gap-4">
          <Link href="/trials" className="inline-flex items-center rounded-xl px-6 py-3 border border-pm-accent/20 bg-pm-accent/5 text-pm-accent hover:bg-pm-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-ring font-medium">
            Find Trials
          </Link>
          <Link href="/privacy" className="inline-flex items-center rounded-xl px-6 py-3 border border-pm-accent/10 bg-pm-accent/5 text-pm-accent hover:bg-pm-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-ring font-medium">
            Privacy
          </Link>
        </div>
      </div>
    </main>
  );
}
