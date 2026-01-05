"""
DuckDB I/O for questionnaire generation.

Outputs:
- gold.pm_trial_criteria
- gold.pm_questionnaires
- gold.pm_trial_insights
- silver.eligibility_atoms
- eval.pm_questionnaire_eval
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Sequence

try:
    import duckdb  # type: ignore
except Exception as e:
    raise RuntimeError("Missing dependency: duckdb. Install with: pip install duckdb") from e

from pmq.generator import TrialRow
if TYPE_CHECKING:
    from pmq.atoms import EligibilityAtom


def connect(db_path: str) -> "duckdb.DuckDBPyConnection":
    con = duckdb.connect(database=db_path, read_only=False)
    con.execute("PRAGMA threads=4;")
    return con


def ensure_output_tables(con: "duckdb.DuckDBPyConnection") -> None:
    con.execute("CREATE SCHEMA IF NOT EXISTS gold;")
    con.execute("CREATE SCHEMA IF NOT EXISTS silver;")
    con.execute("CREATE SCHEMA IF NOT EXISTS eval;")

    con.execute(
        """
        CREATE TABLE IF NOT EXISTS gold.pm_trial_criteria (
            nct_id VARCHAR,
            pipeline_version VARCHAR,
            eligibility_hash VARCHAR,
            criteria_json VARCHAR,
            total_bullets INTEGER,
            covered_bullets INTEGER,
            coverage_ratio DOUBLE,
            criteria_count INTEGER,
            extracted_at TIMESTAMP,
            PRIMARY KEY (nct_id, pipeline_version)
        );
        """
    )
    con.execute(
        """
        CREATE OR REPLACE VIEW gold.pm_trial_criteria_norm AS
        SELECT
            nct_id,
            pipeline_version,
            eligibility_hash,
            COALESCE(json_extract(criteria_json, '$.criteria'), criteria_json) AS criteria_list_json,
            json_extract(criteria_json, '$.stats') AS criteria_stats_json,
            total_bullets,
            covered_bullets,
            coverage_ratio,
            criteria_count,
            extracted_at
        FROM gold.pm_trial_criteria;
        """
    )

    con.execute(
        """
        CREATE TABLE IF NOT EXISTS gold.pm_questionnaires (
            nct_id VARCHAR,
            pipeline_version VARCHAR,
            eligibility_hash VARCHAR,
            questionnaire_json VARCHAR,
            question_count INTEGER,
            clinic_only_count INTEGER,
            quality_score INTEGER,
            quality_flags VARCHAR[],
            readiness VARCHAR,
            generated_at TIMESTAMP,
            PRIMARY KEY (nct_id, pipeline_version)
        );
        """
    )

    con.execute(
        """
        CREATE TABLE IF NOT EXISTS silver.eligibility_atoms (
            nct_id TEXT,
            pipeline_version TEXT,
            eligibility_hash TEXT,
            atom_id TEXT,
            question_key TEXT,
            kind TEXT,
            section TEXT,
            params_json TEXT,
            clinic_only BOOLEAN,
            tier INTEGER,
            rule_id TEXT,
            evidence TEXT,
            created_at TIMESTAMP,
            PRIMARY KEY (nct_id, pipeline_version, atom_id)
        );
        """
    )
    try:
        con.execute("ALTER TABLE silver.eligibility_atoms ADD COLUMN tier INTEGER;")
    except Exception:
        pass
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS gold.pm_trial_insights (
            nct_id TEXT,
            pipeline_version TEXT,
            input_hash TEXT,
            strictness_score INTEGER,
            burden_score INTEGER,
            novelty_score INTEGER,
            logistics_score INTEGER,
            eligibility_text_len INTEGER,
            bullet_count INTEGER,
            bullet_count_primary INTEGER,
            bullet_count_fallback INTEGER,
            top_disqualifiers_json TEXT,
            insights_flags_json TEXT,
            generated_at TIMESTAMP,
            PRIMARY KEY (nct_id, pipeline_version)
        );
        """
    )
    for column_name in ("eligibility_text_len", "bullet_count", "bullet_count_primary", "bullet_count_fallback"):
        try:
            con.execute(f"ALTER TABLE gold.pm_trial_insights ADD COLUMN {column_name} INTEGER;")
        except Exception:
            pass
    try:
        con.execute(
            """
            CREATE INDEX IF NOT EXISTS eligibility_atoms_pipeline_idx
            ON silver.eligibility_atoms (pipeline_version);
            """
        )
    except Exception:
        pass


