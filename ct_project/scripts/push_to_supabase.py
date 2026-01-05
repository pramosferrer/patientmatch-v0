import os
import json
import math
import argparse
import random
import re
import time
import hashlib
from datetime import datetime, date
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from collections import Counter
import duckdb
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

_DEFAULT_DB_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "db", "aact.duckdb")
)
DB_PATH = os.getenv("DUCKDB_PATH") or _DEFAULT_DB_PATH
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

DEFAULT_BATCH_SIZE = int(os.getenv("SUPABASE_BATCH_SIZE", "200"))
_OPENAPI_CACHE_PATH = Path(__file__).resolve().parent / ".supabase_openapi_cache.json"

TRIAL_CANDIDATES = {
    "title": ["title", "brief_title", "official_title"],
    "sponsor": ["lead_sponsor_name", "lead_sponsor", "sponsor", "organization"],
    "phase": ["phase", "phase_list"],
    "status": ["status_norm", "overall_status", "status"],
    "status_bucket": ["status_bucket"],
    "gender": ["gender"],
    "minimum_age": ["minimum_age", "minimum_age_raw"],
    "maximum_age": ["maximum_age", "maximum_age_raw"],
    "conditions": [
        "conditions_display",
        "conditions_list",
        "conditions",
        "condition_slugs",
    ],
    "states_list": ["states_list"],
    "site_count_us": ["site_count_us"],
    "data_as_of_date": ["data_as_of_date"],
}

INSIGHTS_CANDIDATES = {
    "strictness_score": ["strictness_score"],
    "burden_score": ["burden_score"],
    "novelty_score": ["novelty_score"],
    "logistics_score": ["logistics_score"],
    "top_disqualifiers_json": ["top_disqualifiers_json"],
    "insights_flags_json": ["insights_flags_json"],
}

QUESTIONNAIRE_CANDIDATES = {
    "questionnaire_json": ["questionnaire_json"],
    "quality_score": ["quality_score"],
    "quality_flags": ["quality_flags"],
    "readiness": ["readiness"],
    "build_tag": ["build_tag", "pipeline_version", "generated_at"],
}

DEFAULT_STATUS_ALLOWLIST = ["Recruiting", "Not yet recruiting"]

COUNTRY_CANDIDATES = [
    "countries",
    "country",
    "countries_list",
    "country_list",
    "countries_display",
    "country_display",
]

COHORT_CANONICAL_CONDITIONS = [
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

COHORT_SYNONYMS = {
    "COPD": [
        "copd",
        "chronic obstructive pulmonary disease",
        "chronic obstructive pulmonary disorder",
    ],
    "Long COVID": [
        "long covid",
        "post covid",
        "post-covid",
        "post acute sequelae",
        "pasc",
        "post-acute sequelae of sars cov 2",
    ],
    "MASLD/MASH": [
        "masld",
        "mash",
        "metabolic dysfunction associated steatotic liver disease",
        "metabolic dysfunction associated steatohepatitis",
    ],
    "NAFLD": [
        "nafld",
        "nonalcoholic fatty liver disease",
        "non-alcoholic fatty liver disease",
    ],
    "NASH": [
        "nash",
        "nonalcoholic steatohepatitis",
        "non-alcoholic steatohepatitis",
    ],
}


def _ensure_obj(x):
    if x is None:
        return None
    if isinstance(x, (dict, list)):
        return x
    if isinstance(x, (tuple,)):
        return list(x)
    if isinstance(x, str):
        s = x.strip()
        if not s:
            return None
        try:
            return json.loads(s)
        except Exception:
            return x
    return x


def _openapi_url(supabase_url):
    return supabase_url.rstrip("/") + "/rest/v1/"


def fetch_openapi_schema(supabase_url, service_role_key):
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Accept": "application/openapi+json",
    }
    req = Request(_openapi_url(supabase_url), headers=headers)
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        raise RuntimeError(f"OpenAPI fetch failed ({exc.code}): {exc.reason}") from exc
    except URLError as exc:
        raise RuntimeError(f"OpenAPI fetch failed: {exc.reason}") from exc


def _find_table_schema(openapi, table):
    schemas = (openapi.get("components") or {}).get("schemas") or {}
    if not schemas:
        schemas = openapi.get("definitions") or {}
    candidates = []
    table_lc = table.lower()
    for name, schema in schemas.items():
        name_lc = name.lower()
        if name == table or name_lc == table_lc or name_lc.endswith("." + table_lc):
            candidates.append((name, schema))
    if not candidates:
        for name, schema in schemas.items():
            title = (schema.get("title") or "").lower()
            if title == table_lc or title.endswith("." + table_lc):
                candidates.append((name, schema))
    if not candidates:
        raise RuntimeError(
            f"Could not locate OpenAPI schema for table '{table}'. "
            f"Known schemas: {list(schemas)[:20]}"
        )
    candidates.sort(key=lambda x: len(x[0]))
    return candidates[0][1]


def get_table_columns_from_openapi(openapi, table):
    schema = _find_table_schema(openapi, table)
    props = schema.get("properties") or {}
    return set(props.keys())


def get_table_props_from_openapi(openapi, table):
    schema = _find_table_schema(openapi, table)
    return schema.get("properties") or {}


def load_or_fetch_schema_cache(supabase_url, service_role_key, *, cache_path, refresh=False):
    if cache_path.exists() and not refresh:
        return json.loads(cache_path.read_text())
    openapi = fetch_openapi_schema(supabase_url, service_role_key)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(openapi, indent=2, sort_keys=True))
    return openapi


def _coerce_by_type(value, key, prop):
    if value is None:
        return None
    typ = (prop or {}).get("type")
    if typ == "boolean":
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        s = str(value).strip().lower()
        if key == "readiness":
            if s == "high":
                return True
            if s in ("medium", "low"):
                return False
        if s in ("true", "t", "1", "yes", "y"):
            return True
        if s in ("false", "f", "0", "no", "n"):
            return False
        return None
    if typ == "integer":
        n = _parse_number(value)
        return int(n) if n is not None else None
    if typ == "number":
        n = _parse_number(value)
        return float(n) if n is not None else None
    return value


