
import { createClient } from '@supabase/supabase-js';
import { matchTrials } from '../../shared/match/index';
import * as dotenv from 'dotenv';
import { toConditionSlug } from '../../shared/conditions-normalize';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const profile = {
    age: 65,
    sex: 'female',
    location: { zip: '94103' },
    home_lat: 37.7726, // Approximate lat for 94103
    home_lon: -122.4099, // Approximate lon for 94103
    prefers_remote: false,
    max_travel_miles: 25,
    conditions: ['copd'],
    pregnancy: null,
    comorbidities: null,
    meds: null,
  };

  console.log('Running matchTrials with profile:', profile);

  const result = await matchTrials(profile, { supabase });

  console.log('Match Result Summary:');
  console.log('Total Trials Found:', result.trials.length);
  console.log('Totals:', result.totals);
  console.log('Warnings:', result.warnings);
  console.log('Candidate Count (pre-scoring):', result.candidateCount);
  
  if (result.trials.length > 0) {
    console.log('Top 3 Trials:');
    result.trials.slice(0, 3).forEach(t => {
      console.log(`- ${t.nct_id}: Confidence=${t.confidence}, Distance=${t.distance_miles}`);
    });
  } else {
    console.log('No trials found.');
  }
}

run();
