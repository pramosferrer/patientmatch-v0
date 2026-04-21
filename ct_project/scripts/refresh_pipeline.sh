#!/usr/bin/env bash
# refresh_pipeline.sh — Weekly AACT pull + full pipeline rebuild
#
# Usage:
#   ./scripts/refresh_pipeline.sh                   # auto-detect today's date
#   ./scripts/refresh_pipeline.sh 2026-04-20        # explicit YYYY-MM-DD
#   ./scripts/refresh_pipeline.sh --skip-download   # skip AACT pull, re-run pipeline only
#
# Requires: curl, unzip, duckdb, python (venv activated or in PATH)
# Run from ct_project/ root.

set -euo pipefail

PIPELINE_VERSION="pmq_v19_answerability_trim_2025_12_24"
RAW_DIR="rawdata/current"
DB_PATH="db/aact.duckdb"
LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/refresh_pipeline_$(date +%Y%m%d_%H%M%S).log"

# ── AACT URL ────────────────────────────────────────────────────────────────
# AACT daily exports: https://aact.ctti-clinicaltrials.org/static/exported_files/daily/YYYY-MM-DD?source=web
AACT_DATE="${1:-$(date +%Y-%m-%d)}"
SKIP_DOWNLOAD=false
if [[ "${1:-}" == "--skip-download" ]]; then
  SKIP_DOWNLOAD=true
  AACT_DATE=$(date +%Y-%m-%d)
fi

AACT_URL="https://aact.ctti-clinicaltrials.org/static/exported_files/daily/${AACT_DATE}?source=web"
ZIP_TMP="/tmp/aact_${AACT_DATE}.zip"

# ── Helpers ──────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "${LOG_FILE}"; }
die() { log "ERROR: $*"; exit 1; }

mkdir -p "${LOG_DIR}"
log "=== AACT Pipeline Refresh ==="
log "Pipeline version : ${PIPELINE_VERSION}"
log "AACT date        : ${AACT_DATE}"
log "Log              : ${LOG_FILE}"

# ── Step 1: Download + extract AACT flat files ───────────────────────────────
if [[ "${SKIP_DOWNLOAD}" == false ]]; then
  log "Downloading AACT flat files from ${AACT_URL} ..."
  curl -fL --progress-bar "${AACT_URL}" -o "${ZIP_TMP}" \
    || die "Download failed. Check the URL or your AACT account access."

  log "Extracting to ${RAW_DIR}/ (overwriting in place) ..."
  unzip -o -j "${ZIP_TMP}" -d "${RAW_DIR}" >> "${LOG_FILE}" 2>&1

  log "Removing zip (storage cleanup) ..."
  rm -f "${ZIP_TMP}"

  log "AACT files updated."
else
  log "Skipping download (--skip-download set)."
fi

# ── Step 2: Rebuild DuckDB pipeline (ref → bronze → silver → gold) ───────────
log "Running refresh.sql ..."
duckdb "${DB_PATH}" < sql/refresh.sql >> "${LOG_FILE}" 2>&1
log "DuckDB refresh complete."

export PYTHONPATH="$(pwd):${PYTHONPATH:-}"

# ── Step 3: Build questionnaires (incremental — skips if eligibility unchanged)
log "Building questionnaires (version: ${PIPELINE_VERSION}) ..."
python scripts/build_pm_questionnaires.py \
  --db "${DB_PATH}" \
  --pipeline-version "${PIPELINE_VERSION}" \
  2>&1 | tee -a "${LOG_FILE}"
log "Questionnaire build complete."

# ── Step 4: Build trial insights (incremental — skips if input_hash unchanged)
log "Building trial insights (version: ${PIPELINE_VERSION}) ..."
python scripts/build_pm_trial_insights.py \
  --db "${DB_PATH}" \
  --pipeline "${PIPELINE_VERSION}" \
  2>&1 | tee -a "${LOG_FILE}"
log "Insights build complete."

# ── Step 5: Push to Supabase ─────────────────────────────────────────────────
log "Pushing to Supabase (mode: permissive, limit: all) ..."
python scripts/push_to_supabase.py \
  --build_tag "${PIPELINE_VERSION}" \
  --mode permissive \
  --limit 0 \
  2>&1 | tee -a "${LOG_FILE}"

log "=== Pipeline refresh complete. Log: ${LOG_FILE} ==="
