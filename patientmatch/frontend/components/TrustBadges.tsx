import { Shield, Database, EyeOff } from "lucide-react";

export default function TrustBadges() {
  const items = [
    { icon: Database, label: "Data from ClinicalTrials.gov" },
    { icon: EyeOff, label: "No PII required to screen" },
    { icon: Shield, label: "HIPAA-aligned security" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map(({icon:Icon,label},i)=>(
        <div key={i} className="flex items-center gap-2 rounded-full bg-warm-cream/80 px-3 py-1.5 text-sm text-foreground shadow-inner">
          <Icon size={16} className="text-primary" aria-hidden="true" />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
