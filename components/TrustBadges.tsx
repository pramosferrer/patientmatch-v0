import { Shield, Database, EyeOff } from "lucide-react";

export default function TrustBadges() {
  const items = [
    { icon: Database, label: "ClinicalTrials.gov source" },
    { icon: EyeOff, label: "No contact forms" },
    { icon: Shield, label: "Browser-only saves" },
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
