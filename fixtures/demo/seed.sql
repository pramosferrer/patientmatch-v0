insert into public.trials (
  nct_id,
  title,
  display_title,
  conditions,
  status_bucket,
  quality_score,
  sponsor,
  phase,
  status,
  states_list,
  readiness,
  is_publishable,
  questionnaire_json
) values (
  'NCT00000001',
  'Synthetic Study of Supportive Care Navigation',
  'Supportive care navigation study',
  array['synthetic_condition'],
  'Recruiting',
  0.91,
  'Demo Research Network',
  'Not Applicable',
  'Recruiting',
  array['MA'],
  true,
  true,
  '{
    "version": "pmq-demo",
    "questions": [
      {
        "id": "age_years",
        "text": "How old are you?",
        "answer_type": "number",
        "validation": { "min": 18, "max": 80, "unit": "years" },
        "logic": [{ "section": "inclusion", "params": { "min": 18, "max": 80 } }]
      },
      {
        "id": "diagnosis_confirmed",
        "text": "Has a clinician confirmed this condition?",
        "answer_type": "boolean",
        "options": ["Yes", "No"],
        "logic": [{ "section": "inclusion", "qualifies_when": "Yes" }]
      },
      {
        "id": "recent_treatment",
        "text": "Have you received treatment for this condition in the past 6 months?",
        "answer_type": "boolean",
        "options": ["Yes", "No", "Not sure"],
        "logic": [{ "section": "inclusion", "qualifies_when": "Yes" }]
      }
    ]
  }'::jsonb
) on conflict (nct_id) do update set
  title = excluded.title,
  display_title = excluded.display_title,
  conditions = excluded.conditions,
  status_bucket = excluded.status_bucket,
  quality_score = excluded.quality_score,
  sponsor = excluded.sponsor,
  phase = excluded.phase,
  status = excluded.status,
  states_list = excluded.states_list,
  readiness = excluded.readiness,
  is_publishable = excluded.is_publishable,
  questionnaire_json = excluded.questionnaire_json;

insert into public.trial_sites (
  nct_id,
  facility_name,
  city,
  state,
  postal_code,
  lat,
  lon
) values (
  'NCT00000001',
  'Demo Medical Center',
  'Boston',
  'MA',
  '02115',
  42.3429,
  -71.1003
);

insert into public.zip_centroids (postal_code, lat, lon) values
  ('02115', 42.3429, -71.1003),
  ('10001', 40.7506, -73.9972)
on conflict (postal_code) do update set
  lat = excluded.lat,
  lon = excluded.lon;
