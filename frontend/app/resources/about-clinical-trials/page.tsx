import { Metadata } from "next";
import { CtaBand } from "@/components/marketing/CtaBand";

export const metadata: Metadata = {
  title: "About Clinical Trials - Phases, Types, Safety, and Costs",
  description:
    "Understand how clinical trials work, their phases and types, safety oversight, and typical costs or compensation.",
  openGraph: {
    title: "About Clinical Trials - Phases, Types, Safety, and Costs",
    description:
      "Understand how clinical trials work, their phases and types, safety oversight, and typical costs or compensation.",
    type: "website",
  },
};

const phases = [
  {
    number: "1",
    label: "Phase 1",
    color: "#D97706",
    purpose: "Early safety and dose finding.",
    participants: "Often 20 to 100 people.",
  },
  {
    number: "2",
    label: "Phase 2",
    color: "#0369A1",
    purpose: "Tests whether the approach appears to work for a condition.",
    participants: "Often 100 to 300 people.",
  },
  {
    number: "3",
    label: "Phase 3",
    color: "#7C3AED",
    purpose: "Compares the treatment with standard care or another control before approval.",
    participants: "Often hundreds to thousands of people.",
  },
  {
    number: "4",
    label: "Phase 4",
    color: "#2D9B70",
    purpose: "Tracks safety and use after a treatment is approved.",
    participants: "Often hundreds to thousands of people.",
  },
];

const sections = [
  {
    eyebrow: "What trials are",
    title: "A structured way to answer a medical question.",
    rows: [
      "Clinical trials test ways to prevent, detect, treat, or manage disease.",
      "Every trial follows a written plan that explains who can join, what happens, and what outcomes are measured.",
      "Some trials test a medication or device. Others observe health over time without changing usual care.",
    ],
  },
  {
    eyebrow: "Study types",
    title: "Not every study asks participants to take a treatment.",
    rows: [
      "Interventional trials assign a study treatment, procedure, device, or program.",
      "Observational studies collect health information but do not assign a treatment.",
      "Remote and hybrid studies may reduce travel, but many still require some in-person visits.",
    ],
  },
  {
    eyebrow: "Safety",
    title: "Oversight is built into the process.",
    rows: [
      "Independent review boards evaluate the study plan before enrollment begins.",
      "Informed consent explains risks, benefits, alternatives, and participant rights.",
      "Safety is monitored throughout the study, and participants can leave at any time.",
    ],
  },
  {
    eyebrow: "Costs",
    title: "Ask what is covered before enrolling.",
    rows: [
      "Study treatments and research-only procedures are often covered by the sponsor.",
      "Routine care may still be billed to insurance depending on the study and your plan.",
      "Some studies offer travel reimbursement or compensation, but policies vary.",
    ],
  },
  {
    eyebrow: "Why participate",
    title: "The right reason is personal and specific.",
    rows: [
      "Some people want access to options that are not widely available yet.",
      "Some value closer monitoring from a team focused on their condition.",
      "Some participate to help future patients, even when direct benefit is uncertain.",
    ],
  },
];

const faqs = [
  {
    question: "Will I get a placebo instead of real treatment?",
    answer:
      "Some trials use a placebo to compare results. You should be told if a placebo is possible before you decide.",
  },
  {
    question: "Can I leave a trial if I change my mind?",
    answer:
      "Yes. Participation is voluntary. You can stop at any time without losing access to your usual medical care.",
  },
  {
    question: "Will it cost me anything?",
    answer:
      "Study-related costs are often covered, but routine care may be handled differently. Ask the study team what is covered.",
  },
  {
    question: "How is my safety protected?",
    answer:
      "Trials are reviewed by independent ethics boards, use informed consent, and include safety monitoring during the study.",
  },
];

