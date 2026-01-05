export const ANALYTICS_ALLOWED_KEYS = new Set([
  'nct_id',
  'condition',
  'phase',
  'pageIndex',
  'device',
  'page',
  'filterType',
  'value',
  'trialCount',
  'step_index',
  'score',
  'result',
  'met_count',
  'unmet_count',
  'unknown_count',
  'ui',
  'question_id',
  'note',
  'confidence',
  'match_result',
  'email_domain',
  'condition_slug',
  'age_band',
  'zip_present',
  'count',
  'top_label',
  'result_label',
  'age',
  'sex',
  'miles',
  'phase_label',
  'zip3',
]);

type AnalyticsProps = Record<string, unknown>;

export function sanitizeAnalyticsProps(props: AnalyticsProps = {}) {
  if (!props || typeof props !== 'object') return {};
  return Object.fromEntries(
    Object.entries(props).filter(
      ([key, value]) => ANALYTICS_ALLOWED_KEYS.has(key) && value !== undefined && value !== null,
    ),
  );
}

export async function logEvent(name: string, props: AnalyticsProps = {}) {
  try {
    // Respect Do Not Track
    if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') {
      return;
    }

    const sanitizedProps = sanitizeAnalyticsProps(props);

    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: name,
        props: sanitizedProps,
      }),
      keepalive: true,
    });
  } catch {}
}

// Trial-specific analytics events
export const trialAnalytics = {
  impression: (nctId: string, condition?: string, phase?: string, pageIndex?: number) => {
    logEvent('trial_impression', {
      nct_id: nctId,
      condition,
      phase,
      pageIndex,
      device: typeof window !== 'undefined' ? (window.innerWidth < 768 ? 'mobile' : 'desktop') : 'unknown'
    });
  },

  ctaClick: (nctId: string) => {
    logEvent('trial_cta_click', { nct_id: nctId });
  },

  ctgClick: (nctId: string) => {
    logEvent('trial_ctg_click', { nct_id: nctId });
  },

  saveTrial: (nctId: string) => {
    logEvent('trial_saved_to_shortlist', { nct_id: nctId });
  },

  removeTrial: (nctId: string) => {
    logEvent('trial_removed_from_shortlist', { nct_id: nctId });
  },

  shortlistLimitReached: (nctId: string) => {
    logEvent('trial_shortlist_limit_reached', { nct_id: nctId });
  },

  loadMore: (page: number) => {
    logEvent('trials_load_more', { page });
  },

  filterChanged: (filterType: string, value: string) => {
    logEvent('trials_filter_changed', { filterType, value });
  },

  compareDrawerOpened: (trialCount: number) => {
    logEvent('trials_compare_drawer_opened', { trialCount });
  },

  stickyHelperClicked: () => {
    logEvent('trials_sticky_helper_clicked');
  }
};

// Privacy-safe standard events with slug-only payloads
export const track = {
  hero_search_submit: (p: { condition_slug?: string; zip3?: string }) => {
    logEvent('hero_search_submit', p);
  },
  matches_view: (p?: { condition_slug?: string }) => {
    logEvent('matches_view', p ?? {});
  },
  trial_card_click: (p: { nct_id: string }) => {
    logEvent('trial_card_click', p);
  },
  screener_submitted: (p: { condition_slug?: string; age_band?: string; zip_present?: boolean }) => {
    logEvent('screener_submitted', p);
  },
  screener_abandoned: (p: { nct_id: string; step_index: number }) => {
    logEvent('screener_abandoned', p);
  },
  screener_unknowns_present: (p: { nct_id: string; count: number }) => {
    logEvent('screener_unknowns_present', p);
  },
  results_rendered: (p: { count: number; top_label?: 'Likely'|'Possible'|'Unlikely' }) => {
    logEvent('results_rendered', p);
  },
  confirm_fit_opened: (p: { nct_id: string; condition_slug?: string }) => {
    logEvent('confirm_fit_opened', p);
  },
  confirm_fit_completed: (p: { nct_id: string; result_label: 'Likely'|'Possible'|'Unlikely'|'No' }) => {
    logEvent('confirm_fit_completed', p);
  },
};
