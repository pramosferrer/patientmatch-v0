"use client";

const TRUST_ITEMS = [
  {
    title: "Patient-first",
    body: "You decide what to share. Pause or withdraw any time.",
  },
  {
    title: "Clinically sourced",
    body: "Every listing comes straight from ClinicalTrials.gov.",
  },
  {
    title: "Clear next steps",
    body: "Know what to ask your clinician or the study team.",
  },
  {
    title: "Private by design",
    body: "We do not collect your contact information or show ads.",
  },
];

export function TrustBar() {
  return (
    <section className="py-14 bg-white" data-testid="trustbar">
      <div className="pm-container">
        <div className="grid grid-cols-2 gap-y-8 md:grid-cols-4">
          {TRUST_ITEMS.map(({ title, body }, i) => (
            <div
              key={title}
              className={`flex flex-col gap-2 pr-7 ${i > 0 ? "md:border-l md:border-border/50 md:pl-7" : ""}`}
            >
              <div className="text-[14.5px] font-semibold text-foreground">{title}</div>
              <p className="text-[13.5px] text-muted-foreground leading-[1.55]">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