const glossary = [
  {
    term: "Informed consent",
    definition: "The process and document that explain the study, risks, benefits, alternatives, and rights.",
  },
  {
    term: "Placebo",
    definition: "A comparison treatment that looks like the study option but has no active ingredient.",
  },
  {
    term: "Randomized",
    definition: "Participants are assigned to study groups by chance rather than by choice.",
  },
  {
    term: "Control group",
    definition: "A group used for comparison, often receiving standard care or placebo.",
  },
  {
    term: "Eligibility criteria",
    definition: "Health, history, lab, or logistics factors that determine who can join.",
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

export default function AboutClinicalTrialsPage() {
  return (
    <main className="bg-background">
      <section className="bg-white py-16 md:py-24">
        <div className="pm-container">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Clinical trials
            </p>
            <h1
              className="mt-5 font-display font-normal leading-[1.08] tracking-[-0.022em] text-foreground"
              style={{ fontSize: "clamp(36px, 4.2vw, 56px)" }}
            >
              A plain-English guide to joining research{" "}
              <em className="italic text-primary">with confidence.</em>
            </h1>
            <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground md:text-[17.5px]">
              Clinical trials help researchers learn whether a new approach is safe, effective, and
              worth using more broadly. This guide explains the basics before you start comparing
              studies.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#E8EDE6] py-24">
        <div className="pm-container grid gap-12 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="md:sticky md:top-24 md:self-start">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Trial phases
            </p>
            <h2
              className="mt-4 font-display font-normal leading-[1.14] tracking-[-0.015em] text-foreground"
              style={{ fontSize: "clamp(26px, 3vw, 40px)" }}
            >
              Each phase answers a different question.
            </h2>
          </div>
          <div className="divide-y divide-border/40">
            {phases.map((phase) => (
              <article key={phase.label} className="grid gap-4 py-8 first:pt-0 md:grid-cols-[112px_1fr]">
                <div
                  className="font-display font-light leading-none tracking-[-0.05em]"
                  style={{ fontSize: "76px", color: `${phase.color}38` }}
                  aria-hidden="true"
                >
                  {phase.number}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: phase.color }}>
                    {phase.label}
                  </p>
                  <h3 className="mt-2 text-[19px] font-semibold text-foreground">{phase.purpose}</h3>
                  <p className="mt-2 text-[15.5px] leading-relaxed text-muted-foreground">
                    {phase.participants}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {sections.map((section, index) => (
        <section key={section.eyebrow} className={index % 2 === 0 ? "bg-white py-24" : "bg-[#E8EDE6] py-24"}>
          <div className="pm-container grid gap-12 md:grid-cols-[5fr_7fr] md:gap-20">
            <div className="md:sticky md:top-24 md:self-start">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                {section.eyebrow}
              </p>
              <h2
                className="mt-4 font-display font-normal leading-[1.14] tracking-[-0.015em] text-foreground"
                style={{ fontSize: "clamp(26px, 3vw, 40px)" }}
              >
                {section.title}
              </h2>
            </div>
            <CheckRows rows={section.rows} />
          </div>
        </section>
      ))}

      <section className="bg-[#E8EDE6] py-24">
        <div className="pm-container grid gap-12 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="md:sticky md:top-24 md:self-start">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              FAQs
            </p>
            <h2
              className="mt-4 font-display font-normal leading-[1.14] tracking-[-0.015em] text-foreground"
              style={{ fontSize: "clamp(26px, 3vw, 40px)" }}
            >
              Common questions before enrollment.
            </h2>
          </div>
          <div className="divide-y divide-border/40">
            {faqs.map((faq) => (
              <details key={faq.question} className="group py-5 first:pt-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold text-foreground transition hover:text-primary">
                  {faq.question}
                  <span className="text-primary" aria-hidden="true">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">-</span>
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-muted-foreground">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="pm-container grid gap-12 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="md:sticky md:top-24 md:self-start">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Glossary
            </p>
            <h2
              className="mt-4 font-display font-normal leading-[1.14] tracking-[-0.015em] text-foreground"
              style={{ fontSize: "clamp(26px, 3vw, 40px)" }}
            >
              Terms you will see often.
            </h2>
          </div>
          <dl className="divide-y divide-border/40">
            {glossary.map((item) => (
              <div key={item.term} className="grid gap-2 py-5 first:pt-0 md:grid-cols-[190px_1fr] md:gap-8">
                <dt className="text-[15px] font-semibold text-foreground">{item.term}</dt>
                <dd className="text-[15.5px] leading-relaxed text-muted-foreground">{item.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <CtaBand
        title="Ready to explore your options?"
        description="Find clinical trials that match your health condition and preferences without sharing personal information to start."
        primaryLabel="Find clinical trials"
        primaryHref="/trials"
        secondaryLabel={undefined}
        secondaryHref={undefined}
      />
    </main>
  );
}
