// /components/StickyCTA.tsx
"use client";
import { useEffect, useState } from "react";

export default function StickyCTA() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [bottomCTAVisible, setBottomCTAVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrollableHeight = Math.max(document.body.scrollHeight - window.innerHeight, 1);
      const scrolled = window.scrollY / scrollableHeight;
      setVisible(scrolled > 0.35 && !bottomCTAVisible);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [bottomCTAVisible]);

  useEffect(() => {
    const target = document.querySelector("#bottom-cta-band");
    if (!target || typeof IntersectionObserver === "undefined") {
      setBottomCTAVisible(false);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setBottomCTAVisible(entry.isIntersecting);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 max-sm:left-4 max-sm:right-4">
      <div className="rounded-full shadow-lg bg-white/95 border border-slate-200 px-4 py-2 flex items-center gap-3">
        <span className="text-sm text-slate-700">Ready to find your match?</span>
        <a href="/trials?intake=1" className="rounded-full bg-pm-primary hover:bg-pm-primaryHover text-white px-4 py-2 text-sm">Start now</a>
        <button aria-label="Dismiss" onClick={() => setDismissed(true)} className="ml-1 text-slate-500">×</button>
      </div>
    </div>
  );
}
