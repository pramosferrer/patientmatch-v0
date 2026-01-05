#!/usr/bin/env python3
"""
Audit questionnaire logic correctness for a given pipeline version.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import duckdb


PREGNANCY_KEYS = {"pregnant", "breastfeeding", "willing_contraception", "pregnancy_test_ok"}
CORE_KEYS = ["age_years", "sex_at_birth", "diagnosis_confirmed"]


def _norm_gender(gender: Optional[str]) -> Optional[str]:
    if gender is None:
        return None
    g = gender.strip().lower()
    if g in ("male", "m"):
        return "MALE"
    if g in ("female", "f"):
        return "FEMALE"
    if g in ("all", "any"):
        return "ALL"
    return None


def _extract_items(items: Any) -> List[Tuple[str, bool, bool]]:
    out: List[Tuple[str, bool, bool]] = []
    if not isinstance(items, list):
        return out
    for q in items:
        if not isinstance(q, dict):
            continue
        key = str(q.get("question_key") or "").strip()
        if not key:
            continue
        required = bool(q.get("required"))
        clinic_only = bool(q.get("clinic_only"))
        out.append((key, required, clinic_only))
    return out


def _question_keys_sequence(items: Sequence[Tuple[str, bool, bool]]) -> str:
    return "|".join(k for k, _, _ in items)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--db", required=True, help="Path to aact.duckdb")
    p.add_argument("--pipeline-version", required=True)
    p.add_argument("--out-csv", default=None)
    args = p.parse_args()

    out_csv = args.out_csv
    if out_csv is None:
        out_csv = f"reports/questionnaire_audit_{args.pipeline_version}.csv"

    con = duckdb.connect(args.db, read_only=False)

    rows = con.execute(
        """
        SELECT q.nct_id, q.questionnaire_json, e.gender
        FROM gold.pm_questionnaires q
        LEFT JOIN silver.eligibilities e USING (nct_id)
        WHERE q.pipeline_version = ?;
        """,
        [args.pipeline_version],
    ).fetchall()

    issue_counts: Counter[str] = Counter()
    violations: List[Tuple[str, str, str]] = []

    gender_totals = Counter()
    gender_pregnancy = Counter()

    for nct_id, qjson, gender in rows:
        if not qjson:
            continue
        data = json.loads(qjson)
        questions = _extract_items(data.get("questions"))
        optional_questions = _extract_items(data.get("optional_questions"))

        main_keys = [k for k, _, _ in questions]
        optional_keys = [k for k, _, _ in optional_questions]

        gender_norm = _norm_gender(gender)
        if gender_norm:
            gender_totals[gender_norm] += 1
        pregnancy_present = any(k in PREGNANCY_KEYS for k in main_keys + optional_keys)
        if pregnancy_present and gender_norm:
            gender_pregnancy[gender_norm] += 1

        if gender_norm == "MALE" and pregnancy_present:
            issue = "pregnancy_questions_for_male"
            issue_counts[issue] += 1
            violations.append((nct_id, issue, _question_keys_sequence(questions)))

        # Ordering check
        if len(main_keys) < 3 or main_keys[:3] != CORE_KEYS:
            issue = "core_order"
            issue_counts[issue] += 1
            violations.append((nct_id, issue, _question_keys_sequence(questions)))

        # Core requiredness check
        key_map = {k: required for k, required, _ in questions}
        missing_or_not_required = [k for k in CORE_KEYS if not key_map.get(k, False)]
        if missing_or_not_required:
            issue = "core_required_missing"
            issue_counts[issue] += 1
            violations.append((nct_id, issue, _question_keys_sequence(questions)))

        # Clinic-only required check
        clinic_required = [k for k, required, clinic_only in questions + optional_questions if clinic_only and required]
        if clinic_required:
            issue = "clinic_only_required:" + ",".join(sorted(clinic_required))
            issue_counts["clinic_only_required"] += 1
            violations.append((nct_id, issue, _question_keys_sequence(questions)))

        # Optional questions included in main list
        overlap = sorted(set(main_keys) & set(optional_keys))
        if overlap:
            issue = "optional_in_main:" + ",".join(overlap)
            issue_counts["optional_in_main"] += 1
            violations.append((nct_id, issue, _question_keys_sequence(questions)))

    out_path = Path(out_csv)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["nct_id", "issue", "question_keys"])
        for row in violations:
            writer.writerow(row)

    print("Pregnancy question counts by gender:")
    for label in ("MALE", "FEMALE", "ALL"):
        total = gender_totals.get(label, 0)
        with_preg = gender_pregnancy.get(label, 0)
        print(f"  {label}: {with_preg} / {total}")

    print("\nViolation summary:")
    for issue, count in issue_counts.most_common():
        print(f"  {issue}: {count}")

    print(f"\nWrote CSV to {out_path}")
    if issue_counts.get("pregnancy_questions_for_male", 0) > 0:
        print("\nERROR: pregnancy questions found for male-only trials.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
