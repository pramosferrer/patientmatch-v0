'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { MapPin, Wifi, Clock, Filter } from 'lucide-react';
import { toConditionLabel } from '@/shared/conditions-normalize';

type FilterState = {
  nearMe: boolean;
  remote: boolean;
  newlyAdded: boolean;
  search: string;
  condition: string;
  conditions: string[]; // multi-select canonical slugs
  visitModel?: 'remote' | 'hybrid' | 'on_site' | '';
  ageBand?: 'child' | 'adult' | 'older_adult' | '';
  usOnly: boolean;
  country: string;
  state: string;
  city: string;
  phases: string[];
  zip: string;
  radiusMiles: number;
};

type ConditionOption = {
  slug: string;
  label: string;
};

const US_STATE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Any state" },
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "AS", label: "American Samoa" },
  { value: "GU", label: "Guam" },
  { value: "MP", label: "Northern Mariana Islands" },
  { value: "PR", label: "Puerto Rico" },
  { value: "VI", label: "U.S. Virgin Islands" },
];

type ProfileUpdate = {
  condition: string;
  age: number;
  sex?: string;
  zip?: string;
  radiusMiles: number;
  remoteOk: boolean;
  conditions?: string[];
  visitModel?: string;
  ageBand?: string;
};

type BaseProfile = ProfileUpdate;

interface TrialsFiltersProps {
  initialFilters: Partial<FilterState>;
  onProfileChange?: (profile: ProfileUpdate) => void;
  baseProfile?: BaseProfile;
  conditions: ConditionOption[];
}