def fetch_trials_for_questionnaires(
    con: "duckdb.DuckDBPyConnection",
    *,
    pipeline_version: str,
    limit: Optional[int] = None,
    start_after: Optional[str] = None,
    force: bool = False,
) -> List[TrialRow]:
    where_terms: List[str] = []
    params: List[Any] = []
    if not force:
        where_terms.append("q.nct_id IS NULL")
    if start_after is not None:
        where_terms.append("j.nct_id > ?")
        params.append(start_after)

    where_clause = f"WHERE {' AND '.join(where_terms)}" if where_terms else ""
    limit_clause = f"LIMIT {int(limit)}" if limit is not None else ""

    sql = f"""
    WITH input AS (
        SELECT
            t.nct_id,
            COALESCE(t.brief_title, t.official_title, '') AS title,
            t.phase,
            t.gender,
            t.min_age_years,
            t.max_age_years,
            t.healthy_volunteers,
            t.conditions_display,
            t.condition_slugs,
            t.eligibility_hash,
            t.eligibility_text_clean
        FROM gold.pm_trials t
    ),
    elig AS (
        SELECT
            nct_id,
            adult,
            child,
            older_adult
        FROM silver.eligibilities
    ),
    joined AS (
        SELECT
            i.*,
            e.adult,
            e.child,
            e.older_adult
        FROM input i
        LEFT JOIN elig e USING (nct_id)
    )
    SELECT
        j.*,
        q.nct_id AS processed_nct_id
    FROM joined j
    LEFT JOIN gold.pm_questionnaires q
      ON q.nct_id = j.nct_id
     AND q.pipeline_version = '{pipeline_version}'
     AND q.eligibility_hash = j.eligibility_hash
    {where_clause}
    ORDER BY j.nct_id
    {limit_clause}
    ;
    """

    rows = con.execute(sql, params).fetchall()
    out: List[TrialRow] = []
    for r in rows:
        (
            nct_id,
            title,
            phase,
            gender,
            min_age_years,
            max_age_years,
            healthy_volunteers,
            conditions_display,
            condition_slugs,
            eligibility_hash,
            eligibility_text_clean,
            adult,
            child,
            older_adult,
            _processed_nct_id,
        ) = r

        cd = list(conditions_display) if conditions_display is not None else []
        cs = list(condition_slugs) if condition_slugs is not None else []

        out.append(
            TrialRow(
                nct_id=str(nct_id),
                title=str(title or ""),
                phase=str(phase) if phase is not None else None,
                gender=str(gender) if gender is not None else None,
                min_age_years=float(min_age_years) if min_age_years is not None else None,
                max_age_years=float(max_age_years) if max_age_years is not None else None,
                healthy_volunteers=bool(healthy_volunteers) if healthy_volunteers is not None else None,
                conditions_display=cd,
                condition_slugs=cs,
                eligibility_hash=str(eligibility_hash) if eligibility_hash is not None else None,
                eligibility_text_clean=str(eligibility_text_clean) if eligibility_text_clean is not None else None,
                adult=bool(adult) if adult is not None else None,
                child=bool(child) if child is not None else None,
                older_adult=bool(older_adult) if older_adult is not None else None,
            )
        )
    return out


def upsert_criteria(
    con: "duckdb.DuckDBPyConnection",
    *,
    nct_id: str,
    pipeline_version: str,
    eligibility_hash: Optional[str],
    criteria_json: str,
    stats: Dict[str, Any],
) -> None:
    con.execute(
        """
        INSERT OR REPLACE INTO gold.pm_trial_criteria
        (nct_id, pipeline_version, eligibility_hash, criteria_json,
         total_bullets, covered_bullets, coverage_ratio, criteria_count, extracted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW());
        """,
        [
            nct_id,
            pipeline_version,
            eligibility_hash,
            criteria_json,
            int(stats.get("total_bullets") or 0),
            int(stats.get("covered_bullets") or 0),
            float(stats.get("coverage_ratio") or 0.0),
            int(stats.get("criteria_count") or 0),
        ],
    )


