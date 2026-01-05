#!/usr/bin/env python3
"""
Audit whether questionnaire question_keys are supported by eligibility text.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import duckdb

from pmq.eligibility_parser import iter_all_bullets
from pmq.rules import DEFAULT_RULES, dedupe_criteria, extract_criteria_from_text


STRUCTURED_ALWAYS_OK = {
    "age_years",
    "sex_at_birth",
    "diagnosis_confirmed",
    "healthy_volunteer",
}


def _has_column(con: duckdb.DuckDBPyConnection, schema: str, table: str, column: str) -> bool:
    row = con.execute(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = ? AND table_name = ? AND column_name = ?
        LIMIT 1;
        """,
        [schema, table, column],
    ).fetchone()
    return row is not None


def _resolve_eligibility_source(con: duckdb.DuckDBPyConnection) -> Tuple[str, str]:
    if _has_column(con, "gold", "pm_questionnaires", "eligibility_text_clean"):
        return ("q.eligibility_text_clean", "")
    if _has_column(con, "silver", "eligibilities", "eligibility_text_clean"):
        return ("e.eligibility_text_clean", "LEFT JOIN silver.eligibilities e USING (nct_id)")
    if _has_column(con, "gold", "pm_trials", "eligibility_text_clean"):
        return ("t.eligibility_text_clean", "LEFT JOIN gold.pm_trials t USING (nct_id)")
    return ("NULL", "")


