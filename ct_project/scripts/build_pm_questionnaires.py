#!/usr/bin/env python3
"""
Build PatientMatch questionnaires (deterministic phases 1-4).

Run after refresh.sql. Re-run anytime; it will skip unchanged trials unless --force.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter

from pmq.dbio import (
    connect,
    ensure_output_tables,
    fetch_trials_for_questionnaires,
    upsert_atoms_batch,
    upsert_criteria_batch,
    upsert_questionnaire_batch,
    write_eval_snapshot,
)
from pmq.generator import generate_questionnaire
from pmq.atoms import extract_atoms_from_text
from pmq.rules import DEFAULT_RULES, extract_criteria_from_text
from pmq.question_bank import (
    lint_answer_type_contract,
    lint_priority_guardrails,
    lint_question_bank_vs_rules,
    lint_single_select_not_sure,
    lint_template_placeholders,
)


DEFAULT_PIPELINE_VERSION = "pmq_v19_answerability_trim_2025_12_24"


def _parse_bool(value: str) -> bool:
    v = value.strip().lower()
    if v in ("1", "true", "t", "yes", "y"):
        return True
    if v in ("0", "false", "f", "no", "n"):
        return False
    raise argparse.ArgumentTypeError(f"Expected a boolean value, got: {value}")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--db", required=True, help="Path to aact.duckdb")
    p.add_argument("--pipeline-version", default=DEFAULT_PIPELINE_VERSION)
    p.add_argument("--batch-size", type=int, default=500)
    p.add_argument("--limit", type=int, default=None, help="Optional limit for testing")
    p.add_argument("--force", action="store_true", help="Recompute even if unchanged")
    p.add_argument("--dry-run", action="store_true", help="Compute but do not write to DuckDB")
    p.add_argument("--write-atoms", dest="write_atoms", action="store_true", default=True, help="Write eligibility atoms")
    p.add_argument("--no-write-atoms", dest="write_atoms", action="store_false", help="Disable writing eligibility atoms")
    p.add_argument("--include-tier2", action="store_true", help="Include tier-2 (clinic-only) rules in criteria/questionnaires")
    p.add_argument("--max-questions", type=int, default=15, help="Max questions in main questionnaire (overflow preserved in optional_questions)")
    p.add_argument("--max-clinic-only", type=int, default=5, help="Max clinic-only questions in main questionnaire")
    p.add_argument("--profile-in-main", type=_parse_bool, default=True, help="Include profile questions in main questionnaire")
    p.add_argument("--skip-lints", action="store_true", help="Skip question bank lint checks")
    p.add_argument("--allow-unknown-keys", action="store_true", help="Do not fail the run if unknown question keys are detected")
    args = p.parse_args()

    if not args.skip_lints:
        lint_question_bank_vs_rules()
        lint_template_placeholders()
        lint_answer_type_contract()
        lint_single_select_not_sure()
        lint_priority_guardrails()

    con = connect(args.db)
    ensure_output_tables(con)

    processed = 0
    last_nct_id = None
    remaining_limit = args.limit
    unknown_key_counts: Counter[str] = Counter()
    unknown_trials = 0

    while True:
        batch_limit = args.batch_size
        if remaining_limit is not None:
            batch_limit = min(batch_limit, remaining_limit)
            if batch_limit <= 0:
                break

        trials = fetch_trials_for_questionnaires(
            con,
            pipeline_version=args.pipeline_version,
            limit=batch_limit,
            start_after=last_nct_id,
            force=args.force,
        )
        if not trials:
            break

        criteria_rows = []
        questionnaire_rows = []
        atoms_rows = []

        for t in trials:
            
            if not t.eligibility_text_clean:
                atoms = []
                criteria = []
                stats = {
                    "total_bullets": 0,
                    "covered_bullets": 0,
                    "coverage_ratio": 0.0,
                    "criteria_count": 0,
                    "atom_count": 0,
                    "tier1_count": 0,
                    "tier2_count": 0,
                }
            else:
                atoms, _atom_stats = extract_atoms_from_text(
                    t.eligibility_text_clean,
                    rules=DEFAULT_RULES,
                )
                include_tiers = (1, 2) if args.include_tier2 else (1,)
                criteria, stats = extract_criteria_from_text(
                    t.eligibility_text_clean,
                    include_tiers=include_tiers,
                )

            result = generate_questionnaire(
                t,
                criteria_raw=criteria,
                pipeline_version=args.pipeline_version,
                extraction_stats=stats,
                max_questions=args.max_questions,
                max_clinic_only=args.max_clinic_only,
                profile_in_main=args.profile_in_main,
            )
            metrics = result.questionnaire.get("extraction_metrics", {})
            unknown_keys = metrics.get("unknown_question_keys")
            if isinstance(unknown_keys, list) and unknown_keys:
                unknown_trials += 1
                unknown_key_counts.update(
                    k for k in unknown_keys if isinstance(k, str) and k.strip()
                )

            if not args.dry_run:
                if args.write_atoms:
                    atoms_rows.append(
                        (
                            result.nct_id,
                            result.pipeline_version,
                            result.eligibility_hash,
                            atoms,
                        )
                    )
                criteria_payload = {
                    "criteria": result.criteria,
                    "stats": {
                        "total_bullets": int(stats.get("total_bullets") or 0),
                        "covered_bullets": int(stats.get("covered_bullets") or 0),
                        "coverage_ratio": float(stats.get("coverage_ratio") or 0.0),
                        "criteria_count": int(stats.get("criteria_count") or 0),
                        "atom_count": int(stats.get("atom_count") or 0),
                        "tier1_count": int(stats.get("tier1_count") or 0),
                        "tier2_count": int(stats.get("tier2_count") or 0),
                    },
                }
                criteria_rows.append(
                    [
                        result.nct_id,
                        result.pipeline_version,
                        result.eligibility_hash,
                        json.dumps(criteria_payload, ensure_ascii=False),
                        int(stats.get("total_bullets") or 0),
                        int(stats.get("covered_bullets") or 0),
                        float(stats.get("coverage_ratio") or 0.0),
                        int(stats.get("criteria_count") or 0),
                    ]
                )
                questionnaire_rows.append(
                    [
                        result.nct_id,
                        result.pipeline_version,
                        result.eligibility_hash,
                        json.dumps(result.questionnaire, ensure_ascii=False),
                        int(result.question_count),
                        int(result.clinic_only_count),
                        int(result.quality_score),
                        list(result.quality_flags),
                        result.readiness,
                    ]
                )

            processed += 1
            if processed % 500 == 0:
                print(f"Processed {processed} trials...", file=sys.stderr)

        if not args.dry_run:
            if criteria_rows:
                upsert_criteria_batch(con, rows=criteria_rows)
            if questionnaire_rows:
                upsert_questionnaire_batch(con, rows=questionnaire_rows)
            if args.write_atoms and atoms_rows:
                upsert_atoms_batch(con, rows=atoms_rows)

        last_nct_id = trials[-1].nct_id
        if remaining_limit is not None:
            remaining_limit -= len(trials)

    if not args.dry_run:
        write_eval_snapshot(con, pipeline_version=args.pipeline_version)
        if args.write_atoms:
            atom_count = con.execute(
                """
                SELECT COUNT(*)
                FROM silver.eligibility_atoms
                WHERE pipeline_version = ?;
                """,
                [args.pipeline_version],
            ).fetchone()[0]
            nct_count = con.execute(
                """
                SELECT COUNT(DISTINCT nct_id)
                FROM silver.eligibility_atoms
                WHERE pipeline_version = ?;
                """,
                [args.pipeline_version],
            ).fetchone()[0]
            print(f"Atoms inserted: {atom_count} rows for pipeline_version={args.pipeline_version}")
            print(f"Atoms nct_id coverage: {nct_count} distinct nct_id for pipeline_version={args.pipeline_version}")

    if unknown_trials > 0:
        print(f"Unknown question keys detected in {unknown_trials} trials.", file=sys.stderr)
        for key, count in unknown_key_counts.most_common(20):
            print(f"  {key}: {count}", file=sys.stderr)
        if not args.allow_unknown_keys:
            print("Failing run due to unknown question keys. Use --allow-unknown-keys to override.", file=sys.stderr)
            return 2

    print(f"Done. Processed {processed} trials for pipeline_version={args.pipeline_version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
