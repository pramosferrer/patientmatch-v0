-- Migration: add display_title to trials
-- This column stores a patient-friendly title derived from plain_summary_json.
-- The push script extracts display_title from trial_insights.plain_summary_json
-- and denormalizes it here for fast list-view rendering without joining insights.
alter table if exists public.trials
  add column if not exists display_title text;
