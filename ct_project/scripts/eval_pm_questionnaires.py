#!/usr/bin/env python3
"""
Phase 4: evaluation harness for questionnaires.

Prints readiness + score stats and can export Medium/Low samples for manual review.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any, List, Optional

from pmq.dbio import connect


def _fetchone(con, sql: str, params: Optional[List[Any]] = None):
    return con.execute(sql, params or []).fetchone()


def _fetchall(con, sql: str, params: Optional[List[Any]] = None):
    return con.execute(sql, params or []).fetchall()


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--db", required=True, help="Path to aact.duckdb")
    p.add_argument("--pipeline-version", required=True)
    p.add_argument("--export-jsonl", default=None, help="Path to write a sample JSONL for manual review")
    p.add_argument("--sample-size", type=int, default=200)
    args = p.parse_args()

    con = connect(args.db)

    rows = _fetchall(
        con,
        """
        SELECT readiness, COUNT(*) AS n
        FROM gold.pm_questionnaires
        WHERE pipeline_version = ?
        GROUP BY readiness
        ORDER BY n DESC;
        """,
        [args.pipeline_version],
    )
    total = sum(r[1] for r in rows) or 1
    print("Readiness distribution:")
    for readiness, n in rows:
        print(f"  {readiness}: {n} ({n/total*100:.1f}%)")

    stats = _fetchone(
        con,
        """
        SELECT
          MIN(quality_score),
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY quality_score),
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY quality_score),
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY quality_score),
          MAX(quality_score),
          AVG(quality_score)
        FROM gold.pm_questionnaires
        WHERE pipeline_version = ?;
        """,
        [args.pipeline_version],
    )
    print("\nQuality score summary (min, p25, p50, p75, max, avg):")
    print(" ", stats)

    flag_rows = _fetchall(
        con,
        """
        SELECT flag, COUNT(*) AS n
        FROM (
          SELECT UNNEST(quality_flags) AS flag
          FROM gold.pm_questionnaires
          WHERE pipeline_version = ?
        )
        GROUP BY flag
        ORDER BY n DESC
        LIMIT 25;
        """,
        [args.pipeline_version],
    )
    print("\nTop quality flags:")
    for flag, n in flag_rows:
        print(f"  {flag}: {n}")

    unknown_counts: Counter[str] = Counter()
    qjson_rows = _fetchall(
        con,
        """
        SELECT questionnaire_json
        FROM gold.pm_questionnaires
        WHERE pipeline_version = ?;
        """,
        [args.pipeline_version],
    )
    for (qjson,) in qjson_rows:
        if not qjson:
            continue
        data = json.loads(qjson)
        metrics = data.get("extraction_metrics", {})
        unknown = metrics.get("unknown_question_keys")
        if isinstance(unknown, list):
            for key in unknown:
                if isinstance(key, str) and key.strip():
                    unknown_counts[key.strip()] += 1

    if unknown_counts:
        print("\nUnknown question keys (top):")
        for key, n in unknown_counts.most_common(20):
            print(f"  {key}: {n}")

    template_rows = _fetchall(
        con,
        """
        SELECT questionnaire_json
        FROM gold.pm_questionnaires
        WHERE pipeline_version = ?;
        """,
        [args.pipeline_version],
    )
    template_missing_trials = 0
    template_key_counts: Counter[str] = Counter()
    for (qjson,) in template_rows:
        if not qjson:
            continue
        data = json.loads(qjson)
        has_missing = False
        for section in ("questions", "optional_questions"):
            items = data.get(section)
            if not isinstance(items, list):
                continue
            for q in items:
                if not isinstance(q, dict):
                    continue
                if q.get("template_missing_params") is True:
                    key = q.get("question_key")
                    if isinstance(key, str) and key.strip():
                        template_key_counts[key.strip()] += 1
                    has_missing = True
        if has_missing:
            template_missing_trials += 1

    if template_missing_trials:
        print("\nTemplate missing params summary:")
        print(f"  trials_with_template_missing_params: {template_missing_trials}")
        for key, n in template_key_counts.most_common(20):
            print(f"  {key}: {n}")

    drift_rows = _fetchall(
        con,
        """
        SELECT
          pipeline_version,
          SUM(CASE WHEN json_extract(criteria_json, '$.criteria') IS NULL THEN 1 ELSE 0 END) AS legacy_list_rows,
          SUM(CASE WHEN json_extract(criteria_json, '$.criteria') IS NOT NULL THEN 1 ELSE 0 END) AS wrapped_rows
        FROM gold.pm_trial_criteria
        GROUP BY pipeline_version
        ORDER BY pipeline_version;
        """,
    )
    if drift_rows:
        print("\nCriteria JSON shape summary:")
        for pipeline_version, legacy_rows, wrapped_rows in drift_rows:
            print(f"  {pipeline_version}: legacy={legacy_rows}, wrapped={wrapped_rows}")

    if args.export_jsonl:
        out_path = Path(args.export_jsonl)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        sample = _fetchall(
            con,
            """
            SELECT q.nct_id, q.quality_score, q.quality_flags, q.readiness, q.questionnaire_json
            FROM gold.pm_questionnaires q
            WHERE q.pipeline_version = ?
              AND q.readiness IN ('Medium', 'Low')
            ORDER BY RANDOM()
            LIMIT ?;
            """,
            [args.pipeline_version, args.sample_size],
        )

        with out_path.open("w", encoding="utf-8") as f:
            for nct_id, score, flags, readiness, qjson in sample:
                f.write(json.dumps({
                    "nct_id": nct_id,
                    "readiness": readiness,
                    "quality_score": score,
                    "quality_flags": list(flags) if flags else [],
                    "questionnaire": json.loads(qjson) if qjson else None,
                }, ensure_ascii=False) + "\n")

        print(f"\nExported {len(sample)} Medium/Low questionnaires to {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
