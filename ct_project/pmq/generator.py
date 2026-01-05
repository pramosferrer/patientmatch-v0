"""
Questionnaire generation: combine structured AACT fields + deterministic extracted criteria.

Outputs:
- questionnaire_json: a list of instantiated questions with logic + provenance
- quality score + flags + readiness

No LLM calls.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple

from pmq.age_infer import infer_age_bounds
from pmq.question_bank import QuestionInstance, instantiate_question, question_priority, QUESTION_BANK
from pmq.rules import ExtractedCriterion, dedupe_criteria


@dataclass
class TrialRow:
    nct_id: str
    title: str
    phase: Optional[str]
    gender: Optional[str]
    min_age_years: Optional[float]
    max_age_years: Optional[float]
    healthy_volunteers: Optional[bool]

    conditions_display: List[str] = field(default_factory=list)
    condition_slugs: List[str] = field(default_factory=list)

    eligibility_hash: Optional[str] = None
    eligibility_text_clean: Optional[str] = None

    adult: Optional[bool] = None
    child: Optional[bool] = None
    older_adult: Optional[bool] = None


@dataclass
class QuestionnaireResult:
    nct_id: str
    pipeline_version: str
    eligibility_hash: Optional[str]
    questionnaire: Dict[str, Any]
    question_count: int
    clinic_only_count: int
    quality_score: int
    quality_flags: List[str]
    readiness: str
    extraction_stats: Dict[str, Any] = field(default_factory=dict)
    criteria: List[Dict[str, Any]] = field(default_factory=list)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm_gender(gender: Optional[str]) -> Optional[str]:
    if gender is None:
        return None
    g = gender.strip().lower()
    if g in ("all", "any"):
        return "ALL"
    if g in ("male", "m"):
        return "MALE"
    if g in ("female", "f"):
        return "FEMALE"
    return gender.strip().upper()


def _should_ask_reproductive(
    trial: TrialRow,
    criteria: Sequence[ExtractedCriterion],
    *,
    min_age_years: Optional[float] = None,
    max_age_years: Optional[float] = None,
) -> bool:
    g = _norm_gender(trial.gender)
    if g == "MALE":
        return False

    keys = {c.question_key for c in criteria}
    if any(k in keys for k in ("pregnant", "breastfeeding", "willing_contraception", "pregnancy_test_ok")):
        return True

    max_age = max_age_years if max_age_years is not None else trial.max_age_years
    min_age = min_age_years if min_age_years is not None else trial.min_age_years

    if max_age is not None and max_age < 12:
        return False
    if min_age is not None and min_age > 55:
        return False

    return g in ("ALL", "FEMALE", None)


def _conditions_options(conditions_display: Sequence[str], max_options: int = 20) -> Tuple[List[str], List[str]]:
    flags: List[str] = []
    opts = [c for c in conditions_display if c and isinstance(c, str)]
    seen = set()
    out = []
    for o in opts:
        key = o.lower().strip()
        if key in seen:
            continue
        seen.add(key)
        out.append(o)
    if len(out) == 0:
        return ([], ["missing_conditions"])
    if len(out) > max_options:
        flags.append("conditions_truncated")
        if max_options >= 2:
            out = out[: max_options - 1]
            out.append("Other (not listed)")
        else:
            out = out[:max_options]
    return (out, flags)


def _build_logic_for_age(min_age_years: Optional[float], max_age_years: Optional[float]) -> List[Dict[str, Any]]:
    logic: List[Dict[str, Any]] = []
    if min_age_years is not None or max_age_years is not None:
        logic.append({"type": "range_years", "min": min_age_years, "max": max_age_years})
    return logic


def _build_logic_for_gender(trial: TrialRow) -> List[Dict[str, Any]]:
    g = _norm_gender(trial.gender)
    if g == "ALL" or g is None:
        return []
    return [{"type": "allowed_values", "values": ["Female"] if g == "FEMALE" else ["Male"]}]


def _build_logic_from_criterion(c: ExtractedCriterion) -> List[Dict[str, Any]]:
    entry: Dict[str, Any] = {"type": "criterion", "kind": c.kind, "section": c.section}
    if c.qualifies_when is not None:
        entry["qualifies_when"] = c.qualifies_when
    if c.disqualify_when is not None:
        entry["disqualify_when"] = c.disqualify_when
    if c.params:
        entry["params"] = c.params
    return [entry]


def _pick_params_for_question(criteria: Sequence[ExtractedCriterion]) -> Tuple[Dict[str, Any], bool]:
    best_params: Dict[str, Any] = {}
    best_score: Optional[int] = None

    windows: List[Tuple[int, Dict[str, Any], ExtractedCriterion]] = []
    signatures: set = set()
    for c in criteria:
        params = c.params or {}
        sig = _window_signature(params)
        if sig is not None:
            signatures.add(sig)
        if "window_days" in params:
            try:
                days = int(params["window_days"])
            except (TypeError, ValueError):
                continue
            windows.append((days, dict(params), c))

    mismatch = len(signatures) > 1

    if windows:
        is_exclusion = any(
            c.section == "exclusion" or c.disqualify_when == "Yes"
            for _, _, c in windows
        )
        target_days = min(w[0] for w in windows) if is_exclusion else max(w[0] for w in windows)
        candidates = [w for w in windows if w[0] == target_days]
        best_params = max(candidates, key=lambda w: (len(w[1]), w[0]))[1]
        return best_params, mismatch

    for c in criteria:
        params = c.params or {}
        score = 0
        if "window_value" in params and "window_unit" in params:
            try:
                score = 50000 + int(params["window_value"])
            except (TypeError, ValueError):
                score = 50000
        elif params:
            score = 1000 + len(params)
        if best_score is None or score > best_score:
            best_score = score
            best_params = dict(params)
    return best_params, mismatch


def _append_source(q: QuestionInstance, source: str) -> None:
    if source not in q.sources:
        q.sources.append(source)


def _question_to_dict(
    q: QuestionInstance,
    *,
    criteria_by_qkey: Dict[str, List[ExtractedCriterion]],
    structured_keys: Sequence[str],
    default_profile_keys: Sequence[str],
) -> Dict[str, Any]:
    qkey = q.question_key
    criteria_list = criteria_by_qkey.get(qkey) or []
    if criteria_list:
        origin = "criteria"
    elif qkey in structured_keys:
        origin = "structured"
    else:
        origin = "default_profile" if qkey in default_profile_keys else "default_profile"

    if origin == "default_profile":
        _append_source(q, "policy:default_profile_v1")

    out = q.to_dict()
    out["origin"] = origin
    if len(q.logic) > 1:
        out["logic_operator"] = "AND"
    return out


def _window_signature(params: Dict[str, Any]) -> Optional[Tuple[str, Any]]:
    if "window_days" in params:
        return ("window_days", params.get("window_days"))
    if "window_value" in params and "window_unit" in params:
        return ("window_value_unit", (params.get("window_value"), params.get("window_unit")))
    return None


def _priority_sort_keys(keys: Sequence[str]) -> List[str]:
    return sorted(keys, key=lambda k: (question_priority(k), k))


def _answerability_rank(question_key: str) -> int:
    spec = QUESTION_BANK.get(question_key)
    if spec is None:
        return 0
    value = getattr(spec, "answerability", "patient")
    return {"patient": 0, "records": 1, "clinician": 2}.get(value, 1)


def generate_questionnaire(
    trial: TrialRow,
    criteria_raw: Sequence[ExtractedCriterion],
    *,
    pipeline_version: str,
    extraction_stats: Optional[Dict[str, Any]] = None,
    max_questions: int = 15,
    max_clinic_only: int = 5,
    profile_in_main: bool = True,
) -> QuestionnaireResult:
    flags: List[str] = []

    criteria = dedupe_criteria(criteria_raw)

    questions: Dict[str, QuestionInstance] = {}

    age_min_years, age_max_years, age_flags = infer_age_bounds(trial)
    flags.extend(age_flags)

    # Age
    age_validation = {}
    if "age_multi_cohort" not in age_flags:
        if age_min_years is not None:
            age_validation["min"] = age_min_years
        if age_max_years is not None:
            age_validation["max"] = age_max_years

    age_sources = ["structured:eligibilities.minimum_age", "structured:eligibilities.maximum_age"]
    if "inferred_age_from_text" in age_flags:
        age_sources.append("inferred:eligibility_text_clean")
    if "inferred_age_from_flags" in age_flags:
        age_sources.append("inferred:eligibilities.age_flags")
    if "age_multi_cohort" in age_flags:
        age_sources.append("inferred:eligibility_text_clean")

    q_age = instantiate_question(
        "age_years",
        required=True,
        validation_override=age_validation,
        logic=_build_logic_for_age(None, None) if "age_multi_cohort" in age_flags else _build_logic_for_age(age_min_years, age_max_years),
        sources=age_sources,
    )
    questions[q_age.question_key] = q_age

    # Sex at birth
    q_sex = instantiate_question(
        "sex_at_birth",
        required=True,
        logic=_build_logic_for_gender(trial),
        sources=["structured:eligibilities.gender"],
    )
    questions[q_sex.question_key] = q_sex
    if _norm_gender(trial.gender) is None:
        flags.append("missing_gender")

    # Diagnosis
    cond_opts, cond_flags = _conditions_options(trial.conditions_display)
    if cond_opts:
        if "None of the above" not in cond_opts:
            cond_opts.append("None of the above")
        if "Not sure" not in cond_opts:
            cond_opts.append("Not sure")
        flags.extend(cond_flags)
        q_dx = instantiate_question(
            "diagnosis_confirmed",
            required=True,
            options_override=cond_opts,
            logic=[{"type": "provenance", "source": "structured:studies.conditions_display"}],
            sources=["structured:studies.conditions_display"],
        )
        questions[q_dx.question_key] = q_dx
    else:
        flags.append("missing_conditions_display")

    # Healthy volunteers
    if trial.healthy_volunteers is True:
        questions["healthy_volunteer"] = instantiate_question(
            "healthy_volunteer",
            required=True,
            logic=[{"type": "equals", "value": "Yes"}],
            sources=["structured:eligibilities.healthy_volunteers"],
        )

    # Reproductive
    if _should_ask_reproductive(trial, criteria, min_age_years=age_min_years, max_age_years=age_max_years):
        questions.setdefault("pregnant", instantiate_question("pregnant", required=False, sources=["rules_or_heuristics:reproductive"]))
        questions.setdefault("breastfeeding", instantiate_question("breastfeeding", required=False, sources=["rules_or_heuristics:reproductive"]))

    criteria_by_qkey: Dict[str, List[ExtractedCriterion]] = {}
    for c in criteria:
        criteria_by_qkey.setdefault(c.question_key, []).append(c)

    multi_constraints = False
    multi_time_windows = False
    for criteria_list in criteria_by_qkey.values():
        if len(criteria_list) > 1:
            multi_constraints = True
            window_sigs = set()
            for c in criteria_list:
                sig = _window_signature(c.params)
                if sig is not None:
                    window_sigs.add(sig)
            if len(window_sigs) > 1:
                multi_time_windows = True

    patient_keys: List[str] = []
    clinic_keys: List[str] = []

    unknown_question_keys: List[str] = []
    for qkey, criteria_list in criteria_by_qkey.items():
        if qkey not in QUESTION_BANK and qkey not in questions:
            unknown_question_keys.append(qkey)
            continue
        if qkey in questions:
            q = questions[qkey]
            for c in criteria_list:
                q.logic.extend(_build_logic_from_criterion(c))
                _append_source(q, f"rule:{c.rule_id}")
            continue
        is_clinic_only = all(c.clinic_only for c in criteria_list)
        (clinic_keys if is_clinic_only else patient_keys).append(qkey)

    window_mismatch_keys: List[str] = []
    for qkey in _priority_sort_keys(patient_keys):
        criteria_list = criteria_by_qkey[qkey]
        logic = [entry for c in criteria_list for entry in _build_logic_from_criterion(c)]
        picked_params, mismatch = _pick_params_for_question(criteria_list)
        if mismatch:
            window_mismatch_keys.append(qkey)
        questions[qkey] = instantiate_question(
            qkey,
            params=picked_params or None,
            required=False,
            clinic_only=False,
            logic=logic,
            sources=list(dict.fromkeys([f"rule:{c.rule_id}" for c in criteria_list])),
        )

    for qkey in _priority_sort_keys(clinic_keys):
        criteria_list = criteria_by_qkey[qkey]
        logic = [entry for c in criteria_list for entry in _build_logic_from_criterion(c)]
        picked_params, mismatch = _pick_params_for_question(criteria_list)
        if mismatch:
            window_mismatch_keys.append(qkey)
        questions[qkey] = instantiate_question(
            qkey,
            params=picked_params or None,
            required=False,
            clinic_only=True,
            logic=logic,
            sources=list(dict.fromkeys([f"rule:{c.rule_id}" for c in criteria_list])),
        )

    # BMI UX: include both height+weight together
    if "height_cm" in questions or "weight_kg" in questions:
        questions.setdefault("height_cm", instantiate_question("height_cm", required=False, sources=["rules:anthropometrics"]))
        questions.setdefault("weight_kg", instantiate_question("weight_kg", required=False, sources=["rules:anthropometrics"]))

    structured_keys = ["age_years", "sex_at_birth", "diagnosis_confirmed", "healthy_volunteer"]
    default_profile_keys = [
        "pregnant",
        "breastfeeding",
        "willing_contraception",
        "pregnancy_test_ok",
        "height_cm",
        "weight_kg",
    ]
    profile_question_keys = {
        "age_years",
        "sex_at_birth",
        "diagnosis_confirmed",
        "diagnosis_list",
        "healthy_volunteer",
    }

    criteria_keys = set(criteria_by_qkey.keys())
    profile_keys = [k for k in questions.keys() if k in profile_question_keys]
    non_profile_keys = [k for k in questions.keys() if k not in profile_question_keys]

    criteria_patient_keys = _priority_sort_keys(
        [k for k in non_profile_keys if k in criteria_keys and not questions[k].clinic_only]
    )
    criteria_clinic_keys = _priority_sort_keys(
        [k for k in non_profile_keys if k in criteria_keys and questions[k].clinic_only]
    )
    noncriteria_keys = _priority_sort_keys([k for k in non_profile_keys if k not in criteria_keys])
    profile_keys = _priority_sort_keys(profile_keys)

    ordered_keys = criteria_patient_keys + criteria_clinic_keys + noncriteria_keys + profile_keys
    budget_keys = ordered_keys if profile_in_main else [k for k in ordered_keys if k not in profile_question_keys]
    question_count_total = len(budget_keys)

    keep_set = set(budget_keys)
    if len(budget_keys) > max_questions:
        ordered_index = {k: i for i, k in enumerate(ordered_keys)}
        ranked_budget = sorted(
            budget_keys,
            key=lambda k: (
                _answerability_rank(k),
                question_priority(k),
                questions[k].clinic_only,
                ordered_index.get(k, 0),
                k,
            ),
        )
        keep_set = set(ranked_budget[:max_questions])
        if profile_in_main:
            keep_set.update(["age_years", "sex_at_birth", "diagnosis_confirmed"])

    keep_keys = [k for k in budget_keys if k in keep_set]
    clinic_only_keys = [k for k in keep_keys if questions[k].clinic_only]
    if len(clinic_only_keys) > max_clinic_only:
        excess = set(clinic_only_keys[max_clinic_only:])
        keep_keys = [k for k in keep_keys if k not in excess]

    optional_keys = [k for k in ordered_keys if k not in keep_keys]

    question_list = [
        _question_to_dict(
            questions[k],
            criteria_by_qkey=criteria_by_qkey,
            structured_keys=structured_keys,
            default_profile_keys=default_profile_keys,
        )
        for k in keep_keys
    ]
    optional_question_list = [
        _question_to_dict(
            questions[k],
            criteria_by_qkey=criteria_by_qkey,
            structured_keys=structured_keys,
            default_profile_keys=default_profile_keys,
        )
        for k in optional_keys
    ]
    criteria_in_optional = [q.get("question_key") for q in optional_question_list if q.get("origin") == "criteria"]
    if criteria_in_optional:
        flags.append("criteria_in_optional_questions")
    if window_mismatch_keys:
        flags.append("window_mismatch_rendered")
    extracted_keys_present = set(criteria_by_qkey.keys())
    questionnaire_criteria_keys = {
        q.get("question_key")
        for q in question_list + optional_question_list
        if q.get("origin") == "criteria"
    }
    criteria_origin_missing_keys = sorted(k for k in extracted_keys_present if k not in questionnaire_criteria_keys)
    if criteria_origin_missing_keys:
        flags.append("criteria_origin_missing_keys")
    question_count = len(question_list)
    clinic_only_count = sum(1 for q in question_list if q.get("clinic_only"))
    optional_question_count = len(optional_question_list)

    # Quality scoring (stable + explainable)
    score = 100

    if extraction_stats:
        total_bullets = int(extraction_stats.get("total_bullets") or 0)
        coverage_ratio = float(extraction_stats.get("coverage_ratio") or 0.0)
        atom_count = int(extraction_stats.get("atom_count") or 0)
        criteria_count = int(extraction_stats.get("criteria_count") or 0)
        hit_count = max(atom_count, criteria_count)
        if total_bullets >= 10 and coverage_ratio < 0.10 and hit_count < 3:
            flags.append("low_rule_coverage")
            score -= 10
        elif total_bullets >= 10 and coverage_ratio < 0.20 and hit_count < 3:
            flags.append("moderate_rule_coverage")
            score -= 5

    extracted_qkeys = {c.question_key for c in criteria}
    extracted_qkeys -= {"pregnant", "breastfeeding", "willing_contraception", "pregnancy_test_ok"}
    total_bullets = int(extraction_stats.get("total_bullets") or 0) if extraction_stats else 0
    if len(extracted_qkeys) == 0:
        flags.append("few_extracted_criteria")
    elif len(extracted_qkeys) < 2:
        flags.append("few_extracted_criteria")
    elif len(extracted_qkeys) < 4:
        flags.append("some_extracted_criteria")

    critical_missing = []
    if not cond_opts and trial.healthy_volunteers is not True:
        critical_missing.append("missing_conditions")
    if _norm_gender(trial.gender) is None:
        critical_missing.append("missing_gender")
    if "missing_age_bounds" in flags:
        critical_missing.append("missing_age_bounds")
    if "age_years" not in questions:
        critical_missing.append("missing_age_question")

    if critical_missing:
        for f in critical_missing:
            if f not in flags:
                flags.append(f)
        score -= 25

    if multi_constraints and "multi_constraints_same_question" not in flags:
        flags.append("multi_constraints_same_question")
        score -= 2
    if multi_time_windows and "multi_time_windows_same_question" not in flags:
        flags.append("multi_time_windows_same_question")
        score -= 2

    if question_count > 15:
        score -= (question_count - 15) * 3
    if clinic_only_count > max_clinic_only:
        score -= (clinic_only_count - max_clinic_only) * 5
    score = max(0, min(100, score))

    readiness = "High"
    if score < 70 or any(f.startswith("missing_") for f in critical_missing):
        readiness = "Low" if score < 70 else "Medium"
    elif score < 85:
        readiness = "Medium"
    if readiness == "High" and "age_bounds_conflict" in flags:
        readiness = "Medium"

    coverage_ratio = float(extraction_stats.get("coverage_ratio") or 0.0) if extraction_stats else 0.0
    atom_count = int(extraction_stats.get("atom_count") or 0) if extraction_stats else 0
    criteria_count = int(extraction_stats.get("criteria_count") or 0) if extraction_stats else 0
    tier1_count = int(extraction_stats.get("tier1_count") or 0) if extraction_stats else 0
    tier2_count = int(extraction_stats.get("tier2_count") or 0) if extraction_stats else 0

    qjson = {
        "nct_id": trial.nct_id,
        "pipeline_version": pipeline_version,
        "generated_at": _now_iso(),
        "trial_context": {
            "title": trial.title,
            "phase": trial.phase,
            "gender": _norm_gender(trial.gender),
            "min_age_years": age_min_years,
            "max_age_years": age_max_years,
            "healthy_volunteers": trial.healthy_volunteers,
            "conditions_display": trial.conditions_display,
            "condition_slugs": trial.condition_slugs,
        },
        "extraction_metrics": {
            "extracted_question_keys_count": len(extracted_qkeys),
            "coverage_ratio": coverage_ratio,
            "atom_count": atom_count,
            "criteria_count": criteria_count,
            "tier1_count": tier1_count,
            "tier2_count": tier2_count,
        },
        "questions": question_list,
        "optional_questions": optional_question_list,
        "question_count_total": question_count_total,
        "optional_question_count": optional_question_count,
    }
    if criteria_in_optional:
        qjson["extraction_metrics"]["criteria_in_optional_keys"] = criteria_in_optional[:50]
        qjson["extraction_metrics"]["criteria_in_optional_count"] = len(criteria_in_optional)
    if window_mismatch_keys:
        qjson["extraction_metrics"]["window_mismatch_keys"] = sorted(set(window_mismatch_keys))
        qjson["extraction_metrics"]["window_mismatch_count"] = len(set(window_mismatch_keys))
    if unknown_question_keys:
        flags.append("unknown_question_keys")
        qjson["extraction_metrics"]["unknown_question_keys"] = sorted(set(unknown_question_keys))
    if criteria_origin_missing_keys:
        qjson["extraction_metrics"]["criteria_origin_missing_keys"] = criteria_origin_missing_keys

    criteria_json = []
    for c in criteria_raw:
        criteria_json.append({
            "criterion_id": c.criterion_id,
            "section": c.section,
            "question_key": c.question_key,
            "kind": c.kind,
            "qualifies_when": c.qualifies_when,
            "disqualify_when": c.disqualify_when,
            "params": c.params,
            "clinic_only": c.clinic_only,
            "rule_id": c.rule_id,
            "evidence": c.evidence,
        })

    return QuestionnaireResult(
        nct_id=trial.nct_id,
        pipeline_version=pipeline_version,
        eligibility_hash=trial.eligibility_hash,
        questionnaire=qjson,
        question_count=question_count,
        clinic_only_count=clinic_only_count,
        quality_score=score,
        quality_flags=sorted(set(flags)),
        readiness=readiness,
        extraction_stats=extraction_stats or {},
        criteria=criteria_json,
    )