def filter_records_to_columns(records, allowed_cols, *, strict_schema, table, schema_props=None):
    if not allowed_cols:
        return records, {}
    dropped = Counter()
    filtered = []
    for rec in records:
        out = {}
        for k, v in rec.items():
            if k in allowed_cols:
                prop = schema_props.get(k, {}) if schema_props else {}
                out[k] = _coerce_by_type(v, k, prop)
            else:
                dropped[k] += 1
        filtered.append(out)
    if dropped:
        print(f"Schema filter ({table}): dropped keys {dict(dropped)}")
        if strict_schema:
            raise RuntimeError(f"[strict-schema] Dropped keys for {table}: {sorted(dropped.keys())}")
    return filtered, dropped


def _ensure_list(x):
    if x is None:
        return []
    if isinstance(x, list):
        return x
    if isinstance(x, tuple):
        return list(x)
    if isinstance(x, str):
        s = x.strip()
        if not s:
            return []
        try:
            v = json.loads(s)
            return v if isinstance(v, list) else [v]
        except Exception:
            return [s]
    return [x]


def _normalize_condition(value):
    return re.sub(r"\s+", " ", str(value).strip().lower())


def _normalize_condition_cohort(value):
    if value is None:
        return ""
    s = str(value).lower()
    s = s.replace("'", "")
    s = re.sub(r"[^a-z0-9\\s]+", " ", s)
    s = re.sub(r"\\s+", " ", s).strip()
    return s


def _sql_normalize_condition(expr):
    return (
        "trim(regexp_replace("
        "regexp_replace(regexp_replace(lower({expr}), '''', '', 'g'),"
        " '[^a-z0-9\\s]+', ' ', 'g'),"
        " '\\\\s+', ' ', 'g'))"
    ).format(expr=expr)


def _build_condition_matcher(allowlist):
    if not allowlist:
        return None

    synonym_index = {}
    for canonical in COHORT_CANONICAL_CONDITIONS:
        for item in [canonical] + COHORT_SYNONYMS.get(canonical, []):
            norm = _normalize_condition_cohort(item)
            if not norm:
                continue
            synonym_index[norm] = canonical

    selected_canonicals = set()
    custom_terms = []
    for item in allowlist:
        norm = _normalize_condition_cohort(item)
        if not norm:
            continue
        canonical = synonym_index.get(norm)
        if canonical:
            selected_canonicals.add(canonical)
        else:
            custom_terms.append(norm)

    exact_terms = set(custom_terms)
    substring_terms = set()
    selected_synonym_index = {}

    for canonical in selected_canonicals:
        for item in [canonical] + COHORT_SYNONYMS.get(canonical, []):
            norm = _normalize_condition_cohort(item)
            if not norm:
                continue
            exact_terms.add(norm)
            selected_synonym_index[norm] = canonical
            if canonical in COHORT_SYNONYMS:
                substring_terms.add(norm)

    return {
        "exact_terms": sorted(exact_terms),
        "substring_terms": sorted(substring_terms),
        "synonym_index": selected_synonym_index,
        "selected_canonicals": sorted(selected_canonicals),
    }


def _matches_condition_canonical(conditions, matcher):
    if not matcher:
        return []
    found = set()
    for raw in _parse_condition_values(conditions):
        norm = _normalize_condition_cohort(raw)
        if not norm:
            continue
        canonical = matcher["synonym_index"].get(norm)
        if canonical:
            found.add(canonical)
            continue
        padded = f" {norm} "
        for syn in matcher["substring_terms"]:
            if f" {syn} " in padded:
                found.add(matcher["synonym_index"].get(syn, syn))
    return sorted(found)

def _parse_condition_values(value):
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if v is not None and str(v).strip()]
    if isinstance(value, tuple):
        return [str(v).strip() for v in value if v is not None and str(v).strip()]
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return []
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return [str(v).strip() for v in parsed if v is not None and str(v).strip()]
        except Exception:
            return [s]
        return [s]
    return [str(value).strip()] if str(value).strip() else []


def _load_allowlist(path):
    items = []
    with open(path, "r") as f:
        for line in f:
            raw = line.strip()
            if not raw or raw.startswith("#"):
                continue
            items.append(raw)
    return items


def get_table_columns(con, schema, table):
    q = """
    select column_name, data_type
    from information_schema.columns
    where table_schema = ? and table_name = ?
    """
    return {r[0]: r[1] for r in con.execute(q, [schema, table]).fetchall()}


def pick_column(available_cols, candidates):
    for c in candidates:
        if c in available_cols:
            return c
    return None



def build_select_sql(trials_cols, questionnaire_cols, insights_cols):
    selects = ["t.nct_id as nct_id"]

    for out_col, cand_list in TRIAL_CANDIDATES.items():
        picked = pick_column(trials_cols, cand_list)
        if picked:
            selects.append(f"t.{picked} as {out_col}")

    for out_col, cand_list in QUESTIONNAIRE_CANDIDATES.items():
        picked = pick_column(questionnaire_cols, cand_list)
        if picked:
            selects.append(f"q.{picked} as {out_col}")

    if insights_cols:
        for out_col, cand_list in INSIGHTS_CANDIDATES.items():
            picked = pick_column(insights_cols, cand_list)
            if picked:
                selects.append(f"i.{picked} as {out_col}")

    return "select\n  " + ",\n  ".join(selects)
