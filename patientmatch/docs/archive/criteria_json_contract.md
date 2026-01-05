# Criteria JSON Contract [DEPRECATED]

> [!WARNING]
> **DEPRECATED**: This document describes the legacy `criteria_json` contract. 
> The storefront now uses the **Serving Contract** (see `docs/serving_contract.md`) and the `questionnaire_json` (PMQ v10) pattern.

## Overview

The `criteria_json` field contains structured eligibility criteria that the adapter (`lib/criteria/adapter.ts`) converts into UI questions for the screener interface.

## Supported Input Formats

### Format 1: Object with Include/Exclude Arrays

```json
{
  "includes": [
    {
      "criterion_id": "age_min",
      "category": "demographics", 
      "source": "patient",
      "rule": {
        "variable": "age",
        "operator": ">=",
        "value": 18
      },
      "question_text": "What is your age?",
      "critical": true
    },
    {
      "criterion_id": "diagnosis_required",
      "category": "medical",
      "source": "patient", 
      "rule": {
        "field": "diagnosis",
        "operator": "in",
        "value": ["diabetes", "hypertension"]
      }
    }
  ],
  "excludes": [
    {
      "criterion_id": "pregnancy_exclusion",
      "category": "demographics",
      "source": "patient",
      "rule": {
        "variable": "pregnant", 
        "operator": "is",
        "value": true
      },
      "question_text": "Are you currently pregnant?"
    }
  ]
}
```

### Format 2: Flat Array with Type Property

```json
[
  {
    "id": "bmi_requirement",
    "type": "inclusion",
    "category": "vitals",
    "rule": {
      "field": "bmi",
      "operator": "<=", 
      "value": 35
    }
  },
  {
    "criterion_id": "smoking_exclusion",
    "type": "exclude", 
    "category": "lifestyle",
    "rule": {
      "variable": "smoking_status",
      "operator": "is",
      "value": "current"
    }
  }
]
```

## Mapping Rules

### Field Detection

The adapter checks both `rule.variable` and `rule.field` properties for the criterion field name.

### UI Question Type Mapping

1. **Number Input** (`kind: 'number'`)
   - Field name matches: `age`, `bmi`, `ecog`, `weight`, `height`, or contains numeric lab values
   - Rule has numeric `value` with operators: `>=`, `<=`, `>`, `<`, `=`, `between`

2. **Choice Input** (`kind: 'choice'`)  
   - Rule `value` is a short string array (≤10 items, ≤50 chars each)
   - Field name matches categorical patterns: `sex`, `diagnosis`, `status`, etc.

3. **Boolean Input** (`kind: 'boolean'`)
   - Default fallback for all other cases
   - Generates patient-friendly yes/no questions

### Required Fields

**Minimum required per criterion:**
- `criterion_id` or `id` (identifier)
- `type`: `"inclusion"`, `"exclusion"`, `"include"`, or `"exclude"`  
- Either `rule` object or sufficient data for question generation

**Auto-filled if missing:**
- `category`: defaults to `"unknown"`
- `source`: defaults to `"patient"`

### Question Label Generation

1. **Use existing text**: `question_text` if patient-friendly
2. **Generate from rule**: Based on field name and medical terminology mapping
3. **Fallback**: Generic question based on category and type

## Parser Guidelines

### DO:
- Include both field variants (`variable` AND `field`) for compatibility
- Use descriptive `criterion_id` values
- Set `critical: true` for mandatory requirements  
- Provide `question_text` when available from source data
- Use consistent `type` values (`inclusion`/`exclusion`)

### DON'T:
- Rely on `source: "patient"` filtering (removed in current adapter)
- Use extremely long option arrays (>10 items)
- Mix data types in the same criterion object
- Omit the `rule` object for criteria that need evaluation

## Testing

The adapter includes unit tests for both formats:
```javascript
// Run server-side to verify both shapes work
console.log('Adapter test results in server logs')
```

## Version History

- **v1.0**: Initial object format with includes/excludes
- **v1.1**: Added flat array support with type property  
- **v1.2**: Removed source filtering, added field/variable dual support
- **v1.3**: Enhanced tolerance for missing fields and naming variations

---

**See also:** `frontend/lib/criteria/adapter.ts` for implementation details
