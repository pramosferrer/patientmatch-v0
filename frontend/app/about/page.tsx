import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "About PatientMatch",
  description:
    "PatientMatch is a privacy-first clinical trial discovery project built from public trial data.",
};

const principles = [
  {
    title: "Readable public data",
    body: "ClinicalTrials.gov listings are public, but they are rarely written for patients. We translate the structure into plain-language summaries, practical filters, and screening questions.",
  },
  {
    title: "Private by default",
    body: "You can browse and pre-screen without giving us your name, email, or phone number. We do not sell leads or send patient details to trial sites.",
  },
  {
    title: "Pre-screening, not medical advice",
    body: "PatientMatch can flag likely fits and obvious blockers. Final eligibility still depends on records, labs, imaging, and site review.",
  },
];

const missionRows = [
  "Make trial discovery usable before someone shares contact information.",
  "Show why a study may or may not fit in language patients can discuss with a clinician.",
  "Point back to official listings instead of hiding the source of truth.",
];

const founderRows = [
  "PatientMatch is being built independently by Pablo Ramos Ferrer.",
  "The work is focused on patient utility: fewer opaque listings, less lead generation, and clearer next steps.",
  "The product stays intentionally narrow: explain public information, support private pre-screening, and help people prepare better questions.",
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

export default function AboutPage() {
  return (
    <main className="bg-background">
      <section className="bg-white py-16 md:py-24">
        <div className="pm-container">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              About PatientMatch
            </p>
            <h1
              className="mt-5 font-display font-normal leading-[1.08] tracking-[-0.022em] text-foreground"
              style={{ fontSize: "clamp(36px, 4.2vw, 56px)" }}
            >
              Clinical trial search should feel clear, private, and{" "}
              <em className="italic text-primary">human.</em>
            </h1>
            <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground md:text-[17.5px]">
              PatientMatch helps people find active clinical trials, answer patient-friendly
              screening questions, and prepare for a more focused conversation with their doctor or
              a study team.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="brand" className="h-12 px-7 text-[15px]">
                <Link href="/trials">Find trials</Link>
              </Button>
              <Button asChild variant="outline" className="h-12 px-7 text-[15px]">
                <Link href="/privacy">Read the privacy policy</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#E8EDE6] py-24">
        <div className="pm-container grid gap-12 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="md:sticky md:top-24 md:self-start">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Mission
            </p>
            <h2
              className="mt-4 font-display font-normal leading-[1.14] tracking-[-0.015em] text-foreground"
              style={{ fontSize: "clamp(26px, 3vw, 40px)" }}
            >
              Turn registry data into a better patient decision.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground">
              We focus on the practical gap between finding a listing and knowing what to ask next.
            </p>
          </div>
          <CheckRows rows={missionRows} />
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="pm-container grid gap-12 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="md:sticky md:top-24 md:self-start">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Principles
            </p>
            <h2
              className="mt-4 font-display font-normal leading-[1.14] tracking-[-0.015em] text-foreground"
              style={{ fontSize: "clamp(26px, 3vw, 40px)" }}
            >
              Built for trust before conversion.
            </h2>
          </div>
          <div className="divide-y divide-border/40">
            {principles.map((item) => (
              <article key={item.title} className="py-6 first:pt-0">
                <h3 className="text-[18px] font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-[15.5px] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#E8EDE6] py-24">
        <div className="pm-container grid gap-12 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="md:sticky md:top-24 md:self-start">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Founder
            </p>
            <h2
              className="mt-4 font-display font-normal leading-[1.14] tracking-[-0.015em] text-foreground"
              style={{ fontSize: "clamp(26px, 3vw, 40px)" }}
            >
              Independent, practical, and privacy-first.
            </h2>
          </div>
          <CheckRows rows={founderRows} />
        </div>
      </section>
    </main>
  );
}