def build_cohort_select_sql(trials_cols, questionnaire_cols, questionnaire_from_agg):
    def select_or_null(cols, candidates, alias, table_alias):
        picked = pick_column(cols, candidates) if candidates else None
        if picked:
            return f"{table_alias}.{picked} as {alias}", picked
        return f"null as {alias}", None

    selects = ["t.nct_id as nct_id"]

    title_sql, _ = select_or_null(trials_cols, TRIAL_CANDIDATES["title"], "title", "t")
    phase_sql, _ = select_or_null(trials_cols, TRIAL_CANDIDATES["phase"], "phase", "t")
    status_sql, _ = select_or_null(trials_cols, TRIAL_CANDIDATES["status"], "status", "t")
    bucket_sql, _ = select_or_null(
        trials_cols, TRIAL_CANDIDATES["status_bucket"], "status_bucket", "t"
    )
    gender_sql, _ = select_or_null(trials_cols, TRIAL_CANDIDATES["gender"], "gender", "t")
    min_age_sql, _ = select_or_null(
        trials_cols, TRIAL_CANDIDATES["minimum_age"], "minimum_age", "t"
    )
    max_age_sql, _ = select_or_null(
        trials_cols, TRIAL_CANDIDATES["maximum_age"], "maximum_age", "t"
    )
    conditions_sql, conditions_col = select_or_null(
        trials_cols, ["conditions_display"], "conditions", "t"
    )
    if not conditions_col:
        raise ValueError("conditions_display column not found in pm_trials_serving.")
    states_sql, _ = select_or_null(trials_cols, TRIAL_CANDIDATES["states_list"], "states_list", "t")
    sites_sql, _ = select_or_null(trials_cols, TRIAL_CANDIDATES["site_count_us"], "site_count_us", "t")
    date_sql, _ = select_or_null(trials_cols, TRIAL_CANDIDATES["data_as_of_date"], "data_as_of_date", "t")

    def select_questionnaire_field(out_col, candidates):
        picked = pick_column(questionnaire_cols, candidates)
        if not picked:
            return f"null as {out_col}"
        if questionnaire_from_agg:
            return f"q.{out_col} as {out_col}"
        return f"q.{picked} as {out_col}"

    questionnaire_sql = select_questionnaire_field(
        "questionnaire_json", ["questionnaire_json"]
    )
    quality_score_sql = select_questionnaire_field("quality_score", ["quality_score"])
    quality_flags_sql = select_questionnaire_field("quality_flags", ["quality_flags"])
    readiness_sql = select_questionnaire_field("readiness", ["readiness"])
    build_tag_sql = select_questionnaire_field(
        "build_tag", QUESTIONNAIRE_CANDIDATES["build_tag"]
    )

    selects.extend(
        [
            title_sql,
            phase_sql,
            status_sql,
            bucket_sql,
            gender_sql,
            min_age_sql,
            max_age_sql,
            conditions_sql,
            states_sql,
            sites_sql,
            date_sql,
            questionnaire_sql,
            quality_score_sql,
            quality_flags_sql,
            readiness_sql,
            build_tag_sql,
        ]
    )

    sponsor_sql, _ = select_or_null(
        trials_cols, ["lead_sponsor_name"], "sponsor", "t"
    )
    selects.append(sponsor_sql)

    return "select\n  " + ",\n  ".join(selects)


def build_questionnaire_agg_sql(questionnaire_cols):
    selects = ["nct_id"]
    for out_col, cand_list in QUESTIONNAIRE_CANDIDATES.items():
        picked = pick_column(questionnaire_cols, cand_list)
        if picked:
            selects.append(f"any_value({picked}) as {out_col}")
    if len(selects) == 1:
        return None
    return "select\n  " + ",\n  ".join(selects) + "\nfrom gold.pm_questionnaires\ngroup by nct_id"


def _print_duckdb_path():
    resolved = os.path.abspath(DB_PATH)
    exists = os.path.exists(resolved)
    print(f"DuckDB path: {resolved} (exists={exists})")


def _print_conditions_table_diagnostics(con, table, conditions_col):
    print(f"Diagnostics: {table}")
    if not conditions_col:
        print("  conditions_display column not found; skipping diagnostics.")
        return
    summary_sql = f"""
    select
      count(*) as total,
      sum(case when {conditions_col} is null then 1 else 0 end) as conditions_display_nulls
    from {table};
    """
    total, nulls = con.execute(summary_sql).fetchone()
    print(f"  rows={total} conditions_display_nulls={nulls}")
    sample_sql = f"""
    select nct_id, {conditions_col} as conditions_display, typeof({conditions_col}) as conditions_type
    from {table}
    limit 5;
    """
    samples = con.execute(sample_sql).fetchall()
    print("  samples (nct_id, conditions_display, conditions_type):")
    for row in samples:
        print(
            f"    nct_id={row[0]!r} conditions_display={row[1]!r} conditions_type={row[2]!r}"
        )


def _print_join_diagnostics(con, query, label, conditions_key):
    rows = con.execute(query).fetchall()
    cols = [d[0] for d in con.description]
    print(f"Diagnostics: {label}")
    print(f"  columns include conditions_display? {'conditions_display' in cols}")
    print(f"  columns include conditions? {'conditions' in cols}")
    print(f"  samples (nct_id, {conditions_key}, keys):")
    for row in rows:
        r = dict(zip(cols, row))
        print(
            f"    nct_id={r.get('nct_id')!r} {conditions_key}={r.get(conditions_key)!r} keys={list(r.keys())}"
        )


def supabase_has_column(supabase, table, column):
    try:
        supabase.table(table).select(column).limit(1).execute()
        return True
    except Exception as exc:
        print(f"Supabase column check failed for {table}.{column}: {exc}")
        return False


def upsert_with_retry(
    supabase,
    table,
    chunk,
    on_conflict=None,
    max_attempts=5,
    backoff_seconds=1.5,
):
    for attempt in range(1, max_attempts + 1):
        try:
            if on_conflict:
                supabase.table(table).upsert(chunk, on_conflict=on_conflict).execute()
            else:
                supabase.table(table).upsert(chunk).execute()
            return supabase
        except Exception as exc:
            print(f"Upsert failed ({table}) attempt {attempt}/{max_attempts}: {exc}")
            if attempt >= max_attempts:
                raise
            time.sleep(backoff_seconds * attempt)
            supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return supabase


def _sql_escape(value):
    return value.replace("'", "''")


def _is_numeric_type(dtype):
    if not dtype:
        return False
    d = dtype.lower()
    return any(
        token in d
        for token in (
            "int",
            "decimal",
            "numeric",
            "double",
            "float",
            "real",
            "hugeint",
            "smallint",
            "bigint",
            "ubigint",
        )
    )


def _is_integer_type(dtype):
    if not dtype:
        return False
    d = dtype.lower()
    return any(token in d for token in ("int", "hugeint", "smallint", "bigint", "ubigint"))