def _load_json(raw: Any) -> Dict[str, Any]:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="replace")
    if isinstance(raw, str):
        raw = raw.strip()
        if not raw:
            return {}
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _ensure_list(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in value:
        if isinstance(item, dict):
            out.append(item)
    return out


def _coerce_key(value: Any) -> Optional[str]:
    if value is None:
        return None
    key = str(value).strip()
    return key or None


def _normalize_window_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        if value.isdigit():
            try:
                return int(value)
            except ValueError:
                return value
    return value


def _has_evidence_metadata(item: Dict[str, Any]) -> bool:
    for key in ("evidence", "criterion_id", "criterion_ids", "atom_id", "atom_ids"):
        if item.get(key):
            return True
    return False


def _collect_question_data(
    qjson: Dict[str, Any],
) -> Tuple[
    List[Dict[str, Any]],
    List[Dict[str, Any]],
    set,
    set,
    set,
    set,
    set,
    Dict[str, List[Dict[str, Any]]],
    set,
    set,
]:
    questions = _ensure_list(qjson.get("questions"))
    optional_questions = _ensure_list(qjson.get("optional_questions"))
    qkeys_in_questionnaire: set = set()
    qkeys_criteria: set = set()
    qkeys_structured: set = set()
    qkeys_default: set = set()
    qkeys_unknown: set = set()
    qkey_to_questions: Dict[str, List[Dict[str, Any]]] = {}
    criteria_unsupported_qkeys: set = set()
    legacy_unsupported_qkeys: set = set()

    for item in questions + optional_questions:
        key = _coerce_key(item.get("question_key"))
        if not key:
            continue
        qkeys_in_questionnaire.add(key)
        qkey_to_questions.setdefault(key, []).append(item)

        origin = item.get("origin")
        if origin not in ("structured", "criteria", "default_profile"):
            origin = "unknown"
            qkeys_unknown.add(key)
        elif origin == "structured":
            qkeys_structured.add(key)
        elif origin == "criteria":
            qkeys_criteria.add(key)
        elif origin == "default_profile":
            qkeys_default.add(key)

        logic_entries = item.get("logic") if isinstance(item.get("logic"), list) else []
        sources = item.get("sources") if isinstance(item.get("sources"), list) else []
        has_structured_source = any(
            isinstance(src, str) and src.startswith("structured:")
            for src in sources
        )
        if not has_structured_source and not logic_entries:
            legacy_unsupported_qkeys.add(key)
        if origin == "criteria" and not logic_entries and not has_structured_source and not _has_evidence_metadata(item):
            criteria_unsupported_qkeys.add(key)

    return (
        questions,
        optional_questions,
        qkeys_in_questionnaire,
        qkeys_criteria,
        qkeys_structured,
        qkeys_default,
        qkeys_unknown,
        qkey_to_questions,
        criteria_unsupported_qkeys,
        legacy_unsupported_qkeys,
    )


def _window_mismatches(
    criteria: Sequence[Any],
    qkey_to_questions: Dict[str, List[Dict[str, Any]]],
    *,
    allowed_qkeys: Optional[set] = None,
) -> List[str]:
    mismatches: set = set()
    for criterion in criteria:
        params = getattr(criterion, "params", {}) or {}
        if "window_days" not in params:
            continue
        expected = _normalize_window_value(params.get("window_days"))
        key = _coerce_key(getattr(criterion, "question_key", None))
        if not key:
            continue
        if allowed_qkeys is not None and key not in allowed_qkeys:
            continue
        questions = qkey_to_questions.get(key)
        if not questions:
            mismatches.add((key, expected))
            continue
        logic_entries: List[Dict[str, Any]] = []
        for q in questions:
            if isinstance(q.get("logic"), list):
                logic_entries.extend(q.get("logic") or [])
        if not logic_entries:
            mismatches.add((key, expected))
            continue
        matched = False
        for entry in logic_entries:
            if not isinstance(entry, dict):
                continue
            params_entry = entry.get("params")
            if not isinstance(params_entry, dict):
                continue
            window_value = _normalize_window_value(params_entry.get("window_days"))
            if window_value == expected:
                matched = True
                break
        if not matched:
            mismatches.add((key, expected))

    return [f"{key}:{value}" for key, value in sorted(mismatches, key=lambda item: (item[0], str(item[1])))]


def _truncate_text(text: str, limit: int = 500) -> str:
    clean = " ".join(text.split())
    return clean[:limit]


def _write_csv(path: Path, rows: Iterable[Sequence[Any]], header: Sequence[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        for row in rows:
            writer.writerow(row)


def _missing_present_as(
    missing_qkeys: Sequence[str],
    *,
    qkeys_default: set,
    qkeys_structured: set,
    qkeys_unknown: set,
) -> str:
    parts: List[str] = []
    for key in missing_qkeys:
        if key in qkeys_default:
            status = "default_profile"
        elif key in qkeys_structured:
            status = "structured"
        elif key in qkeys_unknown:
            status = "unknown"
        else:
            status = "absent"
        parts.append(f"{key}={status}")
    return "|".join(parts)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--db", required=True, help="Path to aact.duckdb")
    p.add_argument("--pipeline", required=True, help="Pipeline version to audit")
    p.add_argument("--sample", type=int, default=0, help="Write a stratified sample (0 disables)")
    p.add_argument("--limit", type=int, default=None, help="Optional limit on rows for quick runs")
    p.add_argument("--fail-on-thresholds", action="store_true", help="Exit nonzero if thresholds are exceeded")
    p.add_argument("--max-criteria-missing", type=int, default=25)
    p.add_argument("--max-criteria-extra", type=int, default=0)
    p.add_argument("--max-criteria-unsupported", type=int, default=0)
    p.add_argument("--max-window-mismatches", type=int, default=0)
    args = p.parse_args()

    con = duckdb.connect(args.db, read_only=False)
    eligibility_expr, join_clause = _resolve_eligibility_source(con)

    limit_clause = f"LIMIT {int(args.limit)}" if args.limit is not None else ""
    query = f"""
    SELECT q.nct_id, q.questionnaire_json, {eligibility_expr} AS eligibility_text_clean
    FROM gold.pm_questionnaires q
    {join_clause}
    WHERE q.pipeline_version = ?
    ORDER BY q.nct_id
    {limit_clause};
    """

    rows = con.execute(query, [args.pipeline]).fetchall()

    total_rows = 0
    analyzed_rows = 0
    missing_text_rows = 0

    trials_with_extra = 0
    trials_with_missing = 0
    trials_with_unsupported = 0

    total_criteria_extra_count = 0
    total_criteria_missing_count = 0
    total_criteria_unsupported_count = 0
    total_window_mismatches = 0
    total_structured_question_count = 0
    total_default_profile_question_count = 0
    total_criteria_question_count = 0

    criteria_extra_counter: Counter[str] = Counter()
    criteria_missing_counter: Counter[str] = Counter()

    trial_records: List[Dict[str, Any]] = []
    missing_origin_rows = 0

    for nct_id, qjson_raw, eligibility_text in rows:
        total_rows += 1

        qjson = _load_json(qjson_raw)
        (
            questions,
            optional_questions,
            qkeys_in_questionnaire,
            qkeys_criteria,
            qkeys_structured,
            qkeys_default,
            qkeys_unknown,
            qkey_to_questions,
            criteria_unsupported_qkeys,
            legacy_unsupported_qkeys,
        ) = _collect_question_data(qjson)

        missing_origin_row = len(qkeys_unknown) > 0
        if missing_origin_row:
            missing_origin_rows += 1

        eligibility_text_clean = ""
        if eligibility_text is not None:
            if isinstance(eligibility_text, bytes):
                eligibility_text_clean = eligibility_text.decode("utf-8", errors="replace")
            else:
                eligibility_text_clean = str(eligibility_text)
        has_text = bool(eligibility_text_clean.strip())

        bullet_count = 0
        extracted_count = 0
        extra_qkeys: List[str] = []
        missing_qkeys: List[str] = []
        window_mismatches: List[str] = []
        unsupported_qkeys: List[str] = []
        missing_present_as = ""

        if missing_origin_row:
            structured_question_count = len(qkeys_in_questionnaire & STRUCTURED_ALWAYS_OK)
            criteria_question_count = len(qkeys_in_questionnaire - STRUCTURED_ALWAYS_OK)
            default_profile_question_count = 0
        else:
            structured_question_count = len(qkeys_structured)
            criteria_question_count = len(qkeys_criteria)
            default_profile_question_count = len(qkeys_default)

        total_structured_question_count += structured_question_count
        total_default_profile_question_count += default_profile_question_count
        total_criteria_question_count += criteria_question_count

        if not has_text:
            missing_text_rows += 1
        else:
            analyzed_rows += 1
            bullet_count = len(iter_all_bullets(eligibility_text_clean))

            extracted, _stats = extract_criteria_from_text(eligibility_text_clean, rules=DEFAULT_RULES)
            deduped = dedupe_criteria(extracted)
            extracted_count = len(deduped)

            qkeys_extracted = {c.question_key for c in deduped if getattr(c, "question_key", None)}

            if missing_origin_row:
                extra_qkeys = sorted(qkeys_in_questionnaire - qkeys_extracted - STRUCTURED_ALWAYS_OK)
                missing_qkeys = sorted(qkeys_extracted - qkeys_in_questionnaire)
                unsupported_qkeys = sorted(legacy_unsupported_qkeys)
                window_mismatches = _window_mismatches(deduped, qkey_to_questions)
            else:
                extra_qkeys = sorted(qkeys_criteria - qkeys_extracted)
                missing_qkeys = sorted(qkeys_extracted - qkeys_criteria)
                unsupported_qkeys = sorted(criteria_unsupported_qkeys)
                window_mismatches = _window_mismatches(
                    deduped,
                    qkey_to_questions,
                    allowed_qkeys=qkeys_criteria,
                )

            missing_present_as = _missing_present_as(
                missing_qkeys,
                qkeys_default=qkeys_default,
                qkeys_structured=qkeys_structured,
                qkeys_unknown=qkeys_unknown,
            )

            criteria_extra_count = len(extra_qkeys)
            criteria_missing_count = len(missing_qkeys)
            criteria_unsupported_count = len(unsupported_qkeys)

            if criteria_extra_count > 0:
                trials_with_extra += 1
            if criteria_missing_count > 0:
                trials_with_missing += 1
            if criteria_unsupported_count > 0:
                trials_with_unsupported += 1

            total_criteria_extra_count += criteria_extra_count
            total_criteria_missing_count += criteria_missing_count
            total_criteria_unsupported_count += criteria_unsupported_count

            for key in extra_qkeys:
                criteria_extra_counter[key] += 1
            for key in missing_qkeys:
                criteria_missing_counter[key] += 1

            total_window_mismatches += len(window_mismatches)
        record = {
            "nct_id": nct_id,
            "bullet_count": bullet_count,
            "extracted_count": extracted_count,
            "questionnaire_question_count": len(questions),
            "questionnaire_optional_count": len(optional_questions),
            "criteria_question_count": criteria_question_count,
            "structured_question_count": structured_question_count,
            "default_profile_question_count": default_profile_question_count,
            "criteria_extra_count": len(extra_qkeys),
            "criteria_missing_count": len(missing_qkeys),
            "window_mismatch_count": len(window_mismatches),
            "criteria_unsupported_count": len(unsupported_qkeys),
            "extra_qkeys": extra_qkeys,
            "missing_qkeys": missing_qkeys,
            "missing_present_as": missing_present_as,
            "window_mismatches": window_mismatches,
            "unsupported_qkeys": unsupported_qkeys,
            "eligibility_text_clean": eligibility_text_clean,
        }
        trial_records.append(record)

    def _pct(numer: int, denom: int) -> float:
        return (numer / denom * 100.0) if denom else 0.0

    def _top_counts(counter: Counter[str], limit: int) -> List[Dict[str, int]]:
        items = sorted(counter.items(), key=lambda item: (-item[1], item[0]))
        return [{"question_key": key, "count": count} for key, count in items[:limit]]

    thresholds = {
        "max_criteria_missing": args.max_criteria_missing,
        "max_criteria_extra": args.max_criteria_extra,
        "max_criteria_unsupported": args.max_criteria_unsupported,
        "max_window_mismatches": args.max_window_mismatches,
    }

    violations: List[str] = []
    if total_criteria_extra_count > args.max_criteria_extra:
        violations.append(
            f"total_criteria_extra_count={total_criteria_extra_count} > max_criteria_extra={args.max_criteria_extra}"
        )
    if total_criteria_missing_count > args.max_criteria_missing:
        violations.append(
            f"total_criteria_missing_count={total_criteria_missing_count} > max_criteria_missing={args.max_criteria_missing}"
        )
    if total_criteria_unsupported_count > args.max_criteria_unsupported:
        violations.append(
            "total_criteria_unsupported_count="
            f"{total_criteria_unsupported_count} > max_criteria_unsupported={args.max_criteria_unsupported}"
        )
    if total_window_mismatches > args.max_window_mismatches:
        violations.append(
            f"total_window_mismatches={total_window_mismatches} > max_window_mismatches={args.max_window_mismatches}"
        )
    if missing_origin_rows > 0:
        violations.append(f"origin_missing_rows={missing_origin_rows} > 0")

    passed = len(violations) == 0

    summary = {
        "total_rows": total_rows,
        "analyzed_rows": analyzed_rows,
        "missing_text_rows": missing_text_rows,
        "origin_missing_rows": missing_origin_rows,
        "pct_trials_with_any_criteria_extra": _pct(trials_with_extra, analyzed_rows),
        "pct_trials_with_any_criteria_missing": _pct(trials_with_missing, analyzed_rows),
        "pct_trials_with_any_criteria_unsupported": _pct(trials_with_unsupported, analyzed_rows),
        "total_trials_with_any_criteria_extra": trials_with_extra,
        "total_trials_with_any_criteria_missing": trials_with_missing,
        "total_trials_with_any_criteria_unsupported": trials_with_unsupported,
        "total_criteria_extra_count": total_criteria_extra_count,
        "total_criteria_missing_count": total_criteria_missing_count,
        "total_criteria_unsupported_count": total_criteria_unsupported_count,
        "total_window_mismatches": total_window_mismatches,
        "total_structured_question_count": total_structured_question_count,
        "total_default_profile_question_count": total_default_profile_question_count,
        "total_criteria_question_count": total_criteria_question_count,
        "top_20_extra_qkeys": _top_counts(criteria_extra_counter, 20),
        "top_20_missing_qkeys": _top_counts(criteria_missing_counter, 20),
        "thresholds": thresholds,
        "passed": passed,
    }

    out_dir = Path("audit_outputs")
    out_dir.mkdir(parents=True, exist_ok=True)

    summary_path = out_dir / "accuracy_summary.json"
    with summary_path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, sort_keys=True, ensure_ascii=True)

    trial_report_path = out_dir / "trial_level_report.csv"
    trial_rows = []
    for record in trial_records:
        trial_rows.append([
            record["nct_id"],
            record["bullet_count"],
            record["extracted_count"],
            record["questionnaire_question_count"],
            record["questionnaire_optional_count"],
            record["criteria_question_count"],
            record["structured_question_count"],
            record["default_profile_question_count"],
            record["criteria_extra_count"],
            record["criteria_missing_count"],
            record["window_mismatch_count"],
            record["criteria_unsupported_count"],
            "|".join(record["extra_qkeys"]),
            "|".join(record["missing_qkeys"]),
            record["missing_present_as"],
            "|".join(record["window_mismatches"]),
        ])
    _write_csv(
        trial_report_path,
        trial_rows,
        [
            "nct_id",
            "bullet_count",
            "extracted_count",
            "questionnaire_question_count",
            "questionnaire_optional_count",
            "criteria_question_count",
            "structured_question_count",
            "default_profile_question_count",
            "criteria_extra_count",
            "criteria_missing_count",
            "window_mismatch_count",
            "criteria_unsupported_count",
            "extra_qkeys",
            "missing_qkeys",
            "missing_present_as",
            "window_mismatches",
        ],
    )

    worst_cases_path = out_dir / "worst_cases.csv"
    worst_sorted = sorted(
        trial_records,
        key=lambda r: (
            -r["criteria_unsupported_count"],
            -r["criteria_extra_count"],
            -r["criteria_missing_count"],
            -r["window_mismatch_count"],
            -r["bullet_count"],
            str(r["nct_id"]),
        ),
    )
    worst_rows = []
    for record in worst_sorted[:200]:
        worst_rows.append([
            record["nct_id"],
            record["bullet_count"],
            record["extracted_count"],
            record["questionnaire_question_count"],
            record["questionnaire_optional_count"],
            record["criteria_question_count"],
            record["structured_question_count"],
            record["default_profile_question_count"],
            record["criteria_extra_count"],
            record["criteria_missing_count"],
            record["window_mismatch_count"],
            record["criteria_unsupported_count"],
            "|".join(record["extra_qkeys"]),
            "|".join(record["missing_qkeys"]),
            record["missing_present_as"],
            "|".join(record["window_mismatches"]),
        ])
    _write_csv(
        worst_cases_path,
        worst_rows,
        [
            "nct_id",
            "bullet_count",
            "extracted_count",
            "questionnaire_question_count",
            "questionnaire_optional_count",
            "criteria_question_count",
            "structured_question_count",
            "default_profile_question_count",
            "criteria_extra_count",
            "criteria_missing_count",
            "window_mismatch_count",
            "criteria_unsupported_count",
            "extra_qkeys",
            "missing_qkeys",
            "missing_present_as",
            "window_mismatches",
        ],
    )

    sample_path = None
    if args.sample and args.sample > 0:
        target = int(args.sample)
        missing_n = target // 3
        extra_n = target // 3
        unsupported_n = target // 3
        remaining = target - (missing_n + extra_n + unsupported_n)

        selected: List[Dict[str, Any]] = []
        selected_ids: set = set()

        def _take(sorted_records: List[Dict[str, Any]], count: int) -> None:
            for rec in sorted_records:
                if rec["nct_id"] in selected_ids:
                    continue
                if len(selected) >= target or count <= 0:
                    break
                selected.append(rec)
                selected_ids.add(rec["nct_id"])
                count -= 1

        def _sorted_by(key: str) -> List[Dict[str, Any]]:
            return sorted(
                trial_records,
                key=lambda r: (-r[key], -r["bullet_count"], str(r["nct_id"])),
            )

        _take(_sorted_by("criteria_missing_count"), missing_n)
        _take(_sorted_by("criteria_extra_count"), extra_n)
        _take(_sorted_by("criteria_unsupported_count"), unsupported_n)
        if remaining > 0:
            _take(_sorted_by("bullet_count"), remaining)

        sample_rows = []
        for rec in selected:
            sample_rows.append([
                rec["nct_id"],
                _truncate_text(rec["eligibility_text_clean"]) if rec["eligibility_text_clean"] else "",
                "|".join(rec["extra_qkeys"]),
                "|".join(rec["missing_qkeys"]),
                rec["missing_present_as"],
                "|".join(rec["unsupported_qkeys"]),
                "|".join(rec["window_mismatches"]),
            ])

        sample_path = out_dir / "sample_cases.csv"
        _write_csv(
            sample_path,
            sample_rows,
            [
                "nct_id",
                "eligibility_text_clean",
                "extra_qkeys",
                "missing_qkeys",
                "missing_present_as",
                "unsupported_qkeys",
                "window_mismatches",
            ],
        )

    print("Questionnaire accuracy audit complete.")
    print(f"  total_rows: {total_rows}")
    print(f"  analyzed_rows: {analyzed_rows}")
    print(f"  missing_text_rows: {missing_text_rows}")
    if missing_origin_rows > 0:
        print(
            "  warning: missing question origins detected in "
            f"{missing_origin_rows} rows; metrics may be inflated by default questions."
        )
    print(f"  pct_trials_with_any_criteria_extra: {summary['pct_trials_with_any_criteria_extra']:.2f}")
    print(f"  pct_trials_with_any_criteria_missing: {summary['pct_trials_with_any_criteria_missing']:.2f}")
    print(f"  pct_trials_with_any_criteria_unsupported: {summary['pct_trials_with_any_criteria_unsupported']:.2f}")
    print(f"  total_criteria_extra_count: {total_criteria_extra_count}")
    print(f"  total_criteria_missing_count: {total_criteria_missing_count}")
    print(f"  total_criteria_unsupported_count: {total_criteria_unsupported_count}")
    print(f"  total_window_mismatches: {total_window_mismatches}")
    print(f"  wrote: {summary_path}")
    print(f"  wrote: {trial_report_path}")
    print(f"  wrote: {worst_cases_path}")
    if sample_path:
        print(f"  wrote: {sample_path}")

    if args.fail_on_thresholds:
        if passed:
            print("PASSED thresholds.")
        else:
            print("FAIL thresholds:")
            for item in violations:
                print(f"  - {item}")
            return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
