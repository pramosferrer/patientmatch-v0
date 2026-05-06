import Link from "next/link";
import { Database, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "About PatientMatch",
  description:
    "PatientMatch is a privacy-first clinical trial discovery project built from public trial data.",
};

const principles = [
  {
    title: "Public trial data, made readable",
    body: "We start with ClinicalTrials.gov listings, then organize the information into summaries, screening questions, and next-step prompts that are easier to discuss with a clinician or study team.",
    icon: Database,
  },
  {
    title: "Private by default",
    body: "You can browse and pre-screen without giving us your name, email, or phone number. We do not sell leads or send patient details to trial sites.",
    icon: EyeOff,
  },
  {
    title: "A pre-screen, not a decision",
    body: "PatientMatch can flag likely fits and obvious blockers. Final eligibility still depends on records, labs, imaging, and site review.",
    icon: ShieldCheck,
  },
];

export default function AboutPage() {
  return (
    <main className="bg-background">
      <section className="pm-container py-12 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start">
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="pm-eyebrow text-[11px] font-semibold">About PatientMatch</p>
              <h1 className="font-heading text-[34px] font-semibold leading-tight text-foreground md:text-5xl">
                Clinical trial search should be easier to understand.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                PatientMatch helps people find active clinical trials, answer patient-friendly
                screening questions, and prepare for a more focused conversation with their doctor
                or a study team.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="brand" className="rounded-lg">
                <Link href="/trials">Find trials</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-lg">
                <Link href="/privacy">Read the privacy policy</Link>
              </Button>
            </div>
          </div>

          <aside className="rounded-lg border border-border/60 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">Built independently</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              PatientMatch is being built by Pablo Ramos Ferrer as a privacy-first public-good
              project. The goal is practical: make public trial information easier for patients to
              use without turning them into referrals.
            </p>
          </aside>
        </div>
      </section>

      <section className="border-y border-border/40 bg-white/70">
        <div className="pm-container py-10 md:py-12">
          <div className="grid gap-5 md:grid-cols-3">
            {principles.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-lg border border-border/50 bg-white p-5 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pm-container py-10 md:py-14">
        <div className="max-w-3xl space-y-4">
          <h2 className="text-xl font-semibold text-foreground">What we are trying to fix</h2>
          <p className="text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
            Clinical trial listings are public, but they are rarely written for the people deciding
            whether to ask about them. PatientMatch focuses on the gap between a registry listing
            and a useful next step: what the study is testing, what might rule someone out, and what
            to confirm before spending time on outreach.
          </p>
          <p className="text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
            The product is intentionally narrow. We explain public information, help with private
            pre-screening, and point back to the official study listing. We do not provide medical
            advice or contact research sites on a patient&apos;s behalf.
          </p>
        </div>
      </section>
    </main>
  );
}
