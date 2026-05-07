import assert from 'node:assert';
import { describe, it } from 'node:test';

import { matchTrials, type PatientProfile } from './index';

type RpcMock = Record<string, unknown>;

function createSupabaseStub(options: { trials: any[]; rpcData?: RpcMock }) {
  const rpcData = options.rpcData ?? {};
  const trials = options.trials;

  const queryBuilder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    in() {
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    contains() {
      return this;
    },
    or() {
      return this;
    },
    then(resolve: any, reject: any) {
      return Promise.resolve({ data: trials, error: null }).then(resolve, reject);
    },
  };

  return {
    rpc(name: string) {
      return Promise.resolve({
        data: rpcData[name] ?? [],
        error: null,
      });
    },
    from() {
      return queryBuilder;
    },
  } as any;
}

const baseCriteria = [{ type: 'inclusion', min_age_years: 18, max_age_years: 90 }];

describe('matchTrials fallbacks', () => {
  it('returns matches even when no sites fall within the radius for on-site preference', async () => {
    const profile: PatientProfile = {
      age: 45,
      sex: 'female',
      location: { zip: '94103' },
      home_lat: 37.77,
      home_lon: -122.41,
      prefers_remote: false,
      max_travel_miles: 25,
      willingness_to_travel_miles: 25,
      conditions: ['obesity'],
      pregnancy: null,
      comorbidities: null,
      meds: null,
    };

    const supabase = createSupabaseStub({
      trials: [
        {
          nct_id: 'T1',
          title: 'Test Onsite',
          status: 'RECRUITING',
          visit_model: 'on_site',
          site_count: 1,
          sponsor: null,
          trial_url: null,
          last_update_date: null,
          fda_regulated: true,
          min_age_years: 18,
          max_age_years: 90,
          gender: null,
          condition_slugs: ['obesity'],
          criteria_json: baseCriteria,
          locations: [],
        },
      ],
      rpcData: {
        nearest_sites_with_meta: [],
      },
    });

    const result = await matchTrials(profile, { supabase });

    assert.strictEqual(result.trials.length, 1);
    assert.strictEqual(result.trials[0]?.nct_id, 'T1');
    assert.ok(result.warnings.includes('no_sites_within_radius'));
  });

  it('keeps remote trials even when the nearest site is beyond the travel radius', async () => {
    const profile: PatientProfile = {
      age: 50,
      sex: 'male',
      location: { zip: '10001' },
      home_lat: 40.75,
      home_lon: -73.99,
      prefers_remote: true,
      max_travel_miles: 10,
      willingness_to_travel_miles: 10,
      conditions: ['long_covid'],
      pregnancy: null,
      comorbidities: null,
      meds: null,
    };

    const supabase = createSupabaseStub({
      trials: [
        {
          nct_id: 'REMOTE1',
          title: 'Remote Study',
          status: 'RECRUITING',
          visit_model: 'remote',
          site_count: 1,
          sponsor: null,
          trial_url: null,
          last_update_date: null,
          fda_regulated: true,
          min_age_years: 18,
          max_age_years: 90,
          gender: null,
          condition_slugs: ['long_covid'],
          criteria_json: baseCriteria,
          locations: [],
        },
      ],
      rpcData: {
        nearest_sites_with_meta: [
          {
            nct_id: 'REMOTE1',
            nearest_miles: 400,
          },
        ],
      },
    });

    const result = await matchTrials(profile, { supabase });

    assert.strictEqual(result.trials.length, 1);
    assert.strictEqual(result.trials[0]?.nct_id, 'REMOTE1');
  });
});
