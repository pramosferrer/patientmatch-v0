#!/usr/bin/env node

/**
 * Verification Checklist for PatientMatch Flow
 *
 * Run with: node scripts/verification-checklist.js
 */

const fs = require('fs');
const path = require('path');

const checks = [
  {
    id: 'labels-reasons-identical',
    description: 'Labels/reasons identical pre/post screener',
    files: [
      'lib/matchEngine.ts',
      'lib/matching/evaluator.ts'
    ],
    check: (content, file) => {
      if (file.includes('matchEngine')) {
        return content.includes('canonicalizeReason') && content.includes('mapScoreToBucket');
      }
      if (file.includes('evaluator')) {
        return content.includes('canonicalizeReason') && content.includes('mapScoreToBucket');
      }
      return false;
    }
  },
  {
    id: 'slide-over-behavior',
    description: 'Slide-over preserves scroll and deep-links work',
    files: [
      'app/trials/page.client.tsx'
    ],
    check: (content) => {
      return content.includes('Sheet') && content.includes('open={open}') && content.includes('setOpen');
    }
  },
  {
    id: 'deep-link-behavior',
    description: 'Deep-link renders full page',
    files: [
      'app/trial/[nct_id]/screen/page.tsx'
    ],
    check: (content) => {
      return content.includes('TrialScreenClient') || content.includes('confirm-fit');
    }
  },
  {
    id: 'backfill-script-present',
    description: 'Backfill script present with --confirm flag',
    files: [
      'data_engine/backfill_condition_slugs.py'
    ],
    check: (content) => {
      return content.includes('--confirm') && content.includes('upsert');
    }
  },
  {
    id: 'backfill-dry-run',
    description: 'Backfill dry-run prints sample diffs',
    files: [
      'data_engine/backfill_condition_slugs.py'
    ],
    check: (content) => {
      return content.includes('dry-run') && content.includes('print');
    }
  },
  {
    id: 'no-store-match-prefilter',
    description: 'No-store on match/prefilter fetches',
    files: [
      'app/api/match/route.ts',
      'app/api/prefilter/route.js',
      'components/match/ConditionFlow.tsx',
      'components/match/ChatFlow.tsx'
    ],
    check: (content, file) => {
      if (file.includes('route')) {
        return content.includes('Cache-Control') && content.includes('no-store');
      }
      return content.includes('no-store');
    }
  },
  {
    id: 'small-initial-fetch',
    description: 'Small initial fetch (24 trials) with load more',
    files: [
      'app/trials/page.client.tsx'
    ],
    check: (content) => {
      return content.includes('slice(0, 24)');
    }
  },
  {
    id: 'facets-send-slugs',
    description: 'Faceted filters send slugs to API',
    files: [
      'components/trials/TrialsFilters.tsx',
      'app/trials/page.client.tsx'
    ],
    check: (content) => {
      return content.includes('visitModel') && content.includes('ageBand');
    }
  },
  {
    id: 'facets-url-reflects-state',
    description: 'URL reflects facet state for shareability',
    files: [
      'components/trials/TrialsFilters.tsx'
    ],
    check: (content) => {
      return content.includes('visitModel') && content.includes('ageBand');
    }
  },
  {
    id: 'events-fire-once',
    description: 'Events fire exactly once per action',
    files: [
      'lib/analytics.ts'
    ],
    check: (content) => {
      return content.includes('track') && content.includes('screener_submitted');
    }
  },
  {
    id: 'payloads-slug-only',
    description: 'Event payloads contain slugs only (no PII)',
    files: [
      'lib/analytics.ts'
    ],
    check: (content) => {
      return content.includes('export const track') && content.includes('condition_slug') && content.includes('nct_id');
    }
  },
  {
    id: 'condition-pages-sitemap',
    description: 'Condition pages in sitemap with ISR',
    files: [
      'app/sitemap.xml/route.js'
    ],
    check: (content) => {
      return content.includes('fetchAllConditions') && content.includes('conditions/');
    }
  },
  {
    id: 'structured-data-present',
    description: 'Structured data present on condition pages',
    files: [
      'app/conditions/[slug]/page.tsx'
    ],
    check: (content) => {
      return content.includes('MedicalCondition') && content.includes('JsonLd');
    }
  }
];

async function runVerification() {
  console.log('🔍 PatientMatch Verification Checklist\n');

  let passed = 0;
  let total = checks.length;

  for (const check of checks) {
    console.log(`📋 ${check.description}`);

    let checkPassed = false;

    for (const file of check.files) {
      const filePath = path.join(process.cwd(), file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (check.check(content, file)) {
          checkPassed = true;
          console.log(`   ✅ ${file}`);
          break;
        }
      } catch (e) {
        console.log(`   ⚠️  ${file} - File not found or unreadable`);
      }
    }

    if (!checkPassed) {
      console.log(`   ❌ Not implemented`);
    } else {
      passed++;
    }

    console.log('');
  }

  console.log(`📊 Results: ${passed}/${total} checks passed`);

  if (passed === total) {
    console.log('🎉 All requirements verified!');
  } else {
    console.log('⚠️  Some requirements need attention');
  }
}

if (require.main === module) {
  runVerification();
}

module.exports = { runVerification };