def upsert_questionnaire(
    con: "duckdb.DuckDBPyConnection",
    *,
    nct_id: str,
    pipeline_version: str,
    eligibility_hash: Optional[str],
    questionnaire_json: str,
    question_count: int,
    clinic_only_count: int,
    quality_score: int,
    quality_flags: Sequence[str],
    readiness: str,
) -> None:
    con.execute(
        """
        INSERT OR REPLACE INTO gold.pm_questionnaires
        (nct_id, pipeline_version, eligibility_hash, questionnaire_json,
         question_count, clinic_only_count, quality_score, quality_flags, readiness, generated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW());
        """,
        [
            nct_id,
            pipeline_version,
            eligibility_hash,
            questionnaire_json,
            int(question_count),
            int(clinic_only_count),
            int(quality_score),
            list(quality_flags),
            readiness,
        ],
    )


def upsert_atoms(
    con: "duckdb.DuckDBPyConnection",
    *,
    nct_id: str,
    pipeline_version: str,
    eligibility_hash: Optional[str],
    atoms: Sequence["EligibilityAtom"],
) -> None:
    con.execute(
        """
        DELETE FROM silver.eligibility_atoms
        WHERE nct_id = ? AND pipeline_version = ?;
        """,
        [nct_id, pipeline_version],
    )
    if not atoms:
        return

    ordered_atoms = sorted(
        atoms,
        key=lambda atom: (
            atom.section,
            atom.question_key,
            atom.kind,
            getattr(atom, "tier", 1),
            atom.rule_id,
            atom.atom_id,
        ),
    )
    rows = []
    for atom in ordered_atoms:
        rows.append(
            [
                nct_id,
                pipeline_version,
                eligibility_hash,
                atom.atom_id,
                atom.question_key,
                atom.kind,
                atom.section,
                json.dumps(atom.params, sort_keys=True),
                bool(atom.clinic_only),
                atom.rule_id,
                atom.evidence,
                int(getattr(atom, "tier", 1)),
            ]
        )
    con.executemany(
        """
        INSERT INTO silver.eligibility_atoms
        (nct_id, pipeline_version, eligibility_hash, atom_id, question_key, kind, section,
         params_json, clinic_only, rule_id, evidence, tier, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW());
        """,
        rows,
    )


def ensure_eval_tables(con: "duckdb.DuckDBPyConnection") -> None:
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS eval.pm_questionnaire_eval (
            pipeline_version VARCHAR,
            created_at TIMESTAMP,
            total_trials INTEGER,
            avg_quality_score DOUBLE,
            pct_high DOUBLE,
            pct_medium DOUBLE,
            pct_low DOUBLE,
            avg_question_count DOUBLE,
            avg_clinic_only_count DOUBLE
        );
        """
    )


def write_eval_snapshot(con: "duckdb.DuckDBPyConnection", *, pipeline_version: str) -> None:
    ensure_eval_tables(con)
    con.execute(
        """
        INSERT INTO eval.pm_questionnaire_eval
        SELECT
            ? AS pipeline_version,
            NOW() AS created_at,
            COUNT(*) AS total_trials,
            AVG(quality_score) AS avg_quality_score,
            AVG(CASE WHEN readiness='High' THEN 1 ELSE 0 END) AS pct_high,
            AVG(CASE WHEN readiness='Medium' THEN 1 ELSE 0 END) AS pct_medium,
            AVG(CASE WHEN readiness='Low' THEN 1 ELSE 0 END) AS pct_low,
            AVG(question_count) AS avg_question_count,
            AVG(clinic_only_count) AS avg_clinic_only_count
        FROM gold.pm_questionnaires
        WHERE pipeline_version = ?;
        """,
        [pipeline_version, pipeline_version],
    )
