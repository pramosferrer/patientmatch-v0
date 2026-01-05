"use client";
export default function SectionHeader({ title, subtitle, step, totalSteps }) {
  return (
    <div className="text-center mb-8">
      {step && totalSteps && (
        <span className="inline-flex items-center rounded-full border border-pm-border bg-white px-2.5 py-1 text-xs font-medium text-pm-muted mb-4">
          Step {step} of {totalSteps}
        </span>
      )}
      <h1 className="text-3xl md:text-4xl font-bold text-pm-ink mb-4">{title}</h1>
      {subtitle && (
        <p className="text-lg text-pm-body max-w-2xl mx-auto">{subtitle}</p>
      )}
    </div>
  );
}
