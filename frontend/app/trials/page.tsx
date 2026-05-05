export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import LoadMoreTrials from "@/components/trials/LoadMoreTrials";
import { TrialsGridSkeleton } from "@/components/trials/TrialsGridSkeleton";
import JsonLd from "@/components/trials/JsonLd";
import TrialsFilterBar from "@/components/trials/TrialsFilterBar";
import TrialsSmartSuggestions from "@/components/trials/TrialsSmartSuggestions";
import TrialsMapClient from "@/components/trials/TrialsMapClient";
import { Suspense, lazy } from "react";
import { Button } from "@/components/ui/button";
import { Search, AlertCircle } from "lucide-react";

import { fetchTrials, fetchFilterCounts } from "@/lib/matching/fetchTrials";
import RestoreSearch from "@/components/trials/RestoreSearch";
import TrackEventOnMount from "@/components/analytics/TrackEventOnMount";

const CompareDrawer = lazy(() => import("@/components/trials/CompareDrawer"));

function hasDiscoveryInput(searchParams: Record<string, string | string[] | undefined>): boolean {
  return [
    searchParams.q,
    searchParams.condition,
    searchParams.conditions,
    searchParams.zip,
    searchParams.sex,
    searchParams.age,
    searchParams.radius,
    searchParams.status_bucket,
    searchParams.status,
    searchParams.phases,
  ].some((value) => {
    if (Array.isArray(value)) return value.some((entry) => entry.trim().length > 0);
    return typeof value === "string" && value.trim().length > 0;
  });
}

export default async function TrialsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  try {
    noStore();
    const sp = await searchParams;
    const spSync = Object.fromEntries(
      Object.entries(sp).map(([k, v]) => [k, v])
    ) as Record<string, string | string[] | undefined>;

    const view = typeof spSync.view === "string" ? spSync.view : "list";
    const isMapView = view === "map";

    if (!hasDiscoveryInput(spSync)) {
      return (
        <div className="min-h-screen bg-background">
          <Suspense fallback={null}>
            <TrialsFilterBar
              totalCount={0}
              effectiveCondition=""
              effectiveZip=""
              expansionApplied={false}
              expansionNearestMiles={null}
            />
          </Suspense>
          <main className="pb-24 pt-8">
            <div className="pm-container">
              <div className="rounded-2xl border border-border/40 bg-surface-sage/30 p-10 text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground">
                  Search by condition to see matching trials
                </h1>
                <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                  PatientMatch works best when you start with a condition, symptom, or diagnosis.
                  No account or contact information is required.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button variant="brand" asChild>
                    <Link href="/conditions">Browse conditions</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/">Start from the homepage</Link>
                  </Button>
                </div>
              </div>
            </div>
          </main>
        </div>
      );
    }

    const cookieStore = await cookies();
    const profileCookieStr = cookieStore.get("pm_profile")?.value;
    const profile = profileCookieStr
      ? await import("@/shared/profileCookie").then(m => m.decryptProfileToken(profileCookieStr))
      : null;

    const trialsResult = await fetchTrials({ searchParams: spSync, profile });

    const {
      trialsData,
      totalCount,
      effectiveCondition,
      effectiveZip,
      page,
      phases,
      nearbyIds,
      conditionFilterValues,
      statusBucket,
      location,
      effectiveRadius,
      expansionApplied,
      expansionNearestMiles,
    } = trialsResult;

    // Fetch suggestion counts with resolved geo + condition context (COUNT-only, cheap)
    const refinedCounts = await fetchFilterCounts({
      conditionFilterValues,
      nearbyIds,
      currentPhases: phases,
      currentStatusBucket: statusBucket,
    });

    return (
      <div className="min-h-screen bg-background">
        <JsonLd trials={trialsData || []} />
        <TrackEventOnMount
          event="patient_trials_view"
          props={{
            condition_slug: effectiveCondition || undefined,
            zip_present: Boolean(effectiveZip),
          }}
        />

        {/* Sticky filter bar */}
        <Suspense fallback={null}>
          <TrialsFilterBar
            totalCount={totalCount || 0}
            effectiveCondition={effectiveCondition}
            effectiveZip={effectiveZip}
            expansionApplied={expansionApplied}
            expansionNearestMiles={expansionNearestMiles}
          />
        </Suspense>

        {/* Tier 3: smart suggestions banner (list view only) */}
        {!isMapView && (
          <Suspense fallback={null}>
            <TrialsSmartSuggestions
              totalCount={totalCount || 0}
              recruitingCount={refinedCounts.recruiting ?? null}
              phase2plusCount={refinedCounts.phase2plus ?? null}
              currentCondition={effectiveCondition}
              currentStatusBucket={statusBucket}
              currentPhases={phases}
            />
          </Suspense>
        )}

        {isMapView ? (
          /* ── Map view ─────────────────────────────────────────────────── */
          <TrialsMapClient
            trials={trialsData}
            centerLat={location?.lat ?? null}
            centerLon={location?.lon ?? null}
            radiusMiles={effectiveRadius}
            zip={effectiveZip}
            condition={effectiveCondition}
          />
        ) : (

          /* ── List view ────────────────────────────────────────────────── */
          <main className="pb-24 pt-6">
            <div className="pm-container">
              <Suspense fallback={null}>
                <RestoreSearch />
              </Suspense>

              <div className="mt-2 flex flex-col gap-6">
                {trialsData.length > 0 ? (
                  <Suspense fallback={<TrialsGridSkeleton count={8} />}>
                    <LoadMoreTrials
                      initialTrials={trialsData}
                      initialPage={page}
                      totalCount={totalCount || 0}
                      searchParams={spSync}
                      profile={profile}
                    />
                  </Suspense>
                ) : (
                  <div className="rounded-2xl bg-surface-sage/30 border border-border/40 p-12 text-center">
                    <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                      <Search className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">
                      No trials match your filters
                    </h3>
                    <p className="mt-3 text-muted-foreground max-w-md mx-auto">
                      Try adjusting your search criteria or exploring different conditions to find more studies.
                    </p>
                    <Button variant="brand" className="mt-6" asChild>
                      <a href="/trials">Clear all filters</a>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Suspense fallback={null}>
              <CompareDrawer>
                <div />
              </CompareDrawer>
            </Suspense>
          </main>
        )}
      </div>
    );

  } catch (err) {
    console.error("Trials page error", err);
    return (
      <main className="min-h-screen bg-background pb-16 pt-10">
        <div className="pm-container">
          <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-12 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-5">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">
              Unable to load trials
            </h3>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              We encountered an error loading the trials. Please try refreshing the page.
            </p>
            <Button variant="outline" className="mt-6" asChild>
              <a href="/trials">Try again</a>
            </Button>

          </div>
        </div>
      </main>
    );
  }
}
