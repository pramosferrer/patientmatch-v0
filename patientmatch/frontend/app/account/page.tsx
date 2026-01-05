import { cookies } from "next/headers";
import AccountClient from "./AccountClient";
import AccountGuest from "./AccountGuest";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

async function fetchWithAuth(path: string, cookieHeader: string | null) {
  const url = `${SITE_URL}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }
  return fetch(url, {
    headers,
    cache: "no-store",
  });
}

export default async function AccountPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().length > 0 ? cookieStore.toString() : null;

  const profileResponse = await fetchWithAuth("/api/user/profile", cookieHeader);

  if (profileResponse.status === 401) {
    return <AccountGuest />;
  }

  if (!profileResponse.ok) {
    return (
      <div className="mx-auto max-w-xl py-24 text-center">
        <h1 className="text-2xl font-semibold text-pm-ink">Account unavailable</h1>
        <p className="mt-3 text-sm text-pm-muted">
          We couldn&apos;t load your saved profile right now. Please try again shortly.
        </p>
      </div>
    );
  }

  const profileData = await profileResponse.json();

  const savedResponse = await fetchWithAuth("/api/user/saved-trials", cookieHeader);
  const savedData =
    savedResponse.ok && savedResponse.status !== 401 ? await savedResponse.json() : [];

  return (
    <AccountClient
      initialProfile={profileData && typeof profileData === "object" ? profileData : null}
      initialSavedTrials={Array.isArray(savedData) ? savedData : []}
    />
  );
}
