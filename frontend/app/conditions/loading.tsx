export default function ConditionsLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="fixed inset-x-0 top-16 z-40 h-0.5 overflow-hidden bg-primary/10">
        <div className="h-full w-1/3 animate-[loading-bar_1.15s_ease-in-out_infinite] bg-primary" />
      </div>

      <section className="border-b border-border/40 pb-14 pt-16">
        <div className="pm-container">
          <div className="max-w-[680px]">
            <div className="mb-4 h-3 w-36 rounded bg-primary/15" />
            <div className="mb-4 h-12 w-full max-w-[560px] rounded bg-muted/50" />
            <div className="mb-8 h-12 w-full max-w-[500px] rounded bg-muted/40" />
            <div className="h-12 w-full max-w-[480px] rounded-xl border border-border/50 bg-white shadow-sm" />
          </div>
        </div>
      </section>

      <div className="pm-container pb-24 pt-14">
        <div className="mb-16">
          <div className="mb-6 h-3 w-24 rounded bg-muted/50" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-52 rounded-2xl border border-border/45 bg-white p-7 shadow-sm">
                <div className="h-12 w-24 rounded bg-muted/50" />
                <div className="mt-8 h-5 w-36 rounded bg-muted/50" />
                <div className="mt-3 h-4 w-full rounded bg-muted/35" />
                <div className="mt-2 h-4 w-2/3 rounded bg-muted/35" />
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5 h-3 w-36 rounded bg-muted/50" />
        <div className="border-t border-border/40">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-2.5 py-[13px]">
              <div className="h-2 w-2 rounded-full bg-muted/60" />
              <div className="h-5 flex-1 rounded bg-muted/35" />
              <div className="h-4 w-8 rounded bg-muted/35" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
