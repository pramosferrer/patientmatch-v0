export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import LoadMoreTrials from "@/components/trials/LoadMoreTrials";
import { TrialsGridSkeleton } from "@/components/trials/TrialsGridSkeleton";
import JsonLd from "@/components/trials/JsonLd";
import { Suspense, lazy } from "react";
import { Button } from "@/components/ui/button";

import { fetchTrials } from "@/lib/matching/fetchTrials";
import DiscoveryHeader from "@/components/trials/DiscoveryHeader";
import TrialsToolbar from "@/components/trials/TrialsToolbar";
import RestoreSearch from "@/components/trials/RestoreSearch";

// Lazy load heavy components
const CompareDrawer = lazy(() => import("@/components/trials/CompareDrawer"));

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

    // Cookie & Profile Logic
    const cookieStore = await cookies();
    const profileCookieStr = cookieStore.get("pm_profile")?.value;
    const profile = profileCookieStr ? await import("@/shared/profileCookie").then(m => m.decryptProfileToken(profileCookieStr)) : null;

    const {
      trialsData,
      totalCount,
      condition,
      multiConditions,
      statusBucket,
      effectiveCondition,
      effectiveZip,
      page,
      q,
      profileMatchResult
    } = await fetchTrials({ searchParams: spSync, profile });

    return (
      <div className="min-h-screen bg-[#FDFCF9]">
        <JsonLd trials={trialsData || []} />
        <main className="pb-24 pt-16 bg-[#FDFCF9]">
          <div className="pm-container">
            <DiscoveryHeader
              condition={effectiveCondition}
              zip={effectiveZip}
              profile={profile}
              totalCount={totalCount || 0}
              profileMatchResult={profileMatchResult}
            />

            <div className="pm-container">
              <TrialsToolbar
                totalCount={totalCount || 0}
                shownCount={trialsData.length}
                zip={effectiveZip}
              />
            </div>

            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-6">
                <Suspense fallback={null}>
                  <RestoreSearch />
                </Suspense>

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
                  <div className="rounded-2xl border border-hairline bg-white/90 p-10 text-center backdrop-blur-sm">
                    <h3 className="text-xl font-semibold text-foreground">No trials match your filters yet</h3>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Try adjusting your filters or clearing them to explore more studies.
                    </p>
                    <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                      <Button asChild variant="secondary" size="sm">
                        <a href="/trials">Reset filters</a>
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>

          <Suspense fallback={null}>
            <CompareDrawer>
              <div />
            </CompareDrawer>
          </Suspense>
        </main>
      </div>
    );

  } catch (err) {
    console.error("Trials page error", err);
    return (
      <main className="pb-16 pt-10">
        <div className="pm-container">
          <p>Error loading trials.</p>
        </div>
      </main>
    );
  }
}
