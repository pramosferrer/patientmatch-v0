export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";

import LoadMoreTrials from "@/components/trials/LoadMoreTrials";
import { TrialsGridSkeleton } from "@/components/trials/TrialsGridSkeleton";
import JsonLd from "@/components/trials/JsonLd";
import TrialsFilterBar from "@/components/trials/TrialsFilterBar";
import TrialsSmartSuggestions from "@/components/trials/TrialsSmartSuggestions";
import TrialsMapClient from "@/components/trials/TrialsMapClient";
import TrialsIntakeStepper from "@/components/trials/TrialsIntakeStepper";
import { Suspense, lazy } from "react";
import { Button } from "@/components/ui/button";
import { Search, AlertCircle } from "lucide-react";

import { fetchTrials, fetchFilterCounts } from "@/lib/matching/fetchTrials";
import RestoreSearch from "@/components/trials/RestoreSearch";
import TrackEventOnMount from "@/components/analytics/TrackEventOnMount";

const CompareDrawer = lazy(() => import("@/components/trials/CompareDrawer"));


function formatCaughtError(err: unknown) {
  if (err instanceof Error) {
    return JSON.stringify({
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
  }

  if (err && typeof err === "object") {
    const fields = Object.fromEntries(
      Reflect.ownKeys(err).map((key) => [
        String(key),
        (err as Record<PropertyKey, unknown>)[key],
      ]),
    );
    return JSON.stringify({
      type: Object.prototype.toString.call(err),
      stringValue: String(err),
      fields,
    });
  }

  return String(err);
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

    // Always fetch trials — no empty-state gate.
    // When no filters are active, TrialsFilterBar shows a ColdArrivalBanner
    // with inline condition + ZIP inputs so patients can start searching on this page.

    const cookieStore = await cookies();
    const profileCookieStr = cookieStore.get("pm_profile")?.value;
    let profile = null;
    if (profileCookieStr) {
      try {
        profile = await import("@/shared/profileCookie").then(m => m.decryptProfileToken(profileCookieStr));
      } catch {
        // Profile cookie unreadable (e.g. missing PII_SECRET in env) — proceed without profile
      }
    }

    const forceIntake = spSync.intake === "1";
    const hasIntakeResultsContext = Boolean(
      spSync.condition ||
      spSync.conditions ||
      spSync.q ||
      spSync.zip ||
      spSync.age ||
      spSync.sex ||
      spSync.phases ||
      spSync.status ||
      spSync.status_bucket,
    );

    if (forceIntake && !hasIntakeResultsContext) {
      return (
        <div className="min-h-screen bg-background">
          <TrackEventOnMount
            event="patient_trials_view"
            props={{
              intake: true,
            }}
          />
          <main className="pb-24 pt-10">
            <div className="pm-container">
              <Suspense fallback={null}>
                <TrialsIntakeStepper profile={profile} forceIntake />
              </Suspense>
            </div>
          </main>
        </div>
      );
    }

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
      defaultRecruitingApplied,
      locationSearchFailed,
    } = trialsResult;

    // Fetch suggestion counts only when a condition/location filter is active.
    // Without a filter these are full-table COUNT queries that time out.
    const hasFilterContext = conditionFilterValues.length > 0 && !nearbyIds;
    const refinedCounts = hasFilterContext
      ? await fetchFilterCounts({
          conditionFilterValues,
          nearbyIds,
          currentPhases: phases,
          currentStatusBucket: statusBucket,
        })
      : {};

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
          <main className="pb-24 pt-10">
            <div className="pm-container">
              <Suspense fallback={null}>
                <RestoreSearch />
              </Suspense>
              {spSync.intake === "1" && (
                <Suspense fallback={null}>
                  <TrialsIntakeStepper profile={profile} forceIntake />
                </Suspense>
              )}

              <div className="mt-2 flex flex-col gap-6">
                {locationSearchFailed && effectiveZip && trialsData.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Nearby-site search for {effectiveZip} is taking too long right now, so we&apos;re showing nationwide{" "}
                    recruiting studies. Try again later or clear the location filter to browse normally.
                  </div>
                )}
                {defaultRecruitingApplied && trialsData.length > 0 && (
                  <p className="text-[12.5px] text-muted-foreground/60">
                    Showing actively enrolling studies.{" "}
                    <a href="/trials?status_bucket=all" className="underline underline-offset-2 hover:text-foreground transition-colors">
                      See all statuses
                    </a>
                  </p>
                )}
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
    console.error("Trials page error", formatCaughtError(err));
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
