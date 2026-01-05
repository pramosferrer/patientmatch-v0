#!/usr/bin/env python3
"""
Audit gold trials condition coverage and location readiness.

Reads from DuckDB only; does not modify any tables.
"""

from __future__ import annotations

import argparse
import ast
import difflib
import json
import os
import re
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

try:
    import duckdb  # type: ignore
except Exception as exc:  # pragma: no cover - dependency guard
    raise RuntimeError("Missing dependency: duckdb. Install with: pip install duckdb") from exc


CONDITIONS = [
    "Long COVID",
    "Fibromyalgia",
    "Hidradenitis Suppurativa",
    "Obesity",
    "Overweight",
    "Ulcerative Colitis",
    "Alzheimer's Disease",
    "Type 1 Diabetes",
    "Type 2 Diabetes",
    "Parkinson's Disease",
    "Atopic Dermatitis",
    "COPD",
    "Rheumatoid Arthritis",
    "MASLD/MASH",
    "NAFLD",
    "NASH",
    "Anxiety",
    "Psoriasis",
    "Migraine",
]


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _fuzzy_key(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _parse_conditions(value: object) -> List[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(v).strip() for v in value if v is not None and str(v).strip()]
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return []
        if raw.startswith("[") and raw.endswith("]"):
            for loader in (json.loads, ast.literal_eval):
                try:
                    parsed = loader(raw)
                except Exception:
                    parsed = None
                if isinstance(parsed, list):
                    return [str(v).strip() for v in parsed if v is not None and str(v).strip()]
        if raw.startswith("{") and raw.endswith("}"):
            inner = raw[1:-1].strip()
            if inner:
                parts = [p.strip().strip('"') for p in inner.split(",")]
                return [p for p in parts if p]
        return [raw]
    return [str(value).strip()] if str(value).strip() else []


def _table_exists(con: "duckdb.DuckDBPyConnection", schema: str, table: str) -> bool:
    q = """
    SELECT count(*)
    FROM information_schema.tables
    WHERE table_schema = ? AND table_name = ?
    """
    return con.execute(q, [schema, table]).fetchone()[0] > 0


def _get_columns(
    con: "duckdb.DuckDBPyConnection", schema: str, table: str
) -> Dict[str, str]:
    q = """
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = ? AND table_name = ?
    """
    rows = con.execute(q, [schema, table]).fetchall()
    return {str(name).lower(): str(dtype) for name, dtype in rows}


def _pick_trials_table(
    con: "duckdb.DuckDBPyConnection",
) -> Tuple[str, Dict[str, str], str]:
    q = """
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'gold'
    """
    rows = con.execute(q).fetchall()
    candidates: List[Tuple[int, str, Dict[str, str], str]] = []
    for table_name, table_type in rows:
        name = str(table_name).lower()
        cols = _get_columns(con, "gold", name)
        if "nct_id" not in cols:
            continue
        cond_cols = [col for col in cols if "condition" in col]
        if not cond_cols:
            continue
        score = 0
        if name == "pm_trials":
            score += 100
        if name == "pm_trials_serving":
            score += 90
        if "trial" in name:
            score += 10
        if "conditions_display" in cols:
            score += 5
        candidates.append((score, name, cols, str(table_type)))

    if not candidates:
        raise RuntimeError("No gold table found with nct_id and condition columns.")

    candidates.sort(key=lambda item: item[0], reverse=True)
    _, table_name, columns, table_type = candidates[0]
    return table_name, columns, table_type


def _pick_column(columns: Dict[str, str], preferred: Sequence[str]) -> Optional[str]:
    for col in preferred:
        if col in columns:
            return col
    return None


def _get_us_trials(con: "duckdb.DuckDBPyConnection") -> Optional[Set[str]]:
    if not _table_exists(con, "gold", "pm_site_summary"):
        return None
    rows = con.execute(
        "SELECT nct_id FROM gold.pm_site_summary WHERE coalesce(site_count_us, 0) > 0"
    ).fetchall()
    return {str(r[0]) for r in rows}


def _get_trials_with_coords(con: "duckdb.DuckDBPyConnection") -> Optional[Set[str]]:
    if not _table_exists(con, "gold", "pm_trial_sites"):
        return None
    rows = con.execute(
        """
        SELECT DISTINCT nct_id
        FROM gold.pm_trial_sites
        WHERE lat IS NOT NULL AND lon IS NOT NULL
        """
    ).fetchall()
    return {str(r[0]) for r in rows}


def _collect_trials(
    con: "duckdb.DuckDBPyConnection",
    table_name: str,
    cond_col: str,
    status_col: Optional[str],
    site_count_col: Optional[str],
) -> Tuple[List[Dict[str, object]], Set[str]]:
    select_cols = [
        "nct_id",
        f"{cond_col} AS conditions_value",
        f"{status_col} AS status_value" if status_col else "NULL AS status_value",
        f"{site_count_col} AS site_count_us" if site_count_col else "NULL AS site_count_us",
    ]
    q = f"SELECT {', '.join(select_cols)} FROM gold.{table_name}"
    rows = con.execute(q).fetchall()

    trials: List[Dict[str, object]] = []
    all_conditions: Set[str] = set()
    for nct_id, conditions_value, status_value, site_count_us in rows:
        cond_list = _parse_conditions(conditions_value)
        for item in cond_list:
            all_conditions.add(item)
        trials.append(
            {
                "nct_id": str(nct_id),
                "conditions": cond_list,
                "status": str(status_value) if status_value is not None else None,
                "site_count_us": site_count_us,
            }
        )
    return trials, all_conditions


def _is_recruiting(status_value: Optional[str]) -> bool:
    if not status_value:
        return False
    return _normalize_text(status_value) == "recruiting"


def _format_ratio(numer: int, denom: int) -> str:
    if denom == 0:
        return "n/a"
    pct = 100.0 * numer / denom
    return f"{pct:.1f}% ({numer}/{denom})"


def _top_fuzzy_matches(target: str, candidates: Iterable[str], limit: int = 20) -> List[Tuple[str, float]]:
    target_key = _fuzzy_key(target)
    scored: List[Tuple[str, float]] = []
    for candidate in candidates:
        cand_key = _fuzzy_key(candidate)
        if not cand_key:
            continue
        score = difflib.SequenceMatcher(None, target_key, cand_key).ratio()
        scored.append((candidate, score))
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[:limit]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Audit gold condition coverage and location readiness."
    )
    default_db = os.getenv(
        "DUCKDB_PATH",
        os.path.join(os.path.dirname(__file__), "..", "db", "aact.duckdb"),
    )
    parser.add_argument("--db", default=default_db, help="Path to DuckDB file")
    parser.add_argument(
        "--table",
        default=None,
        help="Override gold table name (optional)",
    )
    parser.add_argument(
        "--conditions-col",
        default=None,
        help="Override conditions column name (optional)",
    )
    args = parser.parse_args()

    con = duckdb.connect(args.db, read_only=True)

    if args.table:
        table_name = args.table.lower()
        if not _table_exists(con, "gold", table_name):
            raise RuntimeError(f"Gold table not found: gold.{table_name}")
        columns = _get_columns(con, "gold", table_name)
        table_type = "override"
    else:
        table_name, columns, table_type = _pick_trials_table(con)

    cond_col = args.conditions_col.lower() if args.conditions_col else None
    if cond_col and cond_col not in columns:
        raise RuntimeError(
            f"Conditions column not found in gold.{table_name}: {cond_col}"
        )
    if not cond_col:
        cond_col = _pick_column(
            columns,
            [
                "conditions_display",
                "condition_display",
                "conditions",
                "condition_slugs",
                "condition",
            ],
        )
    if not cond_col:
        raise RuntimeError(f"No conditions column found in gold.{table_name}")

    status_col = _pick_column(
        columns,
        [
            "status_norm",
            "status",
            "overall_status_raw",
            "overall_status",
        ],
    )
    site_count_col = _pick_column(columns, ["site_count_us"])

    trials, all_conditions = _collect_trials(
        con, table_name, cond_col, status_col, site_count_col
    )

    us_trials = _get_us_trials(con)
    trials_with_coords = _get_trials_with_coords(con)

    print(f"DB_PATH: {args.db}")
    print(f"Gold table: gold.{table_name} ({table_type})")
    print(f"Conditions column: {cond_col} ({columns.get(cond_col, 'unknown')})")
    print(f"Status column: {status_col or 'none'}")
    if us_trials is None and site_count_col is None:
        print("US filter: unavailable (no pm_site_summary or site_count_us column)")
    else:
        print("US filter: site_count_us > 0")
    if trials_with_coords is None:
        print("Location readiness: unavailable (gold.pm_trial_sites not found)")
    else:
        print("Location readiness: gold.pm_trial_sites lat/lon")
    print("")

    for condition in CONDITIONS:
        target_norm = _normalize_text(condition)
        any_status_ids: List[str] = []
        recruiting_ids: List[str] = []
        ready_ids: List[str] = []

        for trial in trials:
            conditions_list = trial["conditions"]
            if not conditions_list:
                continue
            cond_norms = {_normalize_text(item) for item in conditions_list}
            if target_norm not in cond_norms:
                continue

            nct_id = trial["nct_id"]
            site_count_us = trial["site_count_us"]

            if us_trials is not None:
                if nct_id not in us_trials:
                    continue
            elif site_count_col is not None:
                if site_count_us is None or int(site_count_us) <= 0:
                    continue

            any_status_ids.append(nct_id)

            if trials_with_coords is not None and nct_id in trials_with_coords:
                ready_ids.append(nct_id)

            if status_col and _is_recruiting(trial["status"]):
                recruiting_ids.append(nct_id)

        any_count = len(any_status_ids)
        recruiting_count = len(recruiting_ids) if status_col else None
        readiness = (
            _format_ratio(len(ready_ids), any_count)
            if trials_with_coords is not None
            else "n/a"
        )

        print(f"=== {condition} ===")
        if recruiting_count is None:
            print("US + Recruiting count: n/a (status column not found)")
        else:
            print(f"US + Recruiting count: {recruiting_count}")
        print(f"US + Any status count: {any_count}")
        print(f"Location readiness (US + Any status): {readiness}")

        examples = (recruiting_ids[:5] if status_col else []) or any_status_ids[:5]
        if examples:
            print("Example nct_ids: " + ", ".join(examples))
        else:
            print("Example nct_ids: none")

        if any_count == 0:
            matches = _top_fuzzy_matches(condition, all_conditions, limit=20)
            if matches:
                print("Top 20 closest condition strings:")
                for label, score in matches:
                    print(f"- {label} (score {score:.2f})")
        print("")


if __name__ == "__main__":
    main()
