#!/usr/bin/env python3
"""
Build deterministic trial insights from structured AACT fields and persisted atoms.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple

from pmq.dbio import connect, ensure_output_tables
from pmq.eligibility_parser import iter_all_bullets


HARD_SCREENER_KEYS = [
    "recent_investigational_drug",
    "currently_in_other_trial",
    "taking_immunosuppressants",
    "taking_systemic_steroids",
    "kidney_disease_dialysis",
    "liver_disease",
    "hiv_or_hepatitis",
    "active_infection",
    "organ_transplant",
    "prior_malignancy_recent",
    "pregnant",
    "breastfeeding",
    "recent_cardiovascular_event",
    "recent_cancer_therapy",
]


def _normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _clean_list(values: Sequence[Any]) -> List[str]:
    cleaned: List[str] = []
    for value in values:
        if value is None:
            continue
        text = str(value)
        if not text:
            continue
        cleaned.append(text)
    return cleaned


def _stable_json_dumps(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def _sha256_json(value: Any) -> str:
    payload = _stable_json_dumps(value)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _percentile(values: Sequence[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    pos = (len(ordered) - 1) * (pct / 100.0)
    lower = int(math.floor(pos))
    upper = int(math.ceil(pos))
    if lower == upper:
        return ordered[lower]
    weight = pos - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * weight


def _clamp_score(value: float) -> int:
    return max(0, min(100, int(round(value))))


def _parse_params(params_json: Optional[str]) -> Dict[str, Any]:
    if not params_json:
        return {}
    try:
        return json.loads(params_json)
    except json.JSONDecodeError:
        return {}


def _truncate(value: Optional[str], limit: int) -> str:
    if not value:
        return ""
    return value[:limit]


def _is_remote(title: str, eligibility_text: str) -> bool:
    """
    Detect truly remote/decentralized trials with HIGH PRECISION.
    TITLE-ONLY matching to ensure accuracy for patient-facing display.
    """
    title_lower = title.lower()
    
    # High-confidence keywords that MUST appear in TITLE
    # (eligibility_text is ignored for precision)
    remote_keywords = [
        "telehealth",
        "telemedicine",
        "telepsychology",
        "at-home",
        "at home",
        "home-based",
        "decentralized trial",
        "decentralized clinical trial",
    ]
    
    return any(kw in title_lower for kw in remote_keywords)
    
    # HIGH CONFIDENCE remote indicators - unambiguous
    strong_keywords = [
        "telehealth",
        "telemedicine",
        "decentralized trial",
        "decentralized clinical trial",
        "at-home",
        "at home trial",
        "virtual visit",
        "home-based",
    ]
    if any(kw in content for kw in strong_keywords):
        return True
    
    # MODERATE CONFIDENCE - require additional context
    # "remote" alone is ambiguous (could be "remote area", "remote community")
    # "virtual" alone is ambiguous (could be "virtual screening", "virtual colonoscopy")
    # Only flag if combined with trial-related terms
    if "remote" in content:
        remote_context = ["remote participation", "remote consent", "remote study", "remotely"]
        if any(ctx in content for ctx in remote_context):
            return True
    
    if "virtual" in content:
        virtual_context = ["virtual appointment", "virtual clinic", "virtual care"]
        if any(ctx in content for ctx in virtual_context):
            return True
    
    return False

def _phase_score(phase_raw: Optional[str]) -> int:
    if not phase_raw:
        return 0
    phase = phase_raw.lower()
    if "phase 1" in phase:
        return 15
    if "phase 2" in phase:
        return 10
    if "phase 3" in phase:
        return 5
    return 0


_BULLET_MARKERS = ("-", "*", "\u2022", "\u00b7")
_HEADER_RE = re.compile(r"^(inclusion|exclusion)\s+criteria[:\-]?$", re.I)
_NUMBERED_RE = re.compile(r"^\(?[0-9]{1,3}[.)]\s+\S")
_ALPHA_RE = re.compile(r"^\(?[a-zA-Z][.)]\s+\S")


def fallback_bullet_count(eligibility_text: str) -> int:
    text = eligibility_text.strip()
    if not text:
        return 0
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    bullet_like = 0
    for line in lines:
        if _HEADER_RE.match(line):
            continue
        if line.startswith(_BULLET_MARKERS):
            bullet_like += 1
            continue
        if _NUMBERED_RE.match(line) or _ALPHA_RE.match(line):
            bullet_like += 1
    if bullet_like == 0 and len(text) >= 300:
        sentence_count = text.count(". ") + len(re.findall(r";\s", text)) + text.count("\n")
        bullet_like = min(50, max(1, sentence_count // 2))
    return bullet_like


def _compute_input_hash(
    *,
    nct_id: str,
    eligibility_hash: Optional[str],
    interventions_display: Sequence[str],
    conditions_display: Sequence[str],
    site_count_us: Optional[int],
    states_list: Sequence[str],
    question_count_total: Optional[int],
    eligibility_text_len: int,
    bullet_count: int,
    bullet_count_primary: int,
    bullet_count_fallback: int,
    atom_ids: Sequence[str],
) -> str:
    payload = {
        "nct_id": nct_id,
        "eligibility_hash": eligibility_hash,
        "interventions_display": sorted(_clean_list(interventions_display)),
        "conditions_display": sorted(_clean_list(conditions_display)),
        "site_count_us": site_count_us,
        "states_list": sorted(_clean_list(states_list)),
        "question_count_total": question_count_total,
        "eligibility_text_len": eligibility_text_len,
        "bullet_count": bullet_count,
        "bullet_count_primary": bullet_count_primary,
        "bullet_count_fallback": bullet_count_fallback,
        "atom_ids": sorted(atom_ids),
    }
    return _sha256_json(payload)


def _compute_strictness(
    *,
    eligibility_text_len: int,
    bullet_count: int,
    question_count_total: Optional[int],
    num_hard_screener_atoms: int,
    num_time_windows: int,
    clinic_only_atoms: int,
) -> int:
    base = 0
    base += min(35, int(eligibility_text_len / 400))
    base += min(35, int(bullet_count * 2))
    if question_count_total is not None:
        base += min(20, int(question_count_total / 2))
    base = min(80, base)

    bonus = 0
    bonus += min(12, 2 * num_hard_screener_atoms)
    bonus += min(6, num_time_windows)
    bonus += min(2, clinic_only_atoms)
    bonus = min(20, bonus)

    return _clamp_score(base + bonus)


def _compute_burden(
    *,
    question_count_total: Optional[int],
    phase_raw: Optional[str],
) -> int:
    score = 0
    if phase_raw:
        phase = phase_raw.lower()
        if "phase 1" in phase:
            score += 40
        elif "phase 2" in phase:
            score += 25
        elif "phase 3" in phase:
            score += 15
        elif "phase 4" in phase:
            score += 5
    
    if question_count_total is not None:
        score += min(40, int(question_count_total))
        
    return _clamp_score(score)


def _compute_logistics(*, is_remote: bool) -> int:
    if is_remote:
        return 100
    return 50


def _novelty_scale(raw_scores: Sequence[Optional[float]]) -> Tuple[float, float]:
    available = [value for value in raw_scores if value is not None]
    if not available:
        return 0.0, 0.0
    return _percentile(available, 5), _percentile(available, 95)


def _score_novelty(raw_value: Optional[float], p5: float, p95: float) -> int:
    if raw_value is None:
        return 0
    if p95 <= p5:
        return 0
    scaled = (raw_value - p5) / (p95 - p5) * 100.0
    return _clamp_score(scaled)


def _top_disqualifiers(
    atoms: Sequence[Dict[str, Any]],
    question_key_freq: Dict[str, int],
) -> List[Dict[str, str]]:
    candidates: List[Tuple[Tuple[Any, ...], Dict[str, Any]]] = []
    for atom in atoms:
        question_key = atom.get("question_key")
        if not question_key:
            continue
        if atom.get("section") != "exclusion" and question_key not in HARD_SCREENER_KEYS:
            continue
        params = atom.get("params") or {}
        has_window = "window_days" in params
        freq = question_key_freq.get(question_key, 0)
        priority = (
            0 if question_key in HARD_SCREENER_KEYS else 1,
            0 if has_window else 1,
            freq,
            question_key,
            atom.get("atom_id") or "",
        )
        candidates.append((priority, atom))

    candidates.sort(key=lambda item: item[0])
    seen: set[str] = set()
    output: List[Dict[str, str]] = []
    for _priority, atom in candidates:
        question_key = atom.get("question_key")
        if not question_key or question_key in seen:
            continue
        seen.add(question_key)
        entry = {
            "question_key": question_key,
            "reason": "derived_from_eligibility",
        }
        evidence = _truncate(atom.get("evidence"), 160)
        if evidence:
            entry["evidence"] = evidence
        output.append(entry)
        if len(output) >= 5:
            break
    return output


def _summarize_percentiles(name: str, values: Sequence[int]) -> str:
    if not values:
        return f"{name}: n=0"
    p5 = _percentile(values, 5)
    p50 = _percentile(values, 50)
    p95 = _percentile(values, 95)
    return f"{name}: p5={p5:.1f} p50={p50:.1f} p95={p95:.1f}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True, help="Path to aact.duckdb")
    parser.add_argument("--pipeline", required=True, help="Pipeline version to compute")
    parser.add_argument("--limit", type=int, default=None, help="Optional limit for testing")
    parser.add_argument("--force", action="store_true", help="Recompute even if inputs unchanged")
    args = parser.parse_args()

    con = connect(args.db)
    ensure_output_tables(con)

    trials_sql = """
        SELECT
            t.nct_id,
            t.phase,
            t.eligibility_hash,
            t.conditions_display,
            t.interventions_display,
            t.title as brief_title,
            COALESCE(ss.site_count_us, t.site_count_us) AS site_count_us,
            COALESCE(ss.states_list, t.states_list) AS states_list,
            q.question_count AS question_count_total,
            q.readiness,
            q.quality_flags,
            tf.eligibility_text_clean
        FROM gold.pm_trials_serving t
        JOIN gold.pm_questionnaires q
          ON q.nct_id = t.nct_id
         AND q.pipeline_version = ?
        LEFT JOIN gold.pm_site_summary ss
          ON ss.nct_id = t.nct_id
        LEFT JOIN gold.pm_trials tf
          ON tf.nct_id = t.nct_id
        ORDER BY t.nct_id
    """
    trial_rows = con.execute(trials_sql, [args.pipeline]).fetchall()
    if args.limit is not None:
        trial_rows = trial_rows[: max(0, args.limit)]

    trials: List[Dict[str, Any]] = []
    for row in trial_rows:
        (
            nct_id,
            phase,
            eligibility_hash,
            conditions_display,
            interventions_display,
            brief_title,
            site_count_us,
            states_list,
            question_count_total,
            readiness,
            quality_flags,
            eligibility_text_clean,
        ) = row
        eligibility_text = ""
        if eligibility_text_clean is not None:
            if isinstance(eligibility_text_clean, bytes):
                eligibility_text = eligibility_text_clean.decode("utf-8", errors="replace")
            else:
                eligibility_text = str(eligibility_text_clean)
        eligibility_text = eligibility_text.strip()
        eligibility_text_len = len(eligibility_text)
        bullet_count_primary = len(iter_all_bullets(eligibility_text)) if eligibility_text else 0
        bullet_count_fallback = 0
        if bullet_count_primary == 0 and eligibility_text_len > 0:
            bullet_count_fallback = fallback_bullet_count(eligibility_text)
        bullet_count = bullet_count_primary if bullet_count_primary > 0 else bullet_count_fallback
        trials.append(
            {
                "nct_id": str(nct_id),
                "phase": str(phase) if phase is not None else None,
                "eligibility_hash": str(eligibility_hash) if eligibility_hash is not None else None,
                "conditions_display": list(conditions_display) if conditions_display is not None else [],
                "interventions_display": list(interventions_display) if interventions_display is not None else [],
                "title": brief_title or "",
                "eligibility_text": eligibility_text,
                "site_count_us": int(site_count_us) if site_count_us is not None else None,
                "states_list": list(states_list) if states_list is not None else [],
                "question_count_total": int(question_count_total) if question_count_total is not None else None,
                "readiness": str(readiness) if readiness is not None else None,
                "quality_flags": list(quality_flags) if quality_flags is not None else [],
                "eligibility_text_len": eligibility_text_len,
                "bullet_count": bullet_count,
                "bullet_count_primary": bullet_count_primary,
                "bullet_count_fallback": bullet_count_fallback,
            }
        )

    atoms_sql = """
        SELECT
            nct_id,
            atom_id,
            question_key,
            kind,
            section,
            params_json,
            clinic_only,
            rule_id,
            evidence
        FROM silver.eligibility_atoms
        WHERE pipeline_version = ?
    """
    atom_rows = con.execute(atoms_sql, [args.pipeline]).fetchall()
    atoms_by_trial: Dict[str, List[Dict[str, Any]]] = {}
    question_key_freq: Dict[str, int] = {}
    for row in atom_rows:
        (
            nct_id,
            atom_id,
            question_key,
            kind,
            section,
            params_json,
            clinic_only,
            rule_id,
            evidence,
        ) = row
        atom = {
            "atom_id": str(atom_id) if atom_id is not None else "",
            "question_key": str(question_key) if question_key is not None else "",
            "kind": str(kind) if kind is not None else "",
            "section": str(section) if section is not None else "",
            "params": _parse_params(params_json),
            "clinic_only": bool(clinic_only) if clinic_only is not None else False,
            "rule_id": str(rule_id) if rule_id is not None else "",
            "evidence": str(evidence) if evidence is not None else "",
        }
        atoms_by_trial.setdefault(str(nct_id), []).append(atom)
        if atom["question_key"]:
            question_key_freq[atom["question_key"]] = question_key_freq.get(atom["question_key"], 0) + 1

    existing_rows = con.execute(
        """
        SELECT nct_id, input_hash
        FROM gold.pm_trial_insights
        WHERE pipeline_version = ?
        """,
        [args.pipeline],
    ).fetchall()
    existing_hash = {str(row[0]): str(row[1]) for row in existing_rows}

    intervention_freq: Dict[str, int] = {}
    for trial in trials:
        names = {_normalize_name(name) for name in trial["interventions_display"] if name}
        for name in names:
            intervention_freq[name] = intervention_freq.get(name, 0) + 1

    novelty_raw: List[Optional[float]] = []
    for trial in trials:
        interventions = [_normalize_name(name) for name in trial["interventions_display"] if name]
        if not interventions:
            novelty_raw.append(None)
            continue
        inv_scores = []
        for name in interventions:
            freq = max(1, intervention_freq.get(name, 1))
            inv_scores.append(1.0 / math.sqrt(freq))
        novelty_raw.append(sum(inv_scores) / len(inv_scores))

    novelty_p5, novelty_p95 = _novelty_scale(novelty_raw)

    to_insert: List[List[Any]] = []
    computed = 0
    skipped = 0

    strictness_scores: List[int] = []
    burden_scores: List[int] = []
    novelty_scores: List[int] = []
    logistics_scores: List[int] = []
    zero_bullet_primary = 0
    zero_bullet_count = 0
    zero_text_len = 0
    bullet_primary_counts: List[int] = []
    bullet_counts: List[int] = []

    for trial, raw_novelty in zip(trials, novelty_raw):
        nct_id = trial["nct_id"]
        atoms = atoms_by_trial.get(nct_id, [])
        atom_ids = [atom.get("atom_id", "") for atom in atoms if atom.get("atom_id")]
        bullet_primary_counts.append(trial["bullet_count_primary"])
        bullet_counts.append(trial["bullet_count"])
        if trial["bullet_count_primary"] == 0:
            zero_bullet_primary += 1
        if trial["bullet_count"] == 0:
            zero_bullet_count += 1
        if trial["eligibility_text_len"] == 0:
            zero_text_len += 1

        input_hash = _compute_input_hash(
            nct_id=nct_id,
            eligibility_hash=trial["eligibility_hash"],
            interventions_display=trial["interventions_display"],
            conditions_display=trial["conditions_display"],
            site_count_us=trial["site_count_us"],
            states_list=trial["states_list"],
            question_count_total=trial["question_count_total"],
            eligibility_text_len=trial["eligibility_text_len"],
            bullet_count=trial["bullet_count"],
            bullet_count_primary=trial["bullet_count_primary"],
            bullet_count_fallback=trial["bullet_count_fallback"],
            atom_ids=atom_ids,
        )
        num_hard = sum(1 for atom in atoms if atom.get("question_key") in HARD_SCREENER_KEYS)
        num_time_windows = sum(1 for atom in atoms if "window_days" in (atom.get("params") or {}))
        clinic_only_atoms = sum(1 for atom in atoms if atom.get("clinic_only"))
        strictness_score = _compute_strictness(
            eligibility_text_len=trial["eligibility_text_len"],
            bullet_count=trial["bullet_count"],
            question_count_total=trial["question_count_total"],
            num_hard_screener_atoms=num_hard,
            num_time_windows=num_time_windows,
            clinic_only_atoms=clinic_only_atoms,
        )

        states_count = len({state for state in trial.get("states_list", []) if state})
        burden_score = _compute_burden(
            question_count_total=trial.get("question_count_total"),
            phase_raw=trial.get("phase"),
        )

        is_remote = _is_remote(trial.get("title", ""), trial.get("eligibility_text", ""))
        logistics_score = _compute_logistics(is_remote=is_remote)
        novelty_score = _score_novelty(raw_novelty, novelty_p5, novelty_p95)

        if not args.force and existing_hash.get(nct_id) == input_hash:
            skipped += 1
            strictness_scores.append(strictness_score)
            burden_scores.append(burden_score)
            novelty_scores.append(novelty_score)
            logistics_scores.append(logistics_score)
            continue

        insights_flags = []
        if not trial["interventions_display"]:
            insights_flags.append("missing_interventions")
        if trial["site_count_us"] is None or trial["site_count_us"] == 0:
            insights_flags.append("missing_sites")
        if states_count == 0:
            insights_flags.append("missing_states")
        if not atoms:
            insights_flags.append("no_atoms")
        if trial["question_count_total"] is None:
            insights_flags.append("missing_questionnaire")

        top_disqualifiers = _top_disqualifiers(atoms, question_key_freq)

        to_insert.append(
            [
                nct_id,
                args.pipeline,
                input_hash,
                strictness_score,
                burden_score,
                novelty_score,
                logistics_score,
                trial["eligibility_text_len"],
                trial["bullet_count"],
                trial["bullet_count_primary"],
                trial["bullet_count_fallback"],
                _stable_json_dumps(top_disqualifiers),
                _stable_json_dumps(sorted(insights_flags)),
            ]
        )

        strictness_scores.append(strictness_score)
        burden_scores.append(burden_score)
        novelty_scores.append(novelty_score)
        logistics_scores.append(logistics_score)

        computed += 1

    if to_insert:
        con.executemany(
            """
            INSERT OR REPLACE INTO gold.pm_trial_insights
            (nct_id, pipeline_version, input_hash, strictness_score, burden_score, novelty_score,
             logistics_score, eligibility_text_len, bullet_count, bullet_count_primary, bullet_count_fallback,
             top_disqualifiers_json,
             insights_flags_json, generated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW());
            """,
            to_insert,
        )

    total_scanned = len(trials)
    pct_zero_primary = (zero_bullet_primary / total_scanned * 100.0) if total_scanned else 0.0
    pct_zero_final = (zero_bullet_count / total_scanned * 100.0) if total_scanned else 0.0
    print("\n".join([
                f"Scanned: {total_scanned}",
                f"Computed: {computed}",
                f"Skipped (cached): {skipped}",
                f"bullet_count_primary=0: {pct_zero_primary:.1f}%",
                f"bullet_count=0: {pct_zero_final:.1f}%",
                f"eligibility_text_len=0: {zero_text_len}",
                _summarize_percentiles("bullet_count_primary", bullet_primary_counts),
                _summarize_percentiles("bullet_count", bullet_counts),
                _summarize_percentiles("strictness", strictness_scores),
                _summarize_percentiles("burden", burden_scores),
                _summarize_percentiles("novelty", novelty_scores),
                _summarize_percentiles("logistics", logistics_scores),
                "Recommendation: use pipeline_version=pmq_v14_rule_tighten_2025_12_24 for reruns.",
            ]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
