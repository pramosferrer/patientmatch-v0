"use client";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CONDITIONS, labelForCondition } from "@/shared/conditions";
import { PatientProfileSchema, type PatientProfile } from "@/lib/schemas/patientProfile";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChatFlow from "@/components/match/ChatFlow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { resolveZipToLatLon } from "@/shared/geo";
import { getSupabaseBrowser } from "@/lib/supabaseClient";
import type { ProfileCookie } from "@/shared/profileCookie";

type Step = "condition" | "age" | "sex" | "location" | "preferences" | "health" | "review";

const card = "bg-white border border-pm-border rounded-3xl p-6 shadow-soft";
const label = "text-sm font-medium text-pm-ink";
const input = "mt-2 w-full rounded-xl border border-pm-border p-2";
const navBtn = "rounded-xl bg-pm-primary text-white px-5 py-2 hover:opacity-90 disabled:opacity-60";

type MatchWizardProps = { onPreview?: (trials: any[]) => void };

export default function MatchWizard({ onPreview }: MatchWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("condition");
  const [submitting, setSubmitting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const [profile, setProfile] = useState<PatientProfile>({
    conditions: [],
    age: 0,
    sex: undefined,
    location: { country: "United States" },
    willingness_to_travel_miles: 50,
    max_travel_miles: 50,
    prefers_remote: true,
    meds: [],
    keywords: [],
  });
  const [locationChoice, setLocationChoice] = useState<'zip' | 'device'>('zip');
  const [deviceLocation, setDeviceLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [requestingDeviceLocation, setRequestingDeviceLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [zipLookupState, setZipLookupState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [zipLookupMessage, setZipLookupMessage] = useState<string | null>(null);
  const [cachedZipCoords, setCachedZipCoords] = useState<{ zip: string; lat: number; lon: number } | null>(null);
  const supabaseRef = useRef<ReturnType<typeof getSupabaseBrowser> | null>(null);
  const persistedProfileRef = useRef<string | null>(null);

  const getBrowserSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = getSupabaseBrowser();
    }
    return supabaseRef.current;
  }, []);

  // Support ?step= query param to start at a given step
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const s = url.searchParams.get('step');
      if (s && (['condition','age','sex','location','exclusions','review'] as Step[]).includes(s as Step)) {
        setStep(s as Step);
      }
    } catch {}
  }, []);

  const steps: Step[] = ["condition", "age", "sex", "location", "preferences", "health", "review"];
  const stepIndex = steps.indexOf(step);

  function next() {
    if (stepIndex < steps.length - 1) setStep(steps[stepIndex + 1]);
  }
  function prev() {
    if (stepIndex > 0) setStep(steps[stepIndex - 1]);
  }

  const lookupZipCoords = useCallback(
    async (postalCode: string): Promise<{ lat: number; lon: number }> => {
      const trimmed = postalCode.trim();
      if (trimmed.length !== 5) {
        setZipLookupState('error');
        const message = 'ZIP codes must be 5 digits.';
        setZipLookupMessage(message);
        setLocationError(message);
        throw new Error(message);
      }

      if (cachedZipCoords && cachedZipCoords.zip === trimmed) {
        setZipLookupState('success');
        setZipLookupMessage('ZIP mapped to nearby coordinates.');
        return { lat: cachedZipCoords.lat, lon: cachedZipCoords.lon };
      }

      setZipLookupState('loading');
      setZipLookupMessage(null);
      setLocationError(null);

      try {
        const supabase = getBrowserSupabase();
        const coords = await resolveZipToLatLon(trimmed, supabase);
        if (!coords) {
          const message = 'We could not find that ZIP. Try another or share your current location.';
          setZipLookupState('error');
          setZipLookupMessage(message);
          setLocationError(message);
          throw new Error(message);
        }

        setCachedZipCoords({ zip: trimmed, lat: coords.lat, lon: coords.lon });
        setZipLookupState('success');
        setZipLookupMessage('ZIP mapped to nearby coordinates.');
        setProfile((prev) => ({ ...prev, home_lat: coords.lat, home_lon: coords.lon }));

        return { lat: coords.lat, lon: coords.lon };
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Unable to map that ZIP right now. Try again or use your current location.';
        setZipLookupState('error');
        setZipLookupMessage(message);
        setLocationError(message);
        throw error instanceof Error ? error : new Error(message);
      }
    },
    [cachedZipCoords, getBrowserSupabase],
  );

  const requestCurrentLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError("Your browser doesn't support location sharing. Try entering a ZIP instead.");
      return;
    }

    setLocationError(null);
    setZipLookupState('idle');
    setZipLookupMessage(null);
    setRequestingDeviceLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRequestingDeviceLocation(false);
        const { latitude, longitude } = position.coords;
        setDeviceLocation({ lat: latitude, lon: longitude });
        setProfile((prev) => ({ ...prev, home_lat: latitude, home_lon: longitude }));
      },
      () => {
        setRequestingDeviceLocation(false);
        setLocationError("We couldn't access your location. You can try again or use your ZIP.");
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 },
    );
  }, []);

  const buildProfileCookiePayload = useCallback((): ProfileCookie | null => {
    const age = typeof profile.age === "number" && profile.age > 0 ? Math.round(profile.age) : undefined;
    const conditions = Array.isArray(profile.conditions)
      ? profile.conditions
          .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          .slice(0, 12)
      : [];

    if (age === undefined || conditions.length === 0) {
      return null;
    }

    const payload: ProfileCookie = {
      age,
      conditions,
    };

    if (profile.sex === "male" || profile.sex === "female" || profile.sex === "other") {
      payload.sex = profile.sex;
    }

    const zip = profile.location?.zip?.trim();
    if (zip && /^\d{5}$/.test(zip)) {
      payload.zip = zip;
    }

    if (typeof profile.pregnant === "boolean") {
      payload.pregnancy = profile.pregnant;
    } else if (profile.pregnant === null) {
      payload.pregnancy = null;
    }

    return payload;
  }, [profile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = buildProfileCookiePayload();
    if (!payload) {
      persistedProfileRef.current = null;
      return;
    }
    const serialized = JSON.stringify(payload);
    if (persistedProfileRef.current === serialized) return;
    persistedProfileRef.current = serialized;

    try {
      window.sessionStorage.setItem("pm_profile", serialized);
    } catch {
      /* ignore sessionStorage errors */
    }

    (async () => {
      try {
        await fetch("/api/profile/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: serialized,
        });
      } catch {
        /* silent failure */
      }
    })();
  }, [buildProfileCookiePayload]);

  const handleClearPersistedProfile = useCallback(async () => {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem("pm_profile");
      } catch {
        /* ignore storage issues */
      }
    }
    persistedProfileRef.current = null;
    try {
      await fetch("/api/profile/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({}),
      });
    } catch {
      /* best-effort */
    }
  }, []);

  const prepareProfileForMatch = useCallback(async () => {
    setLocationError(null);
    const base: PatientProfile = {
      ...profile,
      max_travel_miles:
        profile.max_travel_miles ??
        profile.willingness_to_travel_miles ??
        50,
    };

    if (locationChoice === 'device') {
      if (deviceLocation) {
        base.home_lat = deviceLocation.lat;
        base.home_lon = deviceLocation.lon;
      } else {
        const message = 'Please share your current location or switch to ZIP.';
        setLocationError(message);
        throw new Error(message);
      }
    } else {
      const zip = base.location?.zip?.trim() ?? '';
      if (zip.length === 5) {
        const coords = await lookupZipCoords(zip);
        base.home_lat = coords.lat;
        base.home_lon = coords.lon;
      } else {
        base.home_lat = undefined;
        base.home_lon = undefined;
      }
    }

    return PatientProfileSchema.parse(base);
  }, [profile, locationChoice, deviceLocation, lookupZipCoords]);

  const canContinue = useMemo(() => {
    if (step === "condition") return profile.conditions.length > 0;
    if (step === "age") return typeof profile.age === "number" && profile.age > 0;
    if (step === "sex") return true; // optional
    if (step === "location") return true; // optional zip/country
    if (step === "preferences") return true;
    if (step === "health") return true;
    return true;
  }, [step, profile]);

  useEffect(() => {
    setLocationError(null);
  }, [locationChoice]);

  // When entering review, fetch early results to show in right rail
  useEffect(() => {
    if (step !== 'review') return;
    (async () => {
      try {
        const prepared = await prepareProfileForMatch();
        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          body: JSON.stringify(prepared),
        });
        if (!res.ok) return;
        const data = await res.json();
        onPreview?.(Array.isArray(data?.trials) ? data.trials.slice(0, 5) : []);
      } catch {
        /* Preview is best-effort */
      }
    })();
  }, [step, prepareProfileForMatch, onPreview]);

  async function submitAndNavigate() {
    try {
      setSubmitting(true);
      const prepared = await prepareProfileForMatch();
      const params = new URLSearchParams();
      params.set('prefill', '1');
      if (prepared.conditions[0]) params.set('condition', prepared.conditions[0]);
      params.set('age', String(prepared.age));
      if (prepared.location?.zip) params.set('zip', prepared.location.zip);
      const travelRadius =
        prepared.max_travel_miles ??
        prepared.willingness_to_travel_miles;
      if (typeof travelRadius === 'number') {
        params.set('radius', String(travelRadius));
      }
      params.set('remote', prepared.prefers_remote ? '1' : '0');
      if (prepared.sex) params.set('sex', String(prepared.sex));
      router.push(`/trials?${params.toString()}`);
    } catch (error) {
      if (error instanceof Error && error.message) {
        setLocationError(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-[100vh] bg-[var(--color-background)]">
      <div className="max-w-3xl mx-auto pt-10 pb-24 px-4">
        <div className="mb-6 text-center">
          <h1 className="text-[28px] sm:text-[32px] font-semibold text-pm-ink">Find your best trial matches</h1>
          <p className="text-base text-pm-muted mt-3">No PII to start — we only ask a few basics.</p>
        </div>

        <section className={card}>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <Label className={label}>Condition</Label>
              <div className="mt-2">
                <Select
                  value={profile.conditions[0] || undefined}
                  onValueChange={(val) => setProfile(p => ({ ...p, conditions: val ? [val] : [] }))}
                >
                  <SelectTrigger className="w-full rounded-xl border border-pm-border bg-white text-pm-ink px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-pm-primary/40">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent className="text-base bg-white/95 backdrop-blur-sm" position="popper">
                    {CONDITIONS.map(c => (
                      <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className={label}>Age</Label>
              <Input
                type="number"
                min={0}
                max={120}
                value={profile.age || ''}
                onChange={(e) => setProfile(p => ({ ...p, age: Number(e.target.value || 0) }))}
                placeholder="e.g., 55"
                className="mt-2"
              />
            </div>

            <div>
              <Label className={label}>Sex (optional)</Label>
              <div className="mt-2">
                <Select
                  value={profile.sex || undefined}
                  onValueChange={(val) => setProfile(p => ({ ...p, sex: (val as PatientProfile['sex']) }))}
                >
                  <SelectTrigger className="w-full rounded-xl border border-pm-border bg-white text-pm-ink px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-pm-primary/40">
                    <SelectValue placeholder="Prefer not to say" />
                  </SelectTrigger>
                  <SelectContent className="text-base bg-white/95 backdrop-blur-sm" position="popper">
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </div>

          <div className="mt-6 rounded-2xl border border-pm-border bg-white/70 p-4">
            <Label className={label}>Location preference</Label>
            <p className="mt-1 text-xs text-pm-muted">
              Choose how we calculate distance to study visits.
            </p>
            <div className="mt-3 flex flex-col gap-4">
              <label className="flex items-start gap-3 text-sm text-pm-ink">
                <input
                  type="radio"
                  name="location-mode"
                  value="zip"
                  checked={locationChoice === 'zip'}
                  onChange={() => {
                    setLocationChoice('zip');
                    setLocationError(null);
                    setRequestingDeviceLocation(false);
                  }}
                  className="mt-1 h-4 w-4 accent-pm-primary focus:outline-none focus:ring-2 focus:ring-pm-primary/40"
                />
                <div>
                  <span className="font-medium">Use my ZIP code</span>
                  <p className="mt-1 text-xs text-pm-muted">
                    We only use this to approximate travel distance—no street address needed.
                  </p>
                  {locationChoice === 'zip' && (
                    <div className="mt-3 space-y-2">
                      <Input
                        value={profile.location?.zip || ''}
                        onChange={(event) => {
                          const value = event.target.value.replace(/\D/g, '').slice(0, 5);
                          setProfile((prev) => {
                            const nextLocation = {
                              ...(prev.location ?? { country: "United States" }),
                              zip: value,
                            };
                            const next: PatientProfile = {
                              ...prev,
                              location: nextLocation,
                            };
                            if (value.length !== 5) {
                              next.home_lat = undefined;
                              next.home_lon = undefined;
                            }
                            return next;
                          });
                          setZipLookupState('idle');
                          setZipLookupMessage(null);
                          if (!cachedZipCoords || cachedZipCoords.zip !== value) {
                            setCachedZipCoords(null);
                          }
                        }}
                        onBlur={async (event) => {
                          const value = event.target.value.trim();
                          if (value.length === 5) {
                            try {
                              await lookupZipCoords(value);
                            } catch {
                              /* handled via state */
                            }
                          }
                        }}
                        placeholder="e.g., 94103"
                        inputMode="numeric"
                        pattern="\d*"
                        className="w-full"
                      />
                      {zipLookupState === 'loading' && (
                        <p className="text-xs text-pm-muted">Looking up that ZIP…</p>
                      )}
                      {zipLookupState === 'success' && zipLookupMessage && (
                        <p className="text-xs text-emerald-600">{zipLookupMessage}</p>
                      )}
                      {zipLookupState === 'error' && zipLookupMessage && (
                        <p className="text-xs text-red-600">{zipLookupMessage}</p>
                      )}
                    </div>
                  )}
                </div>
              </label>
              <label className="flex items-start gap-3 text-sm text-pm-ink">
                <input
                  type="radio"
                  name="location-mode"
                  value="device"
                  checked={locationChoice === 'device'}
                  onChange={() => {
                    setLocationChoice('device');
                    setZipLookupState('idle');
                    setZipLookupMessage(null);
                    setProfile((prev) => ({
                      ...prev,
                      location: { ...(prev.location ?? { country: "United States" }), zip: undefined },
                      zip: '',
                    }));
                  }}
                  className="mt-1 h-4 w-4 accent-pm-primary focus:outline-none focus:ring-2 focus:ring-pm-primary/40"
                />
                <div>
                  <span className="font-medium">Use my current location</span>
                  <p className="mt-1 text-xs text-pm-muted">
                    We&apos;ll ask your browser for permission and only store an approximate point.
                  </p>
                  {locationChoice === 'device' && (
                    <div className="mt-3 space-y-2 rounded-xl border border-dashed border-pm-border/70 bg-pm-bg/60 p-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="brand"
                        onClick={requestCurrentLocation}
                        disabled={requestingDeviceLocation}
                      >
                        {requestingDeviceLocation ? 'Requesting location…' : 'Share my location'}
                      </Button>
                      {deviceLocation && (
                        <p className="text-xs text-emerald-600">
                          Location saved. We&apos;ll prioritize nearby trials.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </label>
            </div>
            {locationError && (
              <p className="mt-3 text-xs text-red-600">{locationError}</p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button onClick={submitAndNavigate} className={navBtn} disabled={submitting || !(profile.conditions.length > 0 && profile.age)}>See matches</button>
            <button type="button" onClick={() => setChatOpen(true)} className="text-sm text-pm-ink underline underline-offset-4 hover:opacity-80">Prefer chat? Try it</button>
          </div>
        </section>
      </div>

      <p className="mt-6 text-center text-xs text-pm-muted">
        We can save non-identifying answers to speed things up next time.{" "}
        <button
          type="button"
          onClick={handleClearPersistedProfile}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Clear
        </button>
      </p>

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent className="sm:max-w-2xl w-full">
          <SheetHeader>
            <SheetTitle>Chat with PatientMatch</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <ChatFlow
              patientProfile={profile}
              setPatientProfile={setProfile}
              onShortlist={() => {}}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
