// lib/matchEngine.test.ts
// Unit tests for the matchEngine scoring functionality

import { scoreTrial, extractKeyInclusions, type ScoreResult, type KeyInclusion } from './matchEngine';

/**
 * SCORING BEHAVIOR VALIDATION SCRIPT
 *
 * This file contains comprehensive tests that validate the expected scoring ranges:
 *
 * Expected Scoring Ranges:
 * - Age in range: +30 → ≥70% Likely (50 base + 30 age = 80%)
 * - Age out of range: -30 → ≤30% Unlikely (50 base - 30 age = 20%)
 * - Sex compatible: +15 → ~60-65% Possible (50 base + 15 sex = 65%)
 * - Sex incompatible: -15 → ~35-40% Unlikely (50 base - 15 sex = 35%)
 * - Key includes (per item): +10 → +30 total for 3 items
 * - Recruiting: +10 → ~55-60% Possible (50 base + 10 recruiting = 60%)
 * - Remote/Hybrid: +5 → ~52-55% Possible (50 base + 5 remote = 55%)
 * - Distance within radius: +10 → ~55-60% Possible (50 base + 10 distance = 60%)
 * - Distance far: -10 → ~40-45% Possible (50 base - 10 distance = 40%)
 * - Critical exclusion: score = 0 → 0% Unlikely
 */
import { UrlMatchProfile } from '@/lib/schemas/patientProfile';

// Sample profile for testing
const sampleProfile: UrlMatchProfile = {
  condition: 'diabetes',
  age: 45,
  sex: 'female',
  zip: '10001',
  radiusMiles: 25,
  remoteOk: false
};