def _parse_number(value):
    if isinstance(value, (int, float)):
        return value
    s = str(value).strip()
    if not s:
        return None
    if re.fullmatch(r"[+-]?\d+", s):
        try:
            return int(s)
        except Exception:
            return None
    if re.fullmatch(r"[+-]?\d+(\.\d+)?", s):
        try:
            return float(s)
        except Exception:
            return None
    return None


def build_state_filter(trials_cols, state):
    if not state:
        return None, False, None
    state_col = pick_column(trials_cols, TRIAL_CANDIDATES["states_list"])
    if not state_col:
        return None, False, None

    dtype = (trials_cols.get(state_col) or "").lower()
    state_safe = _sql_escape(state.strip())
    if "list" in dtype or dtype.endswith("[]"):
        return f"list_contains(t.{state_col}, '{state_safe}')", True, state_col

    state_re = re.escape(state_safe.lower())
    state_re = _sql_escape(state_re)
    return (
        f"regexp_matches(lower(t.{state_col}), '(^|[^a-z]){state_re}([^a-z]|$)')",
        True,
        state_col,
    )


def build_readiness_filter(questionnaire_cols, readiness):
    readiness_col = pick_column(questionnaire_cols, ["readiness"])
    if not readiness_col:
        return None, False, None

    readiness_type = questionnaire_cols.get(readiness_col, "")
    if "bool" in readiness_type.lower():
        return f"q.{readiness_col} = true", True, readiness_col
    if _is_numeric_type(readiness_type):
        return f"q.{readiness_col} != 0", True, readiness_col

    readiness_safe = _sql_escape(str(readiness).strip().lower())
    return f"lower(q.{readiness_col}) = '{readiness_safe}'", True, readiness_col


def build_quality_filter(questionnaire_cols, quality):
    quality_col = pick_column(questionnaire_cols, ["quality_score"])
    if not quality_col:
        return None, False, None

    quality_type = questionnaire_cols.get(quality_col, "")
    if _is_numeric_type(quality_type):
        numeric_quality = _parse_number(quality)
        if numeric_quality is not None:
            threshold = numeric_quality
            if _is_integer_type(quality_type) and 0 < numeric_quality <= 1:
                threshold = int(round(numeric_quality * 100))
                print(
                    f"Warning: quality_score is integer; scaled threshold to >= {threshold}."
                )
            return f"q.{quality_col} >= {threshold}", True, quality_col

        level = str(quality).strip().lower()
        thresholds = {"high": 80, "medium": 60, "low": 0}
        if level in thresholds:
            print(
                f"Warning: quality_score is numeric; '{quality}' mapped to >= {thresholds[level]}."
            )
            return f"q.{quality_col} >= {thresholds[level]}", True, quality_col

        print("Warning: quality_score is numeric; quality filter was skipped.")
        return None, False, quality_col

    return f"q.{quality_col} = '{_sql_escape(str(quality))}'", True, quality_col


def build_build_tag_filter(questionnaire_cols, build_tag):
    if not build_tag:
        return None, False, None

    build_tag_col = pick_column(questionnaire_cols, QUESTIONNAIRE_CANDIDATES["build_tag"])
    if not build_tag_col:
        return None, False, None

    return f"q.{build_tag_col} = '{_sql_escape(str(build_tag))}'", True, build_tag_col


def build_conditions_allowlist_filter(trials_cols, matcher):
    if not matcher:
        return None, False, None

    cond_col = "conditions_display" if "conditions_display" in trials_cols else None
    if not cond_col:
        cond_col = pick_column(
            trials_cols,
            ["conditions_list", "conditions", "condition_slugs"],
        )
    if not cond_col:
        return None, False, None

    cond_type = (trials_cols.get(cond_col) or "").lower()
    exact_terms = matcher.get("exact_terms") or []
    substring_terms = matcher.get("substring_terms") or []
    if not exact_terms and not substring_terms:
        return None, False, cond_col

    def build_match_sql(norm_expr):
        clauses = []
        if exact_terms:
            exact_list = ", ".join([f"'{_sql_escape(t)}'" for t in exact_terms])
            clauses.append(f"{norm_expr} in ({exact_list})")
        for term in substring_terms:
            escaped = _sql_escape(term)
            clauses.append(
                f"(' ' || {norm_expr} || ' ') like '% {escaped} %'"
            )
        return "(" + " or ".join(clauses) + ")"

    if "list" in cond_type or cond_type.endswith("[]"):
        norm_expr = _sql_normalize_condition("cond")
        match_sql = build_match_sql(norm_expr)
        return (
            f"exists (select 1 from unnest(t.{cond_col}) as cond(cond) where {match_sql})",
            True,
            cond_col,
        )

    norm_expr = _sql_normalize_condition(f"t.{cond_col}")
    match_sql = build_match_sql(norm_expr)
    return match_sql, True, cond_col


def build_country_filter(trials_cols, country):
    if not country:
        return None, False, None

    country_col = pick_column(trials_cols, COUNTRY_CANDIDATES)
    if not country_col:
        return None, False, None

    country_type = (trials_cols.get(country_col) or "").lower()
    country_norm = _normalize_condition(country)

    if "list" in country_type or country_type.endswith("[]"):
        return (
            "list_contains(list_transform(t.{col}, x -> lower(x)), '{val}')".format(
                col=country_col, val=_sql_escape(country_norm)
            ),
            True,
            country_col,
        )

    country_re = _sql_escape(re.escape(country_norm))
    col_expr = f"cast(t.{country_col} as varchar)"
    return (
        f"regexp_matches(lower({col_expr}), '(^|[^a-z0-9]){country_re}([^a-z0-9]|$)')",
        True,
        country_col,
    )


def build_status_filter(trials_cols, statuses):
    if not statuses:
        return None, False, None

    status_col = pick_column(trials_cols, TRIAL_CANDIDATES["status"])
    if not status_col:
        return None, False, None

    status_type = (trials_cols.get(status_col) or "").lower()
    statuses_norm = [_normalize_condition(s) for s in statuses if str(s).strip()]
    if not statuses_norm:
        return None, False, status_col

    if "list" in status_type or status_type.endswith("[]"):
        clauses = [
            "list_contains(list_transform(t.{col}, x -> lower(x)), '{val}')".format(
                col=status_col, val=_sql_escape(item)
            )
            for item in statuses_norm
        ]
        return "(" + " or ".join(clauses) + ")", True, status_col

    status_list = ", ".join([f"'{_sql_escape(s)}'" for s in statuses_norm])
    col_expr = f"lower(cast(t.{status_col} as varchar))"
    return f"{col_expr} in ({status_list})", True, status_col


