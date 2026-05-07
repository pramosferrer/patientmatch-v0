export default function SkeletonCriteria() {
  return (
    <div className="bg-white border border-pm-border rounded-2xl p-4 animate-pulse">
      <div className="space-y-4">
        <div className="h-4 bg-pm-bg/50 rounded w-1/3"></div>
        <div className="h-4 bg-pm-bg/30 rounded w-full"></div>
        <div className="h-4 bg-pm-bg/30 rounded w-2/3"></div>
      </div>
    </div>
  );
}