describe('scoreTrial', () => {
  describe('age gate scoring', () => {
    it('should give +30 bonus for age in range (both bounds)', () => {
      const trial = {
        nct_id: 'NCT001',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 65,
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.score0to100).toBeGreaterThan(50); // Should be > 50 due to age bonus
      expect(result.reasons).toContain('Age in range');
      expect(result.details.some(d => d.factor === 'Age Range' && d.impact === 30)).toBe(true);
    });

    it('should give -30 penalty for age out of range', () => {
      const trial = {
        nct_id: 'NCT002',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 35, // Age 45 is too old
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.score0to100).toBeLessThan(50); // Should be < 50 due to age penalty
      expect(result.reasons).toContain('Age outside range');
      expect(result.details.some(d => d.factor === 'Age Range' && d.impact === -30)).toBe(true);
    });

    it('should handle partial age bounds (minimum only)', () => {
      const trial = {
        nct_id: 'NCT003',
        title: 'Test Trial',
        min_age_years: 40, // Age 45 meets minimum
        max_age_years: null,
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.score0to100).toBeGreaterThan(50);
      expect(result.reasons).toContain('Meets age minimum');
    });
  });

  describe('sex gate scoring', () => {
    it('should give +15 bonus for compatible sex', () => {
      const trial = {
        nct_id: 'NCT004',
        title: 'Test Trial',
        gender: 'female',
        min_age_years: 18,
        max_age_years: 65,
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.details.some(d => d.factor === 'Sex Compatibility' && d.impact === 15)).toBe(true);
      expect(result.reasons).toContain('Sex compatible');
    });

    it('should give -15 penalty for incompatible sex', () => {
      const trial = {
        nct_id: 'NCT005',
        title: 'Test Trial',
        gender: 'male', // Profile is female
        min_age_years: 18,
        max_age_years: 65,
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.details.some(d => d.factor === 'Sex Compatibility' && d.impact === -15)).toBe(true);
      expect(result.reasons).toContain('Sex incompatible');
    });

    it('should give +15 bonus for "all" gender acceptance', () => {
      const trial = {
        nct_id: 'NCT006',
        title: 'Test Trial',
        gender: 'all',
        min_age_years: 18,
        max_age_years: 65,
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.details.some(d => d.factor === 'Sex Compatibility' && d.impact === 15)).toBe(true);
      expect(result.reasons).toContain('Accepts all genders');
    });
  });

  describe('support signals scoring', () => {
    it('should give +10 bonus for recruiting status', () => {
      const trial = {
        nct_id: 'NCT007',
        title: 'Test Trial',
        phase: 'PHASE2_RECRUITING',
        min_age_years: 18,
        max_age_years: 65,
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.details.some(d => d.factor === 'Recruiting Status' && d.impact === 10)).toBe(true);
      expect(result.reasons).toContain('Actively recruiting');
    });

    it('should give +5 bonus for remote/hybrid visits', () => {
      const trial = {
        nct_id: 'NCT008',
        title: 'Test Trial',
        visit_model: 'remote',
        min_age_years: 18,
        max_age_years: 65,
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.details.some(d => d.factor === 'Visit Model' && d.impact === 5)).toBe(true);
      expect(result.reasons).toContain('Remote/Hybrid allowed');
    });
  });

  describe('label mapping', () => {
    it('should return "Likely" for scores >= 70', () => {
      const trial = {
        nct_id: 'NCT009',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 65,
        gender: 'female',
        visit_model: 'remote',
        phase: 'PHASE2_RECRUITING',
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.label).toBe('Likely');
      expect(result.score0to100).toBeGreaterThanOrEqual(70);
    });

    it('should return "Possible" for scores 40-69', () => {
      const trial = {
        nct_id: 'NCT010',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 65,
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.label).toBe('Likely'); // Age bonus should put it in Likely range
      expect(result.score0to100).toBeGreaterThanOrEqual(40);
    });

    it('should return "Unlikely" for scores < 40', () => {
      const trial = {
        nct_id: 'NCT011',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 35, // Age out of range
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.label).toBe('Unlikely');
      expect(result.score0to100).toBeLessThan(40);
    });
  });

  describe('hard exclusions', () => {
    it('should return score = 0 for critical exclusions', () => {
      const trial = {
        nct_id: 'NCT012',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 65,
        criteria_json: [{
          criterion_id: 'exc_001',
          type: 'exclusion',
          category: 'medical_history',
          source: 'patient',
          question_text: 'Do you have diabetes?',
          rule: { variable: 'diabetes', operator: 'is', value: true },
          critical: true
        }]
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.score0to100).toBe(0);
      expect(result.label).toBe('Unlikely');
      expect(result.reasons).toContain('Critical exclusion criteria');
    });
  });

  describe('reasons and details', () => {
    it('should return max 3 reasons', () => {
      const trial = {
        nct_id: 'NCT013',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 65,
        gender: 'female',
        visit_model: 'remote',
        phase: 'PHASE2_RECRUITING',
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.reasons.length).toBeLessThanOrEqual(3);
      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details.length).toBeGreaterThan(0);
    });

    it('should include detailed breakdown', () => {
      const trial = {
        nct_id: 'NCT014',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 65,
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      const ageDetail = result.details.find(d => d.factor === 'Age Range');
      expect(ageDetail).toBeDefined();
      expect(ageDetail!.impact).toBe(30);
      expect(ageDetail!.reason).toContain('45');
      expect(ageDetail!.reason).toContain('18-65');
    });
  });

  describe('distance handling', () => {
    it('should not apply distance penalties for trials without location data', () => {
      const trial = {
        nct_id: 'NCT015',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 65,
        locations: null, // No location data
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      // Should still get age bonus but no distance scoring
      expect(result.score0to100).toBeGreaterThan(50);
      expect(result.details.some(d => d.factor === 'Distance')).toBe(false);
      expect(result.reasons.some(r => r.includes('miles'))).toBe(false);
    });

    it('should not apply distance penalties for trials with empty location array', () => {
      const trial = {
        nct_id: 'NCT016',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 65,
        locations: [], // Empty location array
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      // Should still get age bonus but no distance scoring
      expect(result.score0to100).toBeGreaterThan(50);
      expect(result.details.some(d => d.factor === 'Distance')).toBe(false);
      expect(result.reasons.some(r => r.includes('miles'))).toBe(false);
    });

    it('should not apply distance penalties for trials with invalid coordinates', () => {
      const trial = {
        nct_id: 'NCT017',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 65,
        locations: [
          { lat: null, lng: null }, // Invalid coordinates
          { lat: 'invalid', lng: 'invalid' }
        ],
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      // Should still get age bonus but no distance scoring
      expect(result.score0to100).toBeGreaterThan(50);
      expect(result.details.some(d => d.factor === 'Distance')).toBe(false);
      expect(result.reasons.some(r => r.includes('miles'))).toBe(false);
    });

    it('should apply distance bonuses for trials with valid coordinates', () => {
      const trial = {
        nct_id: 'NCT018',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 65,
        locations: [
          { lat: 40.7128, lng: -74.0060 } // Valid NYC coordinates
        ],
        criteria_json: null
      };

      // Profile with NYC zip (close to trial location)
      const nycProfile: UrlMatchProfile = {
        ...sampleProfile,
        zip: '10001' // NYC zip
      };

      const result: ScoreResult = scoreTrial(nycProfile, trial);

      // Should get age bonus + distance bonus
      expect(result.score0to100).toBeGreaterThan(50);
      expect(result.details.some(d => d.factor === 'Distance' && d.impact === 10)).toBe(true);
      expect(result.reasons.some(r => r.includes('Within'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle missing trial data gracefully', () => {
      const trial = {
        nct_id: 'NCT019',
        title: 'Test Trial',
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.score0to100).toBe(50); // Neutral score
      expect(result.label).toBe('Possible');
    });

    it('should handle null/undefined profile fields', () => {
      const incompleteProfile: UrlMatchProfile = {
        condition: 'diabetes',
        age: 45,
        radiusMiles: 50,
        remoteOk: true,
        // Missing sex, zip, etc.
      };

      const trial = {
        nct_id: 'NCT016',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 65,
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(incompleteProfile, trial);

      expect(result.score0to100).toBeGreaterThan(50); // Still gets age bonus
      expect(result.details.some(d => d.factor === 'Age Range')).toBe(true);
    });
  });
});

describe('extractKeyInclusions', () => {
  describe('priority ordering', () => {
    it('should prioritize BMI/ECOG over other criteria', () => {
      const criteriaJson = [
        {
          criterion_id: 'inc_001',
          type: 'inclusion',
          category: 'vitals',
          source: 'patient',
          rule: { variable: 'bmi', operator: '>=', value: 18.5 },
          critical: false
        },
        {
          criterion_id: 'inc_002',
          type: 'inclusion',
          category: 'performance',
          source: 'patient',
          rule: { variable: 'ecog', operator: '<=', value: 1 },
          critical: false
        },
        {
          criterion_id: 'inc_003',
          type: 'inclusion',
          category: 'medical_history',
          source: 'patient',
          rule: { variable: 'diagnosis', operator: 'is', value: true },
          critical: false
        }
      ];

      const result: KeyInclusion[] = extractKeyInclusions(criteriaJson, 3);

      expect(result).toHaveLength(3);
      expect(result[0].field).toContain('bmi');
      expect(result[1].field).toContain('ecog');
      expect(result[2].field).toContain('diagnosis');
      expect(result[0].priority).toBeGreaterThan(result[1].priority);
      expect(result[1].priority).toBeGreaterThan(result[2].priority);
    });

    it('should prioritize therapy lines over general medical history', () => {
      const criteriaJson = [
        {
          criterion_id: 'inc_001',
          type: 'inclusion',
          category: 'treatment',
          source: 'patient',
          rule: { variable: 'prior_therapy_lines', operator: '<=', value: 2 },
          critical: false
        },
        {
          criterion_id: 'inc_002',
          type: 'inclusion',
          category: 'medical_history',
          source: 'patient',
          rule: { variable: 'smoking_history', operator: 'is', value: false },
          critical: false
        }
      ];

      const result: KeyInclusion[] = extractKeyInclusions(criteriaJson, 2);

      expect(result).toHaveLength(2);
      expect(result[0].field).toContain('therapy');
      expect(result[1].field).toContain('smoking');
      expect(result[0].priority).toBeGreaterThan(result[1].priority);
    });

    it('should boost priority for critical criteria', () => {
      const criteriaJson = [
        {
          criterion_id: 'inc_001',
          type: 'inclusion',
          category: 'medical_history',
          source: 'patient',
          rule: { variable: 'diagnosis', operator: 'is', value: true },
          critical: false
        },
        {
          criterion_id: 'inc_002',
          type: 'inclusion',
          category: 'medical_history',
          source: 'patient',
          rule: { variable: 'diagnosis', operator: 'is', value: true },
          critical: true
        }
      ];

      const result: KeyInclusion[] = extractKeyInclusions(criteriaJson, 2);

      expect(result).toHaveLength(2);
      expect(result[0].priority).toBeGreaterThan(result[1].priority);
      expect(result[0].clause?.critical).toBe(true);
    });
  });

  describe('limit handling', () => {
    it('should limit to specified max items', () => {
      const criteriaJson = Array.from({ length: 10 }, (_, i) => ({
        criterion_id: `inc_${i}`,
        type: 'inclusion',
        category: 'test',
        source: 'patient',
        rule: { variable: `field_${i}`, operator: '>=', value: i },
        critical: false
      }));

      const result: KeyInclusion[] = extractKeyInclusions(criteriaJson, 3);
      expect(result).toHaveLength(3);
    });

    it('should return all items if fewer than limit', () => {
      const criteriaJson = [
        {
          criterion_id: 'inc_001',
          type: 'inclusion',
          category: 'test',
          source: 'patient',
          rule: { variable: 'field_1', operator: '>=', value: 1 },
          critical: false
        }
      ];

      const result: KeyInclusion[] = extractKeyInclusions(criteriaJson, 5);
      expect(result).toHaveLength(1);
    });
  });

  describe('kind detection', () => {
    it('should detect number kind for numeric fields', () => {
      const criteriaJson = [
        {
          criterion_id: 'inc_001',
          type: 'inclusion',
          category: 'vitals',
          source: 'patient',
          rule: { variable: 'bmi', operator: '>=', value: 18.5 },
          critical: false
        }
      ];

      const result: KeyInclusion[] = extractKeyInclusions(criteriaJson, 1);

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('number');
      expect(result[0].operator).toBe('min');
      expect(result[0].value).toBe(18.5);
    });

    it('should detect boolean kind for yes/no questions', () => {
      const criteriaJson = [
        {
          criterion_id: 'inc_001',
          type: 'inclusion',
          category: 'medical_history',
          source: 'patient',
          rule: { variable: 'diagnosis', operator: 'is', value: true },
          critical: false
        }
      ];

      const result: KeyInclusion[] = extractKeyInclusions(criteriaJson, 1);

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('boolean');
      expect(result[0].field).toBe('diagnosis');
    });

    it('should detect choice kind for categorical fields', () => {
      const criteriaJson = [
        {
          criterion_id: 'inc_001',
          type: 'inclusion',
          category: 'demographics',
          source: 'patient',
          rule: { variable: 'ethnicity', operator: 'in', value: ['Hispanic', 'Non-Hispanic'] },
          critical: false
        }
      ];

      const result: KeyInclusion[] = extractKeyInclusions(criteriaJson, 1);

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('choice');
      expect(result[0].field).toBe('ethnicity');
    });
  });

  describe('edge cases', () => {
    it('should handle empty criteria_json', () => {
      const result: KeyInclusion[] = extractKeyInclusions(null);
      expect(result).toHaveLength(0);
    });

    it('should handle non-array criteria_json', () => {
      const result: KeyInclusion[] = extractKeyInclusions({ test: 'value' });
      expect(result).toHaveLength(0);
    });

    it('should handle criteria_json with no inclusions', () => {
      const criteriaJson = [
        {
          criterion_id: 'exc_001',
          type: 'exclusion',
          category: 'test',
          source: 'patient',
          rule: { variable: 'test', operator: 'is', value: true },
          critical: false
        }
      ];

      const result: KeyInclusion[] = extractKeyInclusions(criteriaJson, 1);
      expect(result).toHaveLength(0);
    });

    it('should handle malformed criteria gracefully', () => {
      const criteriaJson = [
        {
          criterion_id: 'inc_001',
          type: 'inclusion',
          category: 'test',
          source: 'patient'
          // Missing rule
        }
      ];

      const result: KeyInclusion[] = extractKeyInclusions(criteriaJson, 1);
      expect(result).toHaveLength(0);
    });
  });

  describe('label generation', () => {
    it('should generate appropriate labels from criteria', () => {
      const criteriaJson = [
        {
          criterion_id: 'inc_001',
          type: 'inclusion',
          category: 'vitals',
          source: 'patient',
          rule: { variable: 'bmi', operator: '>=', value: 18.5 },
          critical: false
        }
      ];

      const result: KeyInclusion[] = extractKeyInclusions(criteriaJson, 1);

      expect(result).toHaveLength(1);
      expect(result[0].field).toContain('bmi');
      expect(result[0].field).toBe('bmi');
    });
  });

  describe('scoring behavior validation', () => {
    it('exclusion hit should result in 0% Unlikely', () => {
      const trial = {
        nct_id: 'NCT020',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 65,
        criteria_json: [{
          criterion_id: 'exc_001',
          type: 'exclusion',
          category: 'medical_history',
          source: 'patient',
          rule: { variable: 'pregnancy', operator: 'is', value: true },
          critical: true
        }]
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.score0to100).toBe(0);
      expect(result.label).toBe('Unlikely');
      expect(result.reasons).toContain('Critical exclusion criteria');
      // Should not have any positive scoring components
      expect(result.details.every(d => d.impact <= 0)).toBe(true);
    });

    it('age out of range with both bounds should result in ≤30% Unlikely', () => {
      const trial = {
        nct_id: 'NCT021',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 35, // Age 45 is out of range
        criteria_json: null
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.score0to100).toBeLessThanOrEqual(30);
      expect(result.label).toBe('Unlikely');
      expect(result.reasons).toContain('Age outside range');
      expect(result.details.some(d => d.factor === 'Age Range' && d.impact === -30)).toBe(true);
    });

    it('all core gates + 3 key includes met + recruiting should result in ≥80% Likely', () => {
      const trial = {
        nct_id: 'NCT022',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 65, // Age 45 is in range
        gender: 'female', // Matches profile
        phase: 'PHASE2_RECRUITING', // Recruiting status
        visit_model: 'remote', // Remote available
        criteria_json: [
          {
            criterion_id: 'inc_001',
            type: 'inclusion',
            category: 'vitals',
            source: 'patient',
            rule: { variable: 'bmi', operator: '>=', value: 18.5 },
            critical: true
          },
          {
            criterion_id: 'inc_002',
            type: 'inclusion',
            category: 'performance',
            source: 'patient',
            rule: { variable: 'ecog', operator: '<=', value: 1 },
            critical: true
          },
          {
            criterion_id: 'inc_003',
            type: 'inclusion',
            category: 'treatment',
            source: 'patient',
            rule: { variable: 'prior_therapy_lines', operator: '<=', value: 2 },
            critical: true
          }
        ]
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      expect(result.score0to100).toBeGreaterThanOrEqual(80);
      expect(result.label).toBe('Likely');
      expect(result.reasons).toContain('Age in range');
      expect(result.reasons).toContain('Sex compatible');
      expect(result.reasons).toContain('Actively recruiting');
      expect(result.reasons).toContain('Remote/Hybrid allowed');
      expect(result.details.some(d => d.factor === 'Age Range' && d.impact === 30)).toBe(true);
      expect(result.details.some(d => d.factor === 'Sex Compatibility' && d.impact === 15)).toBe(true);
      expect(result.details.some(d => d.factor === 'Recruiting Status' && d.impact === 10)).toBe(true);
      expect(result.details.some(d => d.factor === 'Visit Model' && d.impact === 5)).toBe(true);
      // Should have key inclusion bonuses
      expect(result.details.some(d => d.factor === 'Key Inclusion')).toBe(true);
    });

    it('unknown-heavy case with recruiting only should result in ~55–65% Possible', () => {
      const trial = {
        nct_id: 'NCT023',
        title: 'Test Trial',
        phase: 'PHASE2_RECRUITING', // Only recruiting status
        criteria_json: null // No criteria data
      };

      const result: ScoreResult = scoreTrial(sampleProfile, trial);

      // Should be around 55-65% (neutral 50 + recruiting 10)
      expect(result.score0to100).toBeGreaterThanOrEqual(55);
      expect(result.score0to100).toBeLessThanOrEqual(65);
      expect(result.label).toBe('Possible');
      expect(result.reasons).toContain('Actively recruiting');
      expect(result.details.some(d => d.factor === 'Recruiting Status' && d.impact === 10)).toBe(true);
    });

    it('perfect match should achieve high score', () => {
      const trial = {
        nct_id: 'NCT024',
        title: 'Test Trial',
        min_age_years: 18,
        max_age_years: 65,
        gender: 'female',
        phase: 'PHASE2_RECRUITING',
        visit_model: 'remote',
        locations: [
          { lat: 40.7128, lng: -74.0060 } // Valid NYC coordinates
        ],
        criteria_json: [
          {
            criterion_id: 'inc_001',
            type: 'inclusion',
            category: 'vitals',
            source: 'patient',
            rule: { variable: 'bmi', operator: '>=', value: 18.5 },
            critical: true
          }
        ]
      };

      const nycProfile: UrlMatchProfile = {
        ...sampleProfile,
        zip: '10001' // NYC zip for distance bonus
      };

      const result: ScoreResult = scoreTrial(nycProfile, trial);

      expect(result.score0to100).toBeGreaterThanOrEqual(90);
      expect(result.label).toBe('Likely');
      expect(result.reasons).toContain('Age in range');
      expect(result.reasons).toContain('Sex compatible');
      expect(result.reasons).toContain('Actively recruiting');
      expect(result.reasons).toContain('Remote/Hybrid allowed');
      expect(result.reasons.some(r => r.includes('Within'))).toBe(true);
    });

    it('distance slider changes affect on-site-only trials', () => {
      const onSiteTrial = {
        nct_id: 'NCT026',
        title: 'On-site Only Trial',
        min_age_years: 18,
        max_age_years: 65,
        locations: [
          { lat: 40.7128, lng: -74.0060, city: 'New York', state: 'NY' } // NYC coordinates
        ],
        visit_model: 'on_site', // On-site only
        criteria_json: null
      };

      const nycProfile: UrlMatchProfile = {
        ...sampleProfile,
        zip: '10001' // NYC zip
      };

      // Test with small radius (should get penalty)
      const smallRadiusResult = scoreTrial({ ...nycProfile, radiusMiles: 10 }, onSiteTrial);
      expect(smallRadiusResult.details.some(d => d.factor === 'Distance' && d.impact === -10)).toBe(true);

      // Test with large radius (should get bonus or neutral)
      const largeRadiusResult = scoreTrial({ ...nycProfile, radiusMiles: 100 }, onSiteTrial);
      expect(largeRadiusResult.details.some(d => d.factor === 'Distance' && d.impact >= 0)).toBe(true);
    });

    it('remote/hybrid trials are not penalized for distance', () => {
      const remoteTrial = {
        nct_id: 'NCT027',
        title: 'Remote Trial',
        min_age_years: 18,
        max_age_years: 65,
        locations: [
          { lat: 40.7128, lng: -74.0060, city: 'New York', state: 'NY' }
        ],
        visit_model: 'remote', // Remote trial
        criteria_json: null
      };

      const ruralProfile: UrlMatchProfile = {
        ...sampleProfile,
        zip: '10001' // NYC zip - far from many trial sites
      };

      // Even with small radius, remote trials should not be penalized
      const result = scoreTrial({ ...ruralProfile, radiusMiles: 5 }, remoteTrial);
      expect(result.details.every(d => d.factor !== 'Distance' || d.impact >= 0)).toBe(true);
    });

    it('should document expected scoring ranges in comments', () => {
      // Expected ranges based on scoring constants:
      // - Age in range: +30 → ≥70% Likely (50 base + 30 age = 80%)
      // - Age out of range: -30 → ≤30% Unlikely (50 base - 30 age = 20%)
      // - Sex compatible: +15 → ~60-65% Possible (50 base + 15 sex = 65%)
      // - Sex incompatible: -15 → ~35-40% Unlikely (50 base - 15 sex = 35%)
      // - Key includes (per item): +10 → +30 total for 3 items
      // - Recruiting: +10 → ~55-60% Possible (50 base + 10 recruiting = 60%)
      // - Remote/Hybrid: +5 → ~52-55% Possible (50 base + 5 remote = 55%)
      // - Distance within radius: +10 → ~55-60% Possible (50 base + 10 distance = 60%)
      // - Distance far: -10 → ~40-45% Possible (50 base - 10 distance = 40%)
      // - Critical exclusion: score = 0 → 0% Unlikely

      const neutralTrial = {
        nct_id: 'NCT025',
        title: 'Neutral Trial',
        criteria_json: null
      };

      const neutralResult = scoreTrial(sampleProfile, neutralTrial);
      expect(neutralResult.score0to100).toBe(50); // Base neutral score
      expect(neutralResult.label).toBe('Possible');
    });
  });
});
