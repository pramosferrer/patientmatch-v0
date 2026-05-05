export default function SkeletonCard() {
  return (
    <div className="bg-white border border-pm-border/60 rounded-2xl p-6 shadow-soft animate-pulse">
      {/* Condition and icon skeleton */}
      <div className="h-6 bg-pm-bg/50 rounded-lg mb-2"></div>
      <div className="h-4 bg-pm-bg/30 rounded w-3/4"></div>
      
      {/* Title skeleton */}
      <div className="mt-4 space-y-2">
        <div className="h-6 w-20 bg-pm-bg/50 rounded-xl"></div>
        <div className="h-4 bg-pm-bg/30 rounded w-full"></div>
        <div className="h-4 bg-pm-bg/30 rounded w-2/3"></div>
      </div>
      
      {/* Pills skeleton */}
      <div className="mt-4 flex flex-wrap gap-2">
        <div className="h-6 w-16 bg-pm-bg/50 rounded-xl"></div>
        <div className="h-6 w-20 bg-pm-bg/50 rounded-xl"></div>
        <div className="h-6 w-24 bg-pm-bg/50 rounded-xl"></div>
        <div className="h-6 w-18 bg-pm-bg/50 rounded-xl"></div>
      </div>
      
      {/* Sponsor skeleton */}
      <div className="mt-4">
        <div className="h-4 bg-pm-bg/30 rounded w-1/2 mb-3"></div>
        <div className="h-4 bg-pm-bg/30 rounded w-1/3"></div>
      </div>
      
      {/* CTA skeleton */}
      <div className="mt-6">
        <div className="h-12 bg-pm-bg/50 rounded-lg w-full"></div>
      </div>
    </div>
  );
}