export default function TrialsFilters({
  initialFilters,
  onProfileChange,
  baseProfile,
  conditions: incomingConditions,
  children
}: TrialsFiltersProps & { children?: React.ReactNode }) {
  const router = useRouter();
  const conditionOptions = useMemo(() => incomingConditions ?? [], [incomingConditions]);

  const [filters, setFilters] = useState<FilterState>({
    nearMe: initialFilters.nearMe ?? false,
    remote: initialFilters.remote ?? false,
    newlyAdded: initialFilters.newlyAdded ?? false,
    search: initialFilters.search || '',
    condition: initialFilters.condition || '',
    conditions: initialFilters.conditions || [],
    visitModel: initialFilters.visitModel || '',
    ageBand: initialFilters.ageBand || '',
    usOnly: initialFilters.usOnly ?? true,
    country: initialFilters.country || 'United States',
    state: initialFilters.state || '',
    city: initialFilters.city || '',
    phases: initialFilters.phases || [],
    zip: initialFilters.zip || '',
    radiusMiles: initialFilters.radiusMiles ?? 50,
  });

  const updateFilters = (newFilters: Partial<FilterState>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);

    // If we are in matched mode, notify parent to recompute matches client-side and do not navigate
    if (onProfileChange && baseProfile) {
      onProfileChange({
        ...baseProfile,
        remoteOk: !!updated.remote,
        condition: updated.conditions.length > 0 ? updated.conditions[0] : updated.condition,
        conditions: updated.conditions,
        visitModel: updated.visitModel || undefined,
        ageBand: updated.ageBand || undefined,
        zip: updated.zip || undefined,
        radiusMiles: updated.radiusMiles,
      });
      return;
    }

    // Build query params
    const params = new URLSearchParams();

    if (updated.search) params.set('q', updated.search);
    if (updated.condition) params.set('condition', updated.condition);
    if (updated.conditions && updated.conditions.length > 0) params.set('conditions', updated.conditions.join(','));
    if (updated.visitModel) params.set('vm', updated.visitModel);
    if (updated.ageBand) params.set('age', updated.ageBand);
    params.set('usOnly', updated.usOnly ? '1' : '0');
    if (updated.country && updated.country !== 'United States') params.set('country', updated.country);
    if (updated.state) params.set('state', updated.state);
    if (updated.city) params.set('city', updated.city);
    if (updated.phases.length > 0) params.set('phases', updated.phases.join(','));
    if (updated.zip) params.set('zip', updated.zip);
    if (updated.radiusMiles) params.set('radius', String(updated.radiusMiles));

    // Quick filter logic
    if (updated.nearMe) {
      params.set('nearMe', '1');
    }
    if (updated.remote) {
      params.set('remote', '1');
    }
    if (updated.newlyAdded) {
      params.set('newlyAdded', '1');
    }

    const queryString = params.toString();
    router.push(queryString ? `/trials?${queryString}` : '/trials');
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children || (
          <Button variant="outline" className="w-full justify-center rounded-xl">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto" side="bottom">
        <SheetHeader>
          <SheetTitle>Filter</SheetTitle>
        </SheetHeader>
        <form className="mt-6 space-y-6" onSubmit={(e) => e.preventDefault()}>
          {/* Search */}
          <div>
            <Label htmlFor="search">Search</Label>
            <input
              id="search"
              type="text"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Search title or sponsor"
              className="w-full mt-1 h-11 rounded-xl border border-border bg-warm-cream/70 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {/* Condition (single) */}
          <div>
            <Label htmlFor="condition">Condition</Label>
            <select
              id="condition"
              value={filters.condition}
              onChange={(e) => setFilters(prev => ({ ...prev, condition: e.target.value }))}
              className="pm-native-select w-full mt-1 h-11 rounded-xl border border-border bg-warm-cream/70 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All conditions</option>
              {conditionOptions.map((option) => (
                <option value={option.slug} key={option.slug}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Condition (multi) */}
          <div>
            <Label>Additional conditions</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Select any other conditions to include. We’ll show trials that overlap.
            </p>
            <select
              multiple
              value={filters.conditions}
              onChange={(event) => {
                const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
                setFilters((prev) => ({ ...prev, conditions: selected }));
              }}
              className="pm-native-select mt-2 h-32 w-full rounded-xl border border-border bg-warm-cream/70 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {conditionOptions.map((option) => (
                <option value={option.slug} key={`multi-${option.slug}`}>
                  {option.label}
                </option>
              ))}
            </select>
            {filters.conditions.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Currently adding: {filters.conditions.map(toConditionLabel).join(', ')}
              </p>
            )}
          </div>

          {/* Visit model */}
          <div>
            <Label>Visit model</Label>
            <div className="mt-2 flex gap-3 text-sm">
              {(['remote', 'hybrid', 'on_site', ''] as const).map(vm => (
                <button
                  key={vm || 'any'}
                  onClick={() => setFilters(prev => ({ ...prev, visitModel: vm }))}
                  className={`rounded-full border px-3 py-1 text-sm ${filters.visitModel === vm
                    ? 'border-transparent bg-primary text-primary-foreground shadow-card'
                    : 'border-border bg-warm-cream/80 text-foreground hover:bg-warm-petal/70'
                    }`}
                >
                  {vm || 'Any'}
                </button>
              ))}
            </div>
          </div>

          {/* Age band */}
          <div>
            <Label>Age band</Label>
            <div className="mt-2 flex gap-3 text-sm">
              {(['child', 'adult', 'older_adult', ''] as const).map(ab => (
                <button
                  key={ab || 'any'}
                  onClick={() => setFilters(prev => ({ ...prev, ageBand: ab }))}
                  className={`rounded-full border px-3 py-1 text-sm ${filters.ageBand === ab
                    ? 'border-transparent bg-primary text-primary-foreground shadow-card'
                    : 'border-border bg-warm-cream/80 text-foreground hover:bg-warm-petal/70'
                    }`}
                >
                  {ab || 'Any'}
                </button>
              ))}
            </div>
          </div>

          {/* US Only */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="usOnly"
              checked={filters.usOnly}
              onChange={(e) => setFilters(prev => ({ ...prev, usOnly: e.target.checked }))}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
            />
            <Label htmlFor="usOnly">US-only</Label>
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="country">Country</Label>
            <select
              id="country"
              value={filters.country}
              onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value, state: '' }))}
              className="pm-native-select w-full mt-1 h-11 rounded-xl border border-border bg-warm-cream/70 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="United States">United States</option>
              <option value="">Any country</option>
            </select>
          </div>

          <div>
            <Label htmlFor="state">State / Territory</Label>
            {(!filters.country || filters.country === 'United States') ? (
              <select
                id="state"
                value={filters.state}
                onChange={(e) => setFilters(prev => ({ ...prev, state: e.target.value }))}
                className="pm-native-select w-full mt-1 h-11 rounded-xl border border-border bg-warm-cream/70 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {US_STATE_OPTIONS.map((opt) => (
                  <option value={opt.value} key={opt.value || 'any'}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="state"
                type="text"
                value={filters.state}
                onChange={(e) => setFilters(prev => ({ ...prev, state: e.target.value }))}
                placeholder="Region/Province"
                className="w-full mt-1 h-11 rounded-xl border border-border bg-warm-cream/70 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            )}
          </div>

          <div>
            <Label htmlFor="city">City</Label>
            <input
              id="city"
              type="text"
              value={filters.city}
              onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
              placeholder="City"
              className="w-full mt-1 h-11 rounded-xl border border-border bg-warm-cream/70 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div>
            <Label htmlFor="zip">ZIP code</Label>
            <input
              id="zip"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              value={filters.zip}
              onChange={(e) => setFilters(prev => ({ ...prev, zip: e.target.value }))}
              placeholder="e.g., 94103"
              className="w-full mt-1 h-11 rounded-xl border border-border bg-warm-cream/70 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <p className="mt-1 text-xs text-muted-foreground">Used to surface trials within your travel radius.</p>
          </div>

          <div>
            <Label htmlFor="radius">Within ({filters.radiusMiles} mi)</Label>
            <input
              id="radius"
              type="range"
              min={10}
              max={300}
              step={10}
              value={filters.radiusMiles}
              onChange={(e) => setFilters(prev => ({ ...prev, radiusMiles: parseInt(e.target.value, 10) }))}
              className="mt-2 w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>10 mi</span>
              <span>{filters.radiusMiles} mi</span>
              <span>300 mi</span>
            </div>
          </div>

          {/* Phases */}
          <div>
            <Label>Phases</Label>
            <div className="mt-2 space-y-2">
              {["PHASE1", "PHASE2", "PHASE3", "NA"].map(phase => (
                <div key={phase} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`phase-${phase}`}
                    checked={filters.phases.includes(phase)}
                    onChange={(e) => {
                      const newPhases = e.target.checked
                        ? [...filters.phases, phase]
                        : filters.phases.filter(p => p !== phase);
                      setFilters(prev => ({ ...prev, phases: newPhases }));
                    }}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <Label htmlFor={`phase-${phase}`}>
                    {phase === "NA" ? "Not applicable" : phase.replace("PHASE", "Phase ")}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <SheetClose asChild>
            <Button
              type="submit"
              className="w-full"
              onClick={() => updateFilters(filters)}
            >
              Apply filters
            </Button>
          </SheetClose>
        </form>
      </SheetContent>
    </Sheet>
  );
}
