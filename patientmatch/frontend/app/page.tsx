// app/page.tsx
import Hero from "@/components/Hero";
import { TrustBar } from "@/components/marketing/TrustBar";
import { Timeline } from "@/components/marketing/Timeline";
import { Checklist } from "@/components/marketing/Checklist";
import { CtaBand } from "@/components/marketing/CtaBand";
import { SectionDivider } from "@/components/marketing/SectionBand";

export default function HomePage() {
  return (
    <main className="relative">
      <Hero />
      <SectionDivider />
      <TrustBar />
      <Timeline />
      <SectionDivider />
      <Checklist />
      <SectionDivider />
      <CtaBand />
    </main>
  );
}