def count_rows(con, from_sql, conditions=None, cte_sql=None):
    where = ""
    if conditions:
        where = f"where {' and '.join(conditions)}"
    prefix = f"{cte_sql}\n" if cte_sql else ""
    q = f"{prefix}select count(*) {from_sql} {where}"
    return con.execute(q).fetchone()[0]


def count_distinct_nct(con, from_sql, conditions=None, cte_sql=None):
    where = ""
    if conditions:
        where = f"where {' and '.join(conditions)}"
    prefix = f"{cte_sql}\n" if cte_sql else ""
    q = f"{prefix}select count(distinct t.nct_id) {from_sql} {where}"
    return con.execute(q).fetchone()[0]


def push_reference_table(
    con,
    supabase,
    source_table,
    target_table,
    batch_size=DEFAULT_BATCH_SIZE,
    ref_limit=None,
    allowed_cols=None,
    strict_schema=False,
    schema_props=None,
):
    if source_table == "ref.us_zip_centroids":
        select_sql = """
        select
          zip as zip,
          state_code as state_code,
          place_name as place_name,
          lat as lat,
          lon as lon,
          accuracy as accuracy
        from ref.us_zip_centroids
        """
        on_conflict = "zip"
    else:
        select_sql = f"select * from {source_table}"
        on_conflict = None

    if ref_limit is not None:
        select_sql = f"{select_sql}\nlimit {int(ref_limit)}"

    rows = con.execute(select_sql).fetchall()
    cols = [d[0] for d in con.description]
    records = []
    for row in rows:
        r = dict(zip(cols, row))
        for key, value in list(r.items()):
            if isinstance(value, (datetime, date)):
                r[key] = value.isoformat()
        records.append(r)

    print(f"Reference rows selected: {len(records)}")

    if not records:
        return

    # Save unfiltered records for insights extraction (filter strips insights columns)
    records_for_insights = list(records)
    
    records, _dropped = filter_records_to_columns(
        records,
        allowed_cols,
        strict_schema=strict_schema,
        table=target_table,
        schema_props=schema_props,
    )

    total = len(records)
    batches = math.ceil(total / batch_size)
    for i in range(batches):
        chunk = records[i * batch_size : (i + 1) * batch_size]
        print(f"Upserting reference batch {i+1}/{batches} ({len(chunk)} rows)...")
        if on_conflict:
            supabase.table(target_table).upsert(chunk, on_conflict=on_conflict).execute()
        else:
            supabase.table(target_table).upsert(chunk).execute()

    print(f"Reference rows upserted: {total}")


