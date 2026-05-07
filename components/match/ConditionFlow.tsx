"use client";
import React, { useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { toConditionSlug } from "@/shared/conditions-normalize";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/Toast";
import type { PatientProfile } from "@/shared/match/types";

type ConditionItem = {
  slug: string;
  label: string;
  count: number;
  synonyms?: string[];
  source?: string;
};

type ConditionCatalog = {
  all: ConditionItem[];
  featured: ConditionItem[];
};

type Trial = {
  nct_id: string;
  title: string;
  [key: string]: unknown;
};

type ConditionFlowProps = {
  onShortlist: (trials: Trial[]) => void;
  patientProfile: Omit<Partial<PatientProfile>, "location"> & {
    age?: number | string;
    location?: { country?: string; zip?: string };
  };
};

export default function ConditionFlow({ onShortlist, patientProfile }: ConditionFlowProps) {
  const isDev = process.env.NODE_ENV === 'development';
  const [condition, setCondition] = useState(patientProfile?.conditions?.[0] || "");
  const [age, setAge] = useState<string | number>(patientProfile?.age ?? "");
  const [sex, setSex] = useState(patientProfile?.sex || "");
  const [country, setCountry] = useState(patientProfile?.location?.country || "United States");
  const [zip, setZip] = useState(patientProfile?.location?.zip || "");
  const [loading, setLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  // Catalog state
  const [catalog, setCatalog] = useState<ConditionCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showEmptyWarning, setShowEmptyWarning] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const emptyWarningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load condition catalog
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        const res = await fetch('/api/conditions');
        const data = await res.json();

        if (data.success) {
          setCatalog(data.catalog);
        } else {
          throw new Error(data.error || 'Failed to load catalog');
        }
      } catch (error) {
        console.error('❌ Error loading condition catalog:', error);
        addToast('Failed to load conditions. Please refresh the page.', 'error');
      } finally {
        setCatalogLoading(false);
      }
    };

    loadCatalog();
  }, [addToast, isDev]);

  // Fuzzy search with synonyms
  const searchConditions = (searchTerm: string): ConditionItem[] => {
    if (!catalog || !searchTerm.trim()) return catalog?.all ?? [];

    const term = searchTerm.toLowerCase();
    return catalog.all.filter(condition => {
      // Search in label
      if (condition.label.toLowerCase().includes(term)) return true;

      // Search in synonyms
      if (condition.synonyms) {
        return condition.synonyms.some(synonym =>
          synonym.toLowerCase().includes(term)
        );
      }

      // Search in slug (as fallback)
      if (condition.slug.replace(/_/g, ' ').toLowerCase().includes(term)) return true;

      return false;
    });
  };

  // Get filtered and sorted conditions for dropdown
  const filteredConditions = searchConditions(query);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filteredConditions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredConditions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredConditions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredConditions[selectedIndex]) {
          selectCondition(filteredConditions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Select a condition
  const selectCondition = (selectedCondition: ConditionItem) => {
    setCondition(selectedCondition.slug);
    setQuery(selectedCondition.label);
    setOpen(false);
    setSelectedIndex(-1);

    // Show warning if condition has no trials
    if (selectedCondition.count === 0) {
      setShowEmptyWarning(true);
      if (emptyWarningTimeoutRef.current) {
        clearTimeout(emptyWarningTimeoutRef.current);
      }
      emptyWarningTimeoutRef.current = setTimeout(() => setShowEmptyWarning(false), 5000); // Hide after 5 seconds
    } else {
      setShowEmptyWarning(false);
    }
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (comboboxRef.current && target && !comboboxRef.current.contains(target)) {
        setOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (emptyWarningTimeoutRef.current) {
        clearTimeout(emptyWarningTimeoutRef.current);
      }
    };
  }, []);

  // Pre-populate query if condition is already selected
  useEffect(() => {
    if (condition && catalog) {
      const selectedItem = catalog.all.find(item => item.slug === condition);
      if (selectedItem && !query) {
        setQuery(selectedItem.label);
      }
    }
  }, [condition, catalog, query]);

  const handleShortlist = async () => {
    if (!condition || !age || !sex) {
      addToast("Please fill in all required fields", "error");
      return;
    }

    setLoading(true);
    try {
      const parsedAge = typeof age === "string" ? parseInt(age, 10) : age;
      const res = await fetch("/api/prefilter", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          patientProfile: {
            conditions: [condition],
            age: parsedAge,
            sex: sex,
            location: { country, zip },
            willingness_to_travel_miles: 50
          }
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.message || `Server error (${res.status})`;
        throw new Error(errorMessage);
      }

      const data = await res.json();
      onShortlist(data.trials || []);
      addToast("Found trials successfully!", "success");
    } catch (error) {
      console.error("Error finding trials:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to find trials. Please check your connection and try again.";
      addToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>

      <section className="mt-6 bg-white border border-pm-border rounded-3xl p-6 shadow-soft">
      <h3 className="text-lg font-semibold text-pm-ink mb-4">Quick Screening</h3>
      <p className="text-sm text-pm-muted mb-6">Answer a few questions to find relevant trials.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-pm-border p-4">
          <Label className="text-sm font-medium text-pm-ink">Condition *</Label>

          {/* Loading state */}
          {catalogLoading && (
            <div className="mt-2 text-sm text-pm-muted">Loading conditions...</div>
          )}

          {/* Featured chips */}
          {catalog && (
            <div className="mt-2 flex flex-wrap gap-2">
              {catalog.featured.slice(0, 12).map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => {
                    setCondition(item.slug);
                    setQuery(item.label);
                    setShowEmptyWarning(false); // Clear warning when selecting chip
                  }}
                  className={`rounded-full px-3 py-1 text-sm border ${condition===item.slug? 'bg-pm-primary text-white border-pm-primary':'border-pm-border hover:bg-white/70'}`}
                >
                  {item.label}
                  {item.count > 0 && (
                    <span className="ml-1 text-xs opacity-70">({item.count})</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Searchable combobox with fuzzy search */}
          {catalog && (
            <div ref={comboboxRef} className="mt-3">
              <label htmlFor="condition-search" className="sr-only">Search conditions</label>
              <input
                ref={searchInputRef}
                id="condition-search"
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                  setSelectedIndex(-1);
                  setShowEmptyWarning(false); // Clear warning when typing
                }}
                onFocus={() => setOpen(true)}
                placeholder="Search conditions (try 'nafld', 'diabetes', 'arthritis'...)"
                className="w-full rounded-xl border border-pm-border p-2"
                onKeyDown={handleKeyDown}
                aria-expanded={open}
                aria-autocomplete="list"
                aria-controls="condition-search-results"
                role="combobox"
                aria-describedby="condition-help"
              />
              <div id="condition-help" className="sr-only">
                Type to search for conditions. Use arrow keys to navigate, Enter to select.
              </div>
              {open && filteredConditions.length > 0 && (
                <div
                  id="condition-search-results"
                  role="listbox"
                  className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-pm-border bg-white shadow-soft z-10 relative"
                >
                  {filteredConditions.slice(0, 20).map((item, index) => (
                    <button
                      key={item.slug}
                      type="button"
                      role="option"
                      aria-selected={condition === item.slug}
                      className={`w-full text-left px-3 py-2 hover:bg-pm-bg flex justify-between items-center ${
                        condition === item.slug ? 'bg-pm-bg' : ''
                      } ${
                        selectedIndex === index ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => selectCondition(item)}
                    >
                      <div>
                        <div className="font-medium">{item.label}</div>
                        {item.source === 'db' && (
                          <div className="text-xs text-pm-muted">From database</div>
                        )}
                      </div>
                      <div className="text-xs text-pm-muted">
                        ({item.count})
                      </div>
                    </button>
                  ))}
                  {filteredConditions.length > 20 && (
                    <div className="px-3 py-2 text-xs text-pm-muted border-t">
                      Showing first 20 of {filteredConditions.length} matches
                    </div>
                  )}
                </div>
              )}
              {open && query.trim() && filteredConditions.length === 0 && (
                <div className="mt-1 rounded-xl border border-pm-border bg-white shadow-soft p-3 text-sm text-pm-muted">
                  No conditions found for &quot;{query}&quot;. Try searching for synonyms or related terms.
                </div>
              )}

              {/* Empty condition warning */}
              {showEmptyWarning && (
                <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600">⚠️</span>
                    <div>
                      <div className="font-medium">No trials found</div>
                      <div className="text-xs mt-1">
                        We&apos;re still parsing trials for this condition. Try broader terms or check back soon.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-pm-border p-4">
          <Label className="text-sm font-medium text-pm-ink">Age *</Label>
          <input
            className="mt-2 w-full rounded-xl border border-pm-border p-2"
            placeholder="e.g., 55"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>

        <div className="rounded-2xl border border-pm-border p-4">
          <Label className="text-sm font-medium text-pm-ink">Sex *</Label>
          <select
            className="pm-native-select mt-2 w-full rounded-xl border border-pm-border p-2"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
          >
            <option value="">Select sex</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>

        <div className="rounded-2xl border border-pm-border p-4">
          <Label className="text-sm font-medium text-pm-ink">Country</Label>
          <input
            className="mt-2 w-full rounded-xl border border-pm-border p-2"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>

        <div className="rounded-2xl border border-pm-border p-4 sm:col-span-2">
          <Label className="text-sm font-medium text-pm-ink">ZIP/Postal Code</Label>
          <input
            className="mt-2 w-full rounded-xl border border-pm-border p-2"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={handleShortlist}
                      className="rounded-xl bg-pm-primary text-white px-5 py-2 hover:opacity-90"
          disabled={loading}
        >
          {loading ? "Finding trials..." : "Find My Matches"}
        </button>
      </div>
    </section>
    </>
  );
}
