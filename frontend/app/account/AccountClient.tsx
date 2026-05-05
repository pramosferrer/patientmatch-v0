'use client';

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ProfileShape = {
  age?: number | null;
  sex?: string | null;
  zip?: string | null;
  max_travel_miles?: number | null;
  prefers_remote?: boolean | null;
  condition_slugs?: string[] | null;
  alert_opt_in?: boolean | null;
};

type SavedTrial = {
  nct_id: string;
  created_at?: string | null;
};

type Props = {
  initialProfile: ProfileShape | null;
  initialSavedTrials: SavedTrial[];
};

type FormState = {
  age: string;
  sex: string;
  zip: string;
  travelMiles: string;
  conditions: string;
  prefersRemote: boolean;
  alertOptIn: boolean;
};

function normalizeConditions(input: string): string[] | null {
  if (!input.trim()) return null;
  const parts = input
    .split(/[,;\n]/)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  if (parts.length === 0) return null;
  return Array.from(new Set(parts)).slice(0, 12);
}

export default function AccountClient({ initialProfile, initialSavedTrials }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => ({
    age: initialProfile?.age != null ? String(initialProfile.age) : "",
    sex: initialProfile?.sex ?? "prefer",
    zip: initialProfile?.zip ?? "",
    travelMiles:
      initialProfile?.max_travel_miles != null ? String(initialProfile.max_travel_miles) : "",
    conditions: Array.isArray(initialProfile?.condition_slugs)
      ? initialProfile?.condition_slugs?.join(", ") ?? ""
      : "",
    prefersRemote: Boolean(initialProfile?.prefers_remote),
    alertOptIn: Boolean(initialProfile?.alert_opt_in),
  }));
  const [savedTrials, setSavedTrials] = useState(initialSavedTrials);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingData, setDeletingData] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const canSave = useMemo(() => {
    if (!form.age) return false;
    return !Number.isNaN(Number(form.age));
  }, [form.age]);

  const buildPayload = useCallback(
    (overrides?: Partial<{ alert_opt_in: boolean; prefers_remote: boolean }>) => {
      const ageNumber = Number(form.age);
      const travelMilesNumber = form.travelMiles ? Number(form.travelMiles) : null;

      return {
        age: Number.isFinite(ageNumber) ? ageNumber : null,
        sex: form.sex === "prefer" ? null : form.sex,
        zip: form.zip.trim() || null,
        travel_miles: travelMilesNumber != null && Number.isFinite(travelMilesNumber) ? travelMilesNumber : null,
        prefers_remote: overrides?.prefers_remote ?? form.prefersRemote,
        condition_slugs: normalizeConditions(form.conditions),
        alert_opt_in: overrides?.alert_opt_in ?? form.alertOptIn,
      };
    },
    [form],
  );

  const submitProfile = useCallback(
    async (overrides?: Partial<{ alert_opt_in: boolean; prefers_remote: boolean }>) => {
      setSaving(true);
      setMessage(null);
      setError(null);
      try {
        const payload = buildPayload(overrides);
        const response = await fetch("/api/user/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const meta = await response.json().catch(() => null);
          throw new Error(meta?.error ?? "Unable to save profile");
        }
        setMessage("Profile saved.");
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Failed to save profile.");
      } finally {
        setSaving(false);
      }
    },
    [buildPayload],
  );

  const handleSaveProfile = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      await submitProfile();
      router.refresh();
    },
    [router, submitProfile],
  );

  const handleAlertToggle = useCallback(async () => {
    const next = !form.alertOptIn;
    setForm((prev) => ({ ...prev, alertOptIn: next }));
    await submitProfile({ alert_opt_in: next });
    router.refresh();
  }, [form.alertOptIn, router, submitProfile]);

  const handleRemoteToggle = useCallback(async () => {
    const next = !form.prefersRemote;
    setForm((prev) => ({ ...prev, prefersRemote: next }));
    await submitProfile({ prefers_remote: next });
    router.refresh();
  }, [form.prefersRemote, router, submitProfile]);

  const handleRemoveSaved = useCallback(
    async (nctId: string) => {
      setRemoving(nctId);
      setError(null);
      try {
        const response = await fetch("/api/user/saved-trials", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nct_id: nctId }),
        });
        if (!response.ok) {
          throw new Error("Failed to remove saved trial.");
        }
        setSavedTrials((prev) => prev.filter((trial) => trial.nct_id !== nctId));
        setMessage("Saved study removed.");
      } catch (removeError) {
        setError(removeError instanceof Error ? removeError.message : "Failed to remove saved study.");
      } finally {
        setRemoving(null);
      }
    },
    [],
  );

  const handleDeleteData = useCallback(async () => {
    if (!window.confirm("Delete your saved profile and preferences? This cannot be undone.")) {
      return;
    }
    setDeletingData(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/user/data", {
        method: "DELETE",
      });
      if (!response.ok) {
        const meta = await response.json().catch(() => null);
        throw new Error(meta?.detail ?? meta?.error ?? "Failed to delete data.");
      }
      setForm({
        age: "",
        sex: "prefer",
        zip: "",
        travelMiles: "",
        conditions: "",
        prefersRemote: false,
        alertOptIn: false,
      });
      setSavedTrials([]);
      setMessage("Your saved data has been deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete data.");
    } finally {
      setDeletingData(false);
      router.refresh();
    }
  }, [router]);

  const handleExportData = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const response = await fetch("/api/user/data");
      if (!response.ok) {
        throw new Error("Unable to export data right now.");
      }
      const payload = await response.json();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `patientmatch-account-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to export data.");
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-12 px-4">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-pm-ink">Account</h1>
        <p className="text-sm text-pm-muted">
          Update your saved profile, manage saved studies, and control your email alerts.
        </p>
      </header>

      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Card>
        <form onSubmit={handleSaveProfile}>
          <CardHeader>
            <CardTitle>Your study profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  min={0}
                  max={120}
                  value={form.age}
                  onChange={(event) => setForm((prev) => ({ ...prev, age: event.target.value }))}
                  className="mt-2"
                  required
                />
              </div>
              <div>
                <Label htmlFor="sex">Sex</Label>
                <select
                  id="sex"
                  value={form.sex}
                  onChange={(event) => setForm((prev) => ({ ...prev, sex: event.target.value }))}
                  className="pm-native-select mt-2 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm"
                >
                  <option value="prefer">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="zip">ZIP code</Label>
                <Input
                  id="zip"
                  inputMode="numeric"
                  pattern="\d*"
                  value={form.zip}
                  onChange={(event) => setForm((prev) => ({ ...prev, zip: event.target.value }))}
                  className="mt-2"
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label htmlFor="travel">How far can you travel? (miles)</Label>
                <Input
                  id="travel"
                  type="number"
                  min={0}
                  max={5000}
                  value={form.travelMiles}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, travelMiles: event.target.value }))
                  }
                  className="mt-2"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conditions">Conditions of interest</Label>
              <Input
                id="conditions"
                value={form.conditions}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, conditions: event.target.value }))
                }
                placeholder="e.g. long-covid, fatigue"
              />
              <p className="text-xs text-pm-muted">
                Separate with commas. We use these to tailor your matches.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-hairline bg-white px-4 py-3">
              <div>
                <p className="text-sm font-medium text-pm-ink">Prefer remote or hybrid visits</p>
                <p className="text-xs text-pm-muted">We prioritize remote-friendly studies when enabled.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.prefersRemote}
                onClick={handleRemoteToggle}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/40",
                  form.prefersRemote ? "bg-emerald-500" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
                    form.prefersRemote ? "translate-x-5" : "translate-x-1",
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-hairline bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-pm-ink">Email alerts</p>
                <p className="text-xs text-pm-muted">
                  We’ll email at most once per week. You can stop anytime.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.alertOptIn}
                onClick={handleAlertToggle}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/40",
                  form.alertOptIn ? "bg-emerald-500" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
                    form.alertOptIn ? "translate-x-5" : "translate-x-1",
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button type="submit" disabled={saving || !canSave}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      <Card id="saved">
        <CardHeader>
          <CardTitle>Saved studies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {savedTrials.length === 0 ? (
            <p className="text-sm text-pm-muted">No saved studies yet.</p>
          ) : (
            <ul className="space-y-3">
              {savedTrials.map((trial) => (
                <li
                  key={trial.nct_id}
                  className="flex items-center justify-between rounded-lg border border-hairline bg-white px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-sm text-pm-ink">{trial.nct_id}</p>
                    <a
                      className="text-xs text-primary underline-offset-4 hover:underline"
                      href={`/trial/${encodeURIComponent(trial.nct_id)}/screen?mode=patient`}
                    >
                      Check eligibility
                    </a>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveSaved(trial.nct_id)}
                    disabled={removing === trial.nct_id}
                  >
                    {removing === trial.nct_id ? "Removing…" : "Remove"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-pm-muted">
            Export or delete the profile information, saved studies, and screener sessions tied to your account.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportData}
              disabled={exporting}
            >
              {exporting ? "Preparing…" : "Export my data"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteData}
              disabled={deletingData}
            >
              {deletingData ? "Deleting…" : "Delete my data"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
