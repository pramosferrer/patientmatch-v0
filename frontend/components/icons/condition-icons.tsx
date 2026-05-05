import { Stethoscope } from "lucide-react";

export function ConditionIcon({ condition }: { condition?: string }) {
  // Extend this map over time with real glyphs per condition
  // e.g., { "COPD": <LungsIcon ... />, ... }
  return <Stethoscope size={18} aria-hidden />;
}
