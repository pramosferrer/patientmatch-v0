-- Patient funnel dashboard query (last 30 days)
-- Source table: public.events
-- Session key: events.props->>'session_hash'

WITH base AS (
  SELECT
    DATE_TRUNC('day', created_at)::date AS event_date,
    NULLIF(props->>'session_hash', '') AS session_hash,
    name
  FROM public.events
  WHERE created_at >= NOW() - INTERVAL '30 days'
),
session_steps AS (
  SELECT
    event_date,
    session_hash,
    BOOL_OR(name = 'patient_landing_view') AS saw_landing,
    BOOL_OR(name = 'patient_trials_view') AS saw_trials,
    BOOL_OR(name = 'patient_screener_started') AS started_screener,
    BOOL_OR(name IN ('screener_completed', 'patient_screener_completed')) AS completed_screener,
    BOOL_OR(name = 'patient_result_viewed') AS viewed_result,
    BOOL_OR(name = 'patient_lead_form_opened') AS opened_lead_form,
    BOOL_OR(name IN ('lead_submitted', 'patient_lead_submitted')) AS submitted_lead
  FROM base
  WHERE session_hash IS NOT NULL
  GROUP BY event_date, session_hash
),
daily AS (
  SELECT
    event_date,
    COUNT(*) AS sessions,
    COUNT(*) FILTER (WHERE saw_landing) AS landing_sessions,
    COUNT(*) FILTER (WHERE saw_trials) AS trials_sessions,
    COUNT(*) FILTER (WHERE started_screener) AS screener_start_sessions,
    COUNT(*) FILTER (WHERE completed_screener) AS screener_complete_sessions,
    COUNT(*) FILTER (WHERE viewed_result) AS result_sessions,
    COUNT(*) FILTER (WHERE opened_lead_form) AS lead_open_sessions,
    COUNT(*) FILTER (WHERE submitted_lead) AS lead_submit_sessions
  FROM session_steps
  GROUP BY event_date
)
SELECT
  event_date,
  sessions,
  landing_sessions,
  trials_sessions,
  screener_start_sessions,
  screener_complete_sessions,
  result_sessions,
  lead_open_sessions,
  lead_submit_sessions,
  ROUND(100.0 * trials_sessions / NULLIF(landing_sessions, 0), 2) AS pct_landing_to_trials,
  ROUND(100.0 * screener_start_sessions / NULLIF(trials_sessions, 0), 2) AS pct_trials_to_screener_start,
  ROUND(100.0 * screener_complete_sessions / NULLIF(screener_start_sessions, 0), 2) AS pct_screener_completion,
  ROUND(100.0 * result_sessions / NULLIF(screener_complete_sessions, 0), 2) AS pct_complete_to_result,
  ROUND(100.0 * lead_open_sessions / NULLIF(result_sessions, 0), 2) AS pct_result_to_lead_open,
  ROUND(100.0 * lead_submit_sessions / NULLIF(lead_open_sessions, 0), 2) AS pct_lead_open_to_submit,
  ROUND(100.0 * lead_submit_sessions / NULLIF(landing_sessions, 0), 2) AS pct_landing_to_lead_submit
FROM daily
ORDER BY event_date DESC;

