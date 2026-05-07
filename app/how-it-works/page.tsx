import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CtaBand } from "@/components/marketing/CtaBand";

export const metadata: Metadata = {
  title: "How PatientMatch Works - Find Clinical Trials in Minutes",
  description:
    "See how PatientMatch helps you find and check if you qualify for clinical trials. Simple, private, and free.",
  openGraph: {
    title: "How PatientMatch Works - Find Clinical Trials in Minutes",
    description:
      "See how PatientMatch helps you find and check if you qualify for clinical trials. Simple, private, and free.",
    type: "website",
  },
};

const steps = [
  {
    numeral: "01",
    title: "Find trials for your condition",
    copy: "Search by condition, location, status, and basic fit signals. Start broad, then narrow the list when you are ready.",
    note: "No account needed to browse.",
  },
  {
    numeral: "02",
    title: "Check if you may qualify",
    copy: "We turn complex eligibility criteria into patient-friendly questions so obvious blockers are easier to spot.",
    note: "Most checks take a few minutes.",
  },
  {
    numeral: "03",
    title: "Prepare your next step",
    copy: "Use the plain-language summary and official listing to decide what to ask your clinician or the study team.",
    note: "Nothing is sent to trial sites.",
  },
];

const trustRows = [
  "You can browse anonymously and pre-screen without giving contact information.",
  "PatientMatch is currently a free public-good project for patients.",
  "Trial information comes from public registries and is refreshed by an automated daily job.",
];

const faqItems = [
  {
    q: "Is this really free?",
    a: "Yes. PatientMatch is completely free for patients. We do not charge fees or require payment to search.",
  },
  {
    q: "How do you make money?",
    a: "PatientMatch is currently focused on transparent trial discovery rather than selling patient leads.",
  },
  {
    q: "Is my information safe?",
    a: "You can browse anonymously. We avoid collecting contact information and keep matching details local whenever possible.",
  },
  {
    q: "What happens after I find a trial?",
    a: "You can review your screening summary, save or share it, and use the official ClinicalTrials.gov page to decide what to ask your doctor or the study team.",
  },
  {
    q: "Can I change my mind?",
    a: "Yes. You can stop at any point. Even after speaking with a study team, you are never obligated to participate.",
  },
];

function CheckRows({ rows }: { rows: string[] }) {
  return (
    <div className="divide-y divide-border/40">
      {rows.map((row) => (
        <div key={row} className="grid grid-cols-[20px_1fr] gap-4 py-4">
          <span className="pt-0.5 text-[15px] font-semibold text-primary" aria-hidden="true">
            ✓
          </span>
          <p className="text-[15.5px] leading-relaxed text-muted-foreground">{row}</p>
        </div>
      ))}
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="bg-background">
      <section className="bg-white py-16 md:py-24">
        <div className="pm-container">
          <div className="mx-auto max-w-3xl text-left md:text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              How it works
            </p>
            <h1
              className="mt-5 font-display font-normal leading-[1.08] tracking-[-0.022em] text-foreground"
              style={{ fontSize: "clamp(36px, 4.2vw, 56px)" }}
            >
              Finding a clinical trial should be simple enough to{" "}
              <em className="italic text-primary">act on.</em>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground md:text-[17.5px]">
              PatientMatch helps you search active studies, answer private screening questions, and
              leave with a clearer next step.
            </p>
            <div className="mt-8">
              <Button asChild variant="brand" size="lg" className="h-12 px-7 text-[15px]">
                <Link href="/trials">Find trials for your condition</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#E8EDE6] py-24">
        <div className="pm-container grid gap-12 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="md:sticky md:top-24 md:self-start">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Three steps
            </p>
            <h2
              className="mt-4 font-display font-normal leading-[1.14] tracking-[-0.015em] text-foreground"
              style={{ fontSize: "clamp(26px, 3vw, 40px)" }}
            >
              From broad search to a practical shortlist.
            </h2>
          </div>
          <div className="divide-y divide-border/40">
            {steps.map((step) => (
              <article key={step.numeral} className="grid gap-4 py-8 first:pt-0 md:grid-cols-[112px_1fr]">
                <div
                  className="font-display font-light leading-none tracking-[-0.05em] text-primary/[0.22]"
                  style={{ fontSize: "76px" }}
                  aria-hidden="true"
                >
                  {step.numeral}
                </div>
                <div>
                  <h3 className="text-[19px] font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-[15.5px] leading-relaxed text-muted-foreground">
                    {step.copy}
                  </p>
                  <p className="mt-3 text-[12.5px] text-muted-foreground/70">{step.note}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="pm-container grid gap-12 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="md:sticky md:top-24 md:self-start">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Trust
            </p>
            <h2
              className="mt-4 font-display font-normal leading-[1.14] tracking-[-0.015em] text-foreground"
              style={{ fontSize: "clamp(26px, 3vw, 40px)" }}
            >
              Designed for private exploration first.
            </h2>
          </div>
          <CheckRows rows={trustRows} />
        </div>
      </section>

      <section className="bg-[#E8EDE6] py-24">
        <div className="pm-container grid gap-12 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="md:sticky md:top-24 md:self-start">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Common questions
            </p>
            <h2
              className="mt-4 font-display font-normal leading-[1.14] tracking-[-0.015em] text-foreground"
              style={{ fontSize: "clamp(26px, 3vw, 40px)" }}
            >
              The basics before you start.
            </h2>
          </div>
          <div className="divide-y divide-border/40">
            {faqItems.map((item) => (
              <details key={item.q} className="group py-5 first:pt-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold text-foreground transition hover:text-primary">
                  {item.q}
                  <span className="text-primary" aria-hidden="true">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">-</span>
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Ready to explore your options?"
        description="Search actively enrolling studies and see which ones may be worth discussing."
        primaryLabel="Find clinical trials"
        primaryHref="/trials"
        secondaryLabel={undefined}
        secondaryHref={undefined}
      />
    </main>
  );
}
