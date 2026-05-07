import { TrialsGridSkeleton } from "@/components/trials/TrialsGridSkeleton";

export default function TrialsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-16 z-30 border-b border-border/30 bg-background/97 backdrop-blur-md">
        <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-primary/10">
          <div className="h-full w-1/3 animate-[loading-bar_1.15s_ease-in-out_infinite] bg-primary" />
        </div>
        <div className="pm-container flex flex-wrap items-center gap-2 py-3">
          <div className="h-8 w-64 rounded-full bg-muted/60" />
          <div className="h-8 w-32 rounded-full bg-muted/50" />
          <div className="h-8 w-32 rounded-full bg-muted/50" />
          <div className="ml-auto h-5 w-24 rounded bg-muted/50" />
        </div>
      </div>
      <main className="pb-24 pt-10">
        <div className="pm-container">
          <div className="mb-6 h-4 w-44 rounded bg-muted/50" />
          <TrialsGridSkeleton count={8} />
        </div>
      </main>
    </div>
  );
}
