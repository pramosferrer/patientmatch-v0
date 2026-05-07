'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { clearProfileConditions } from '@/app/actions';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'recruiting', label: 'Recruiting' },
  { value: 'active', label: 'Active' },
  { value: 'not_yet_recruiting', label: 'Not yet recruiting' },
  { value: 'enrolling_by_invitation', label: 'Enrolling by invitation' },
  { value: 'completed', label: 'Completed' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'suspended', label: 'Suspended' },
];

export type ConditionOption = {
  slug: string;
  label: string;
};

type SidebarInitialFilters = {
  search?: string;
  condition?: string;
  statusBucket?: string;
};

type FilterState = {
  search: string;
  condition: string;
  statusBucket: string;
};

type FiltersSidebarProps = {
  className?: string;
  initialFilters: SidebarInitialFilters & Record<string, unknown>;
  conditions: ConditionOption[];
};

type FiltersController = ReturnType<typeof useFilterController>;

function countActiveFilters(state: FilterState): number {
  let count = 0;
  if (state.search) count += 1;
  if (state.condition) count += 1;
  if (state.statusBucket) count += 1;
  return count;
}

function createState(initial: SidebarInitialFilters): FilterState {
  return {
    search: typeof initial.search === 'string' ? initial.search : '',
    condition: initial.condition ?? '',
    statusBucket: typeof initial.statusBucket === 'string' ? initial.statusBucket : '',
  };
}

function useFilterController(initialFilters: SidebarInitialFilters) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [state, setState] = useState<FilterState>(() => createState(initialFilters));
  const [searchDraft, setSearchDraft] = useState(() => initialFilters.search ?? '');
  const signatureRef = useRef<string>('');
  const skipNextSyncRef = useRef(false);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const signature = JSON.stringify({
      search: initialFilters.search ?? '',
      condition: initialFilters.condition ?? '',
      statusBucket: initialFilters.statusBucket ?? '',
    });
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;
    const next = createState(initialFilters);
    skipNextSyncRef.current = true;
    setState(next);
    setSearchDraft(next.search);
  }, [initialFilters]);

  const buildQuery = useCallback(
    (next: FilterState) => {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
      params.delete('page');
      if (next.search) params.set('q', next.search);
      else params.delete('q');
      if (next.condition) {
        params.set('condition', next.condition);
        params.delete('conditions');
      } else {
        params.delete('condition');
      }
      if (next.statusBucket) params.set('status_bucket', next.statusBucket);
      else params.delete('status_bucket');
      params.delete('status');
      return params.toString();
    },
    [searchParams],
  );

  const updateState = useCallback(
    (updater: (prev: FilterState) => FilterState) => {
      setState((prev) => updater(prev));
    },
    [],
  );

  const selectCondition = useCallback(
    (value: string) => {
      const actualValue = value === '_all' ? '' : value;
      updateState((prev) => ({ ...prev, condition: actualValue }));
    },
    [updateState],
  );

  const selectStatusBucket = useCallback(
    (value: string) => {
      const actualValue = value === '_all' ? '' : value;
      updateState((prev) => ({ ...prev, statusBucket: actualValue }));
    },
    [updateState],
  );

  const applySearchDraft = useCallback(() => {
    const sanitized = searchDraft.trim();
    updateState((prev) => ({ ...prev, search: sanitized }));
    setSearchDraft(sanitized);
  }, [searchDraft, updateState]);

  const reset = useCallback(() => {
    const base = createState({});
    setState(base);
    setSearchDraft(base.search);
    clearProfileConditions().catch(console.error);
  }, []);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    const query = buildQuery(state);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [state, buildQuery, router, pathname]);

  return {
    state,
    searchDraft,
    setSearchDraft,
    selectCondition,
    selectStatusBucket,
    applySearchDraft,
    reset,
  };
}

function FiltersContent({
  controller,
  conditions,
  variant,
}: {
  controller: FiltersController;
  conditions: ConditionOption[];
  variant: 'desktop' | 'mobile';
}) {
  const {
    state,
    searchDraft,
    setSearchDraft,
    selectCondition,
    selectStatusBucket,
    applySearchDraft,
  } = controller;

  return (
    <div className={cn('space-y-4', variant === 'mobile' ? 'pb-4' : undefined)}>
      <Accordion type="multiple" defaultValue={['search', 'status', 'condition']} className="w-full">
        <AccordionItem value="search" className="border-t-0">
          <AccordionTrigger className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80 hover:no-underline py-2">
            Search
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value.slice(0, 120))}
                onBlur={applySearchDraft}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applySearchDraft();
                  }
                }}
                placeholder="Search title"
                className="h-10 text-sm bg-white"
                aria-label="Search trials"
              />
              <Button type="button" variant="secondary" size="sm" onClick={applySearchDraft} className="h-10">
                Set
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="status">
          <AccordionTrigger className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80 hover:no-underline py-2">
            Status
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <Select
              value={state.statusBucket}
              onValueChange={selectStatusBucket}
            >
              <SelectTrigger className="h-10 text-sm bg-white rounded-lg">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="condition">
          <AccordionTrigger className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80 hover:no-underline py-2">
            Condition
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <Select
              value={state.condition}
              onValueChange={selectCondition}
            >
              <SelectTrigger className="h-10 text-sm bg-white rounded-lg">
                <SelectValue placeholder="All conditions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All conditions</SelectItem>
                {conditions.map((option) => (
                  <SelectItem key={option.slug} value={option.slug}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export default function FiltersSidebar({ className, initialFilters, conditions }: FiltersSidebarProps) {
  const controller = useFilterController(initialFilters);
  const activeCount = countActiveFilters(controller.state);

  return (
    <div
      className={cn(
        'flex flex-col gap-8 lg:border-l lg:border-hairline lg:pl-6',
        className,
      )}
    >
      <div className="space-y-1">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
          Trial Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </h2>
        <p className="text-[13px] text-muted-foreground/70 leading-relaxed">Adjust the list to find the best match for you.</p>
      </div>
      <FiltersContent controller={controller} conditions={conditions} variant="desktop" />
      {activeCount > 0 ? (
        <Button
          variant="link"
          size="sm"
          className="w-fit px-0 text-primary"
          onClick={controller.reset}
        >
          Reset filters
        </Button>
      ) : null}
    </div>
  );
}

export function FiltersSidebarMobileButton({ initialFilters, conditions }: Omit<FiltersSidebarProps, 'className'>) {
  const controller = useFilterController(initialFilters);
  const [open, setOpen] = useState(false);
  const activeCount = countActiveFilters(controller.state);

  const handleApply = () => {
    controller.applySearchDraft();
    setOpen(false);
  };

  const handleReset = () => {
    controller.reset();
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="lg:hidden"
        onClick={() => setOpen(true)}
      >
        Filters{activeCount > 0 ? ` (${activeCount})` : ''}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-6 max-h-[70vh] overflow-y-auto pr-1">
            <FiltersContent controller={controller} conditions={conditions} variant="mobile" />
          </div>
          <SheetFooter className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:flex-1"
              onClick={handleReset}
            >
              Reset
            </Button>
            <Button type="button" size="sm" className="w-full sm:flex-1" onClick={handleApply}>
              Apply
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
