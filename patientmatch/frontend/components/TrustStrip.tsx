import { Shield, Database, EyeOff } from "lucide-react";

export default function TrustStrip() {
  const items = [
    { icon: Database, label: "Data from ClinicalTrials.gov" },
    { icon: EyeOff, label: "No PII required to screen" },
    { icon: Shield, label: "Privacy-first" },
  ];
  return (
    <section className="py-8">
      <div className="pm-container">
        <div className="rounded-none bg-warm-cream/80 p-4 shadow-card flex flex-wrap items-center justify-between gap-4 text-sm text-foreground">
          {items.map(({ icon: Icon, label }, i) => (
            <div key={i} className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              <Icon size={16} className="text-primary" aria-hidden="true" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