def push_tracer_bullet(
    state=None,
    limit=100,
    quality="High",
    readiness="High",
    build_tag=None,
    conditions_allowlist=None,
    statuses=None,
    country=None,
    batch_size=DEFAULT_BATCH_SIZE,
    mode="strict",
    push_sites=True,
    max_sites_per_trial=50,
    cohort_mode=False,
    strict_schema=False,
    refresh_schema_cache=False,
):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check your .env).")

    _print_duckdb_path()
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    con = duckdb.connect(DB_PATH)
    openapi = load_or_fetch_schema_cache(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        cache_path=_OPENAPI_CACHE_PATH,
        refresh=refresh_schema_cache,
    )
    allowed_cols = {}
    allowed_props = {}
    for table in ("trials", "trial_sites", "trial_insights"):
        try:
            allowed_props[table] = get_table_props_from_openapi(openapi, table)
            allowed_cols[table] = set(allowed_props[table].keys())
        except Exception as exc:
            if strict_schema:
                raise
            print(f"Warning: could not load OpenAPI columns for {table}: {exc}")
            allowed_cols[table] = None
            allowed_props[table] = None

    trials_cols = get_table_columns(con, "gold", "pm_trials_serving")
    questionnaire_cols = get_table_columns(con, "gold", "pm_questionnaires")
    insights_cols = get_table_columns(con, "gold", "pm_trial_insights")
    conditions_display_col = (
        "conditions_display" if "conditions_display" in trials_cols else None
    )
    _print_conditions_table_diagnostics(
        con, "gold.pm_trials_serving", conditions_display_col
    )

    insights_cols = get_table_columns(con, "gold", "pm_trial_insights")
    insights_cols = get_table_columns(con, "gold", "pm_trial_insights")
    questionnaire_agg_sql = None
    questionnaire_join_sql = ""
    cte_parts = []
    cte_sql = ""

    if cohort_mode:
        questionnaire_agg_sql = build_questionnaire_agg_sql(questionnaire_cols)
        if questionnaire_agg_sql:
            cte_parts.append(f"questionnaire_agg as ({questionnaire_agg_sql})")
            questionnaire_join_sql = (
                "left join questionnaire_agg q on q.nct_id = t.nct_id"
            )
        select_sql = build_cohort_select_sql(
            trials_cols,
            questionnaire_cols,
            questionnaire_from_agg=bool(questionnaire_agg_sql),
        )
    else:
        questionnaire_join_sql = "join gold.pm_questionnaires q on q.nct_id = t.nct_id"
        select_sql = build_select_sql(trials_cols, questionnaire_cols, insights_cols)

    insights_join_sql = "left join gold.pm_trial_insights i on i.nct_id = t.nct_id"
    if build_tag:
        insights_join_sql += f" and i.pipeline_version = '{build_tag}'"

    from_sql = f"""
    from gold.pm_trials_serving t
    {questionnaire_join_sql}
    {insights_join_sql}
    """

    if cte_parts: cte_sql = "with " + ",\n".join(cte_parts)

    push_preview_query = f"""
    {cte_sql}
    {select_sql}
    {from_sql}
    limit 5;
    """
    _print_join_diagnostics(
        con,
        push_preview_query,
        "joined push dataset (pm_trials_serving join pm_questionnaires)",
        "conditions",
    )

    base_count = count_rows(con, from_sql, cte_sql=cte_sql)
    print(f"Rows after JOIN: {base_count}")

    conditions = []
    state_applied = False
    readiness_applied = False
    quality_applied = False
    condition_matcher = _build_condition_matcher(conditions_allowlist)
    allowlist_filter_sql, allowlist_applied, allowlist_col = build_conditions_allowlist_filter(
        trials_cols, condition_matcher
    )
    if condition_matcher and condition_matcher["selected_canonicals"]:
        print(
            "Canonical conditions enabled: "
            + ", ".join(condition_matcher["selected_canonicals"])
        )
    if allowlist_applied:
        conditions.append(allowlist_filter_sql)
        count_after_allowlist = count_rows(con, from_sql, conditions, cte_sql=cte_sql)
        print(f"Rows after Conditions allowlist filter: {count_after_allowlist}")
    elif conditions_allowlist:
        print(
            "Warning: no conditions column found; allowlist filter was skipped."
        )

    if cohort_mode:
        print(
            "Mode: cohort (skipping Status, Country, State, Readiness, Quality, and Build Tag filters)."
        )
    else:
        status_filter_sql, status_applied, status_col = build_status_filter(
            trials_cols, statuses
        )
        if status_applied:
            conditions.append(status_filter_sql)
            count_after_status = count_rows(con, from_sql, conditions, cte_sql=cte_sql)
            print(f"Rows after Status filter: {count_after_status}")
        elif statuses:
            print("Warning: no status column found; status filter was skipped.")

        country_filter_sql, country_applied, country_col = build_country_filter(
            trials_cols, country
        )
        if country_applied:
            conditions.append(country_filter_sql)
            count_after_country = count_rows(con, from_sql, conditions, cte_sql=cte_sql)
            print(f"Rows after Country filter: {count_after_country}")
        elif country:
            print("Warning: no country column found; country filter was skipped.")

        if mode == "permissive":
            kept = []
            if allowlist_applied:
                kept.append(allowlist_filter_sql)
            if status_applied:
                kept.append(status_filter_sql)
            if country_applied:
                kept.append(country_filter_sql)
            conditions = kept
            print("Mode: permissive (skipping State, Readiness, and Quality filters).")
        else:
            state_filter_sql, state_applied, state_col = build_state_filter(
                trials_cols, state
            )
            if state_applied and state and state.strip():
                conditions.append(state_filter_sql)
                count_after_state = count_rows(con, from_sql, conditions, cte_sql=cte_sql)
                print(f"Rows after State filter: {count_after_state}")
            else:
                print(f"Rows after State filter: (skipped) {base_count}")

            readiness_filter_sql, readiness_applied, readiness_col = build_readiness_filter(
                questionnaire_cols, readiness
            )
            if readiness_applied and readiness.lower() != "low":
                conditions.append(readiness_filter_sql)
                count_after_readiness = count_rows(
                    con, from_sql, conditions, cte_sql=cte_sql
                )
                print(f"Rows after Readiness filter: {count_after_readiness}")
            else:
                print(
                    f"Rows after Readiness filter: (skipped) {count_rows(con, from_sql, conditions, cte_sql=cte_sql)}"
                )

            quality_filter_sql, quality_applied, quality_col = build_quality_filter(
                questionnaire_cols, quality
            )
            if quality_applied and quality.lower() != "low":
                conditions.append(quality_filter_sql)
                count_after_quality = count_rows(
                    con, from_sql, conditions, cte_sql=cte_sql
                )
                print(f"Rows after Quality filter: {count_after_quality}")
            else:
                print(
                    f"Rows after Quality filter: (skipped) {count_rows(con, from_sql, conditions, cte_sql=cte_sql)}"
                )

        build_tag_filter_sql, build_tag_applied, build_tag_col = build_build_tag_filter(
            questionnaire_cols, build_tag
        )
        if build_tag_applied:
            conditions.append(build_tag_filter_sql)
            count_after_build_tag = count_rows(
                con, from_sql, conditions, cte_sql=cte_sql
            )
            print(f"Rows after Build Tag filter: {count_after_build_tag}")
        elif build_tag:
            print(
                "Warning: no build_tag/pipeline_version column found; build_tag filter was skipped."
            )

    limit_clause = ""
    if limit is not None:
        limit_value = int(limit)
        if limit_value > 0:
            limit_clause = f"limit {limit_value}"

    query = f"""
    {cte_sql}
    {select_sql}
    {from_sql}
    {'where ' + ' and '.join(conditions) if conditions else ''}
    {limit_clause};
    """

    total_selected = count_rows(con, from_sql, conditions, cte_sql=cte_sql)
    distinct_selected = count_distinct_nct(
        con, from_sql, conditions, cte_sql=cte_sql
    )
    print(
        "Selected rows: "
        f"total={total_selected} distinct_nct_id={distinct_selected}"
    )
    if total_selected != distinct_selected:
        raise ValueError("Selected rows include duplicate nct_id values.")

    rows = con.execute(query).fetchall()
    cols = [d[0] for d in con.description]

    records = []
    emit_conditions_canonical = bool(condition_matcher and condition_matcher["selected_canonicals"])
    has_conditions_canonical = False
    if emit_conditions_canonical:
        has_conditions_canonical = supabase_has_column(
            supabase, "trials", "conditions_canonical"
        )
        if not has_conditions_canonical:
            print("Supabase trials.conditions_canonical not found; skipping column.")
    for row in rows:
        r = dict(zip(cols, row))

        for key, value in list(r.items()):
            if isinstance(value, (datetime, date)):
                r[key] = value.isoformat()

        if "readiness" in r and isinstance(r["readiness"], str):
            r["readiness"] = r["readiness"].strip()
            r["is_ready"] = r["readiness"].lower() == "high"
        else:
            r["is_ready"] = None

        # Normalize list fields
        if "conditions" in r:
            r["conditions"] = _ensure_list(r["conditions"])
        if "states_list" in r:
            r["states_list"] = _ensure_list(r["states_list"])
        if "quality_flags" in r:
            r["quality_flags"] = _ensure_list(r["quality_flags"])

        # Normalize JSON
        r["questionnaire_json"] = _ensure_obj(r.get("questionnaire_json"))

        if emit_conditions_canonical:
            r["conditions_canonical"] = _matches_condition_canonical(
                r.get("conditions"), condition_matcher
            )

        records.append(r)

    if mode != "permissive" and not cohort_mode:
        if not state_applied:
            print("Warning: no states_list column found; state filter was skipped.")
        if not readiness_applied:
            print("Warning: no readiness column found; readiness filter was skipped.")
        if not quality_applied:
            print("Warning: no quality_score column found; quality filter was skipped.")

    if records:
        sample_rows = records[:5]
        print("Sample rows (nct_id, sponsor, conditions_len, conditions_canonical):")
        for rec in sample_rows:
            conditions_list = rec.get("conditions") or []
            if not conditions_list:
                raise ValueError("Selected row has empty conditions list.")
            print(
                "  "
                f"nct_id={rec.get('nct_id')!r} "
                f"sponsor={rec.get('sponsor')!r} "
                f"conditions_len={len(conditions_list)} "
                f"conditions_canonical={rec.get('conditions_canonical')!r}"
            )

    if emit_conditions_canonical and not has_conditions_canonical:
            rec.pop("conditions_canonical", None)

    print(f"Found {len(records)} records to upsert into Supabase public.trials")

    if not records:
        return

    # Save unfiltered records for insights extraction (filter strips insights columns)
    records_for_insights = list(records)

    records, _dropped = filter_records_to_columns(
        records,
        allowed_cols.get("trials"),
        strict_schema=strict_schema,
        table="trials",
        schema_props=allowed_props.get("trials"),
    )

    total = len(records)
    batches = math.ceil(total / batch_size)

    for i in range(batches):
        chunk = records[i * batch_size : (i + 1) * batch_size]
        print(f"Upserting batch {i+1}/{batches} ({len(chunk)} rows)...")
        supabase = upsert_with_retry(
            supabase,
            "trials",
            chunk,
            on_conflict="nct_id",
        )

    print(f"Trials pushed: {total}")
    # Build and upsert trial_insights records keyed by nct_id.
    try:
        insights_records = []
        for rec in records_for_insights:
            nct = rec.get("nct_id")
            if not nct:
                continue
            pipeline_version = rec.get("build_tag") or rec.get("pipeline_version")
            # compute a deterministic input hash of the selected record
            input_hash = hashlib.sha256(
                json.dumps(rec, sort_keys=True, default=str).encode("utf-8")
            ).hexdigest()

            if nct == "NCT00004317": print(f"DIAGNOSTIC NCT00004317: burden={rec.get('burden_score')} logistics={rec.get('logistics_score')} p_v={rec.get('pipeline_version')}")
            insights_records.append(
                {
                    "nct_id": nct,
                    "pipeline_version": pipeline_version,
                    "input_hash": input_hash,
                    "strictness_score": rec.get("strictness_score"),
                    "burden_score": rec.get("burden_score"),
                    "novelty_score": rec.get("novelty_score"),
                    "logistics_score": rec.get("logistics_score"),
                    "top_disqualifiers_json": rec.get("top_disqualifiers_json")
                    or rec.get("top_disqualifiers"),
                    "insights_flags_json": rec.get("insights_flags_json")
                    or rec.get("insights_flags")
                    or rec.get("quality_flags"),
                    "plain_summary_json": rec.get("plain_summary_json"),
                }
            )

        if insights_records:
            insights_records, _dropped = filter_records_to_columns(
                insights_records,
                allowed_cols.get("trial_insights"),
                strict_schema=strict_schema,
                table="trial_insights",
                schema_props=allowed_props.get("trial_insights"),
            )
            print(f"Upserting {len(insights_records)} records into trial_insights...")
            supabase = upsert_with_retry(
                supabase, "trial_insights", insights_records, on_conflict="nct_id"
            )
            print("trial_insights pushed")
    except Exception as exc:
        print(f"Warning: trial_insights upsert failed: {exc}")
    print("Supabase verification SQL:")
    print(
        "  select "
        "count(*) as total, "
        "sum(case when sponsor is null then 1 else 0 end) as sponsor_nulls, "
        "round(100.0 * sum(case when sponsor is null then 1 else 0 end) / nullif(count(*), 0), 2) as sponsor_null_pct "
        "from trials;"
    )
    print(
        "  select "
        "count(*) as total, "
        "sum(case when conditions is null or array_length(conditions, 1) = 0 then 1 else 0 end) as conditions_empty, "
        "round(100.0 * sum(case when conditions is null or array_length(conditions, 1) = 0 then 1 else 0 end) / nullif(count(*), 0), 2) as conditions_empty_pct "
        "from trials;"
    )
    print(
        "  select sponsor, count(*) as trial_count "
        "from trials "
        "where sponsor is not null "
        "group by sponsor "
        "order by trial_count desc "
        "limit 10;"
    )
    print(
        "  select condition, count(*) as trial_count "
        "from trials, unnest(conditions) as condition "
        "group by condition "
        "order by trial_count desc "
        "limit 10;"
    )

    if conditions_allowlist and not cohort_mode:
        allowlist_norm = {
            _normalize_condition(item): item for item in conditions_allowlist
        }
        counts = {item: 0 for item in conditions_allowlist}
        for record in records:
            matched = set()
            for cond in _parse_condition_values(record.get("conditions")):
                norm = _normalize_condition(cond)
                if norm in allowlist_norm:
                    matched.add(allowlist_norm[norm])
            for item in matched:
                counts[item] += 1

        print("Counts per condition pushed:")
        for item in conditions_allowlist:
            print(f"- {item}: {counts.get(item, 0)}")

        nct_ids_all = [r["nct_id"] for r in records if r.get("nct_id")]
        if nct_ids_all:
            sample = random.sample(nct_ids_all, min(10, len(nct_ids_all)))
            print("Random nct_ids pushed: " + ", ".join(sample))
        else:
            print("Random nct_ids pushed: none")

    if not push_sites:
        print("Done.")
        return

    nct_ids = [r["nct_id"] for r in records if r.get("nct_id")]
    if not nct_ids:
        print("No nct_id values found for site upload.")
        return

    selected_values = ", ".join([f"('{_sql_escape(nct_id)}')" for nct_id in nct_ids])
    site_limit = int(max_sites_per_trial)
    if site_limit <= 0:
        site_limit = 50

    site_query = f"""
    with selected(nct_id) as (
      values {selected_values}
    ),
    ranked as (
      select
        s.nct_id,
        s.site_key,
        s.facility_name,
        s.city,
        s.state_code,
        s.zip5,
        s.lat,
        s.lon,
        s.geom_wkt,
        s.accuracy,
        row_number() over (partition by s.nct_id order by s.site_key) as rn
      from gold.pm_trial_sites s
      join selected sel on sel.nct_id = s.nct_id
    )
    select
      nct_id,
      site_key,
      facility_name,
      city,
      state_code,
      zip5,
      lat,
      lon,
      geom_wkt,
      accuracy
    from ranked
    where rn <= {site_limit};
    """

    site_rows = con.execute(site_query).fetchall()
    site_cols = [d[0] for d in con.description]
    site_records = [dict(zip(site_cols, row)) for row in site_rows]
    deduped = []
    seen = set()
    for rec in site_records:
        key = (rec.get("nct_id"), rec.get("site_key"))
        if key in seen:
            continue
        seen.add(key)
        if "geom_wkt" in rec:
            rec["geom"] = rec.pop("geom_wkt")
        deduped.append(rec)
    site_records = deduped

    print(f"Found {len(site_records)} site rows to upsert into Supabase public.trial_sites")
    # Verification: SELECT count(*) FROM trial_sites WHERE nct_id = 'NCT01234567';

    if not site_records:
        print("Done.")
        return

    site_records, _dropped = filter_records_to_columns(
        site_records,
        allowed_cols.get("trial_sites"),
        strict_schema=strict_schema,
        table="trial_sites",
        schema_props=allowed_props.get("trial_sites"),
    )

    site_total = len(site_records)
    site_batches = math.ceil(site_total / batch_size)
    for i in range(site_batches):
        chunk = site_records[i * batch_size : (i + 1) * batch_size]
        print(f"Upserting site batch {i+1}/{site_batches} ({len(chunk)} rows)...")
        supabase = upsert_with_retry(
            supabase,
            "trial_sites",
            chunk,
            on_conflict="nct_id,site_key",
        )

    print(f"Site rows pushed: {site_total}")
    print("Done.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state")
    ap.add_argument("--limit", type=int, default=100)
    ap.add_argument("--quality", default="High")
    ap.add_argument("--readiness", default="High")
    ap.add_argument("--build_tag")
    ap.add_argument(
        "--cohort-conditions",
        action="store_true",
        help="Use the built-in 19-condition cohort with synonym matching.",
    )
    ap.add_argument(
        "--conditions-allowlist",
        help="Path to newline-separated condition strings to include",
    )
    ap.add_argument(
        "--status",
        action="append",
        help="Status value to include (repeatable or comma-separated)",
    )
    ap.add_argument("--country", help="Country name to filter on")
    ap.add_argument("--mode", choices=["strict", "permissive"], default="strict")
    ap.add_argument("--push_sites", action=argparse.BooleanOptionalAction, default=True)
    ap.add_argument("--max_sites_per_trial", type=int, default=50)
    ap.add_argument("--batch_size", type=int, default=DEFAULT_BATCH_SIZE)
    ap.add_argument("--push_reference")
    ap.add_argument("--ref_target_table", default="zip_centroids")
    ap.add_argument("--ref_limit", type=int)
    ap.add_argument("--strict_schema", action="store_true", help="Fail if payload contains columns missing in Supabase")
    ap.add_argument("--refresh_schema_cache", action="store_true", help="Refresh cached Supabase OpenAPI schema")
    args = ap.parse_args()

    if args.push_reference:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError(
                "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check your .env)."
            )
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        con = duckdb.connect(DB_PATH)
        openapi = load_or_fetch_schema_cache(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
            cache_path=_OPENAPI_CACHE_PATH,
            refresh=args.refresh_schema_cache,
        )
        try:
            allowed_props = get_table_props_from_openapi(openapi, args.ref_target_table)
            allowed_cols = set(allowed_props.keys())
        except Exception as exc:
            if args.strict_schema:
                raise
            print(f"Warning: could not load OpenAPI columns for {args.ref_target_table}: {exc}")
            allowed_cols = None
            allowed_props = None
        push_reference_table(
            con,
            supabase,
            args.push_reference,
            args.ref_target_table,
            batch_size=args.batch_size,
            ref_limit=args.ref_limit,
            allowed_cols=allowed_cols,
            strict_schema=args.strict_schema,
            schema_props=allowed_props,
        )
        return

    if args.cohort_conditions and args.conditions_allowlist:
        raise ValueError("Use either --cohort-conditions or --conditions-allowlist, not both.")

    cohort_mode = bool(args.cohort_conditions)
    conditions_allowlist = None
    if cohort_mode:
        conditions_allowlist = COHORT_CANONICAL_CONDITIONS
    elif args.conditions_allowlist:
        conditions_allowlist = _load_allowlist(args.conditions_allowlist)
        if not conditions_allowlist:
            raise ValueError("Conditions allowlist is empty after parsing.")

    statuses = None
    if args.status:
        statuses = []
        for item in args.status:
            if item is None:
                continue
            parts = [p.strip() for p in str(item).split(",") if p.strip()]
            statuses.extend(parts)
    elif conditions_allowlist and not cohort_mode:
        statuses = DEFAULT_STATUS_ALLOWLIST

    country = args.country
    if conditions_allowlist and not country and not cohort_mode:
        country = "United States"

    state = args.state
    # Only default to MA if state is None (not just empty string)
    if not conditions_allowlist and state is None and not cohort_mode:
        state = "MA"

    push_tracer_bullet(
        state=state,
        limit=args.limit,
        quality=args.quality,
        readiness=args.readiness,
        build_tag=args.build_tag,
        conditions_allowlist=conditions_allowlist,
        statuses=statuses,
        country=country,
        batch_size=args.batch_size,
        mode=args.mode,
        push_sites=args.push_sites,
        max_sites_per_trial=args.max_sites_per_trial,
        cohort_mode=cohort_mode,
        strict_schema=args.strict_schema,
        refresh_schema_cache=args.refresh_schema_cache,
    )


if __name__ == "__main__":
    main()
