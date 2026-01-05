// /frontend/components/StickyCTA.tsx
"use client";
import { useEffect, useState } from "react";

export default function StickyCTA() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      const bottomCTA = !!document.querySelector("#bottom-cta-band:is(:in-view)");
      setVisible(scrolled > 0.35 && !bottomCTA);
    };
    onScroll();
    const i = setInterval(onScroll, 250);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); clearInterval(i); };
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 max-sm:left-4 max-sm:right-4">
      <div className="rounded-full shadow-lg bg-white/95 border border-slate-200 px-4 py-2 flex items-center gap-3">
        <span className="text-sm text-slate-700">Ready to find your match?</span>
        <a href="/match" className="rounded-full bg-pm-primary hover:bg-pm-primaryHover text-white px-4 py-2 text-sm">Start now</a>
        <button aria-label="Dismiss" onClick={() => setDismissed(true)} className="ml-1 text-slate-500">×</button>
      </div>
    </div>
  );
}
