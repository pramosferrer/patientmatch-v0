"use client";
import MatchWizard from "./MatchWizard";
import Link from "next/link";
import { useState } from "react";

export default function WizardPage() {
  const [previewTrials, setPreviewTrials] = useState<any[]>([]);
  return (
    <main className="min-h-[80vh] container mx-auto px-4 md:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MatchWizard onPreview={setPreviewTrials} />
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <div className="rounded-3xl border border-pm-border bg-white p-4 shadow-soft">
              <div className="text-sm font-medium text-pm-ink">Early results</div>
              <p className="text-xs text-pm-muted mt-1">We’ll show likely matches here as you review. No PII to start.</p>
              {previewTrials.length === 0 ? (
                <div className="mt-3 text-xs text-pm-muted">Results will appear after you click Continue. You can also view all results on the next page.</div>
              ) : (
                <ul className="mt-3 space-y-2">
                  {previewTrials.slice(0, 5).map((t: any) => (
                    <li key={t.nct_id} className="border border-pm-border rounded-xl p-2">
                      <div className="text-sm font-medium text-pm-ink line-clamp-2">{t.title}</div>
                      <div className="mt-1 text-[11px] text-pm-muted">Score: {Math.round(t.score ?? 0)}</div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <Link href="/trials?prefill=1" className="text-xs underline">Skip to results</Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}


