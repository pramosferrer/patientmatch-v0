CREATE TABLE IF NOT EXISTS public.patient_result_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nct_id TEXT NOT NULL,
  result_label TEXT NOT NULL CHECK (result_label IN ('likely', 'possible', 'no')),
  helpful BOOLEAN NOT NULL,
  reason_code TEXT,
  comment TEXT,
  session_hash UUID,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_result_feedback_created_at
  ON public.patient_result_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_result_feedback_nct_id
  ON public.patient_result_feedback (nct_id);

ALTER TABLE public.patient_result_feedback ENABLE ROW LEVEL SECURITY;

