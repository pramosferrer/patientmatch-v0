"""
Canonical question bank for PatientMatch questionnaires.

Design goals:
- Stable question_key identifiers (used for dedupe and future analytics).
- Patient-first wording, with optional templating for time windows and thresholds.
- Deterministic: no LLM required for core and common criteria.
"""

from __future__ import annotations

import re

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Literal, Mapping, Optional, Sequence

AnswerType = Literal["number", "boolean", "single_select", "multi_select", "text"]
Answerability = Literal["patient", "records", "clinician"]
UnknownPolicy = Literal["pass", "fail", "needs_review"]
ExclusionStrength = Literal["hard_exclude", "soft_exclude", "context"]


@dataclass(frozen=True)
class QuestionSpec:
    """Definition of a canonical question."""
    question_key: str
    text_template: str
    answer_type: AnswerType
    help_text: Optional[str] = None

    # Select options (for single_select / multi_select).
    options: Optional[List[str]] = None

    # Default UX behavior. Generator may override.
    required_default: bool = False
    clinic_only_default: bool = False

    # Optional validation hints (min/max/range/unit).
    validation: Dict[str, Any] = field(default_factory=dict)

    # A rough priority (lower number = earlier in questionnaire)
    priority: int = 100

    # Answerability + audit metadata (used for trimming tie-breakers + analysis).
    answerability: Answerability = "patient"
    unknown_policy: UnknownPolicy = "needs_review"
    strength: ExclusionStrength = "context"
    aliases: List[str] = field(default_factory=list)
    concept_id: Optional[str] = None

    def render_text(self, params: Optional[Mapping[str, Any]] = None) -> str:
        params = params or {}
        try:
            return self.text_template.format(**params)
        except KeyError:
            return self.text_template


@dataclass
class QuestionInstance:
    """A trial-specific instantiated question."""
    question_key: str
    text: str
    answer_type: AnswerType
    help_text: Optional[str] = None
    options: Optional[List[str]] = None
    required: bool = False
    clinic_only: bool = False
    validation: Dict[str, Any] = field(default_factory=dict)

    # Eligibility logic snippets that reference this question (stored for insight + later matching).
    logic: List[Dict[str, Any]] = field(default_factory=list)

    # Provenance: what triggered this question (structured field or which rule/criterion).
    sources: List[str] = field(default_factory=list)
    template_missing_params: bool = False
    template_expected_params: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if not d.get("help_text"):
            d.pop("help_text", None)
        if not d.get("options"):
            d.pop("options", None)
        if not d.get("validation"):
            d.pop("validation", None)
        if not d.get("logic"):
            d.pop("logic", None)
        if not d.get("sources"):
            d.pop("sources", None)
        if not d.get("template_missing_params"):
            d.pop("template_missing_params", None)
        if not d.get("template_expected_params"):
            d.pop("template_expected_params", None)
        return d


SEX_OPTIONS = ["Female", "Male", "Intersex", "Prefer not to say"]
YES_NO_NS = ["Yes", "No", "Not sure"]
SMOKING_OPTIONS = ["Never", "Former", "Current", "Not sure"]

# Patient-friendly ECOG mapping based on standard ECOG definitions.
ECOG_ACTIVITY_OPTIONS = [
    "Fully active, able to do all normal activities",
    "Limited in strenuous activity but can do light work",
    "Able to care for myself but unable to work; up and about more than half the day",
    "Need help with self-care; in bed or a chair more than half the day",
    "Completely disabled; cannot carry out self-care",
]


def with_not_sure_help(base: Optional[str] = None) -> str:
    extra = "If you're not sure, choose 'Not sure'."
    if not base:
        return extra
    if "not sure" in base.lower():
        return base
    return f"{base} {extra}"


QUESTION_BANK: Dict[str, QuestionSpec] = {
    "physical_activity": QuestionSpec(
        question_key="physical_activity",
        text_template="How would you describe your current physical activity level?",
        answer_type="single_select",
        options=["Low (Sedentary)", "Moderate (Active)", "High (Very Active)", "Not sure"],
        help_text="This includes exercise and daily movement.",
    ),
    "cad_history": QuestionSpec(
        question_key="cad_history",
        text_template="Do you have a history of coronary artery disease or serious heart conditions?",
        answer_type="single_select",
        options=YES_NO_NS,
        help_text="Including heart attack, CHF, or stents.",
    ),
    "depression_diagnosis": QuestionSpec(
        question_key="depression_diagnosis",
        text_template="Have you ever been diagnosed with depression or a related mood disorder?",
        answer_type="single_select",
        options=YES_NO_NS,
    ),
    "insulin_treatment": QuestionSpec(
        question_key="insulin_treatment",
        text_template="Are you currently using insulin to manage your diabetes?",
        answer_type="single_select",
        options=["Yes, basal insulin", "Yes, non-basal insulin", "Yes, both", "No", "Not sure"],
    ),
    "condition_history": QuestionSpec(
        question_key="condition_history",
        text_template="Do you have a history of any other common medical conditions?",
        answer_type="multi_select",
        options=[
            "Asthma", "High Blood Pressure", "COPD", "Arthritis", "Thyroid",
            "Kidney Disease", "Stroke", "None of the above", "Not sure"
        ],
        clinic_only_default=True,
    ),

    # Core matching
    "age_years": QuestionSpec(
        question_key="age_years",
        text_template="How old are you?",
        help_text="In years.",
        answer_type="number",
        required_default=True,
        validation={"min": 0, "max": 120, "unit": "years"},
        priority=10,
    ),
    "sex_at_birth": QuestionSpec(
        question_key="sex_at_birth",
        text_template="What sex were you assigned at birth?",
        answer_type="single_select",
        options=SEX_OPTIONS,
        required_default=True,
        priority=20,
    ),
    "diagnosis_confirmed": QuestionSpec(
        question_key="diagnosis_confirmed",
        text_template="Which of these conditions have you been diagnosed with?",
        help_text="Select all that apply.",
        answer_type="multi_select",
        options=[],  # filled per trial from conditions_display
        required_default=True,
        priority=30,
    ),

    # Reproductive
    "pregnant": QuestionSpec(
        question_key="pregnant",
        text_template="Are you currently pregnant?",
        answer_type="single_select",
        options=YES_NO_NS,
        strength="hard_exclude",
        aliases=["pregnancy"],
        priority=40,
    ),
    "breastfeeding": QuestionSpec(
        question_key="breastfeeding",
        text_template="Are you breastfeeding right now?",
        help_text="This includes chestfeeding.",
        answer_type="single_select",
        options=YES_NO_NS,
        strength="hard_exclude",
        aliases=["breastfeeding", "lactation", "nursing"],
        priority=41,
    ),
    "willing_contraception": QuestionSpec(
        question_key="willing_contraception",
        text_template="If needed, would you use birth control during the study?",
        help_text="Only applies to some participants.",
        answer_type="single_select",
        options=YES_NO_NS,
        priority=42,
    ),
    "pregnancy_test_ok": QuestionSpec(
        question_key="pregnancy_test_ok",
        text_template="If needed, would you take pregnancy tests during the study?",
        help_text="Some studies require tests before starting and during the study.",
        answer_type="single_select",
        options=YES_NO_NS,
        priority=43,
    ),

    # Healthy volunteer
    "healthy_volunteer": QuestionSpec(
        question_key="healthy_volunteer",
        text_template="Are you a healthy volunteer?",
        help_text="Meaning no major ongoing medical problems.",
        answer_type="single_select",
        options=YES_NO_NS,
        required_default=False,
        priority=50,
    ),

    # Other trial participation / washout
    "currently_in_other_trial": QuestionSpec(
        question_key="currently_in_other_trial",
        text_template="Are you in another clinical trial that tests a treatment right now?",
        help_text="Not counting surveys or studies that only collect data.",
        answer_type="single_select",
        options=YES_NO_NS,
        strength="hard_exclude",
        aliases=["currently in other trial", "other interventional study"],
        priority=60,
    ),
    "recent_investigational_drug": QuestionSpec(
        question_key="recent_investigational_drug",
        text_template="In the last {window_value} {window_unit}, have you used any investigational treatment?",
        help_text="This includes a study drug, biologic, or device.",
        answer_type="single_select",
        options=YES_NO_NS,
        answerability="clinician",
        strength="hard_exclude",
        aliases=["investigational drug", "study drug", "investigational device"],
        priority=61,
    ),

    # Smoking / nicotine
    "smoking_status": QuestionSpec(
        question_key="smoking_status",
        text_template="Which best describes your tobacco or nicotine use?",
        help_text="Include vaping and nicotine pouches.",
        answer_type="single_select",
        options=SMOKING_OPTIONS,
        priority=70,
    ),

    # Medications (high-yield)
    "taking_anticoagulants": QuestionSpec(
        question_key="taking_anticoagulants",
        text_template="Do you take a blood thinner?",
        help_text="Examples: warfarin (Coumadin), apixaban (Eliquis), rivaroxaban (Xarelto), heparin.",
        answer_type="single_select",
        options=YES_NO_NS,
        priority=80,
    ),
    "taking_antiplatelets": QuestionSpec(
        question_key="taking_antiplatelets",
        text_template="Do you take a medicine to prevent blood clots?",
        help_text="Examples: clopidogrel (Plavix), ticagrelor (Brilinta), prasugrel (Effient). Do not count aspirin. If you're not sure, choose 'Not sure'.",
        answer_type="single_select",
        options=YES_NO_NS,
        priority=81,
    ),
    "taking_immunosuppressants": QuestionSpec(
        question_key="taking_immunosuppressants",
        text_template="Do you take medicines that weaken your immune system?",
        help_text="Examples: medicines after an organ transplant, or some treatments for autoimmune diseases.",
        answer_type="single_select",
        options=YES_NO_NS,
        priority=82,
    ),
    "taking_systemic_steroids": QuestionSpec(
        question_key="taking_systemic_steroids",
        text_template="Do you take steroid medicines on most days?",
        help_text="Example: prednisone.",
        answer_type="single_select",
        options=YES_NO_NS,
        priority=83,
    ),

    # Recent treatments / procedures
    "recent_cancer_therapy": QuestionSpec(
        question_key="recent_cancer_therapy",
        text_template="In the last {window_value} {window_unit}, have you had cancer treatment?",
        help_text=with_not_sure_help("Examples: chemotherapy, radiation, immunotherapy."),
        answer_type="single_select",
        options=YES_NO_NS,
        clinic_only_default=False,
        strength="soft_exclude",
        aliases=["chemotherapy", "radiation", "immunotherapy", "cancer treatment"],
        priority=90,
    ),
    "recent_major_surgery": QuestionSpec(
        question_key="recent_major_surgery",
        text_template="Have you had major surgery in the last {window_value} {window_unit}?",
        answer_type="single_select",
        options=YES_NO_NS,
        priority=91,
    ),

    # Comorbidities (many are clinic-only)
    "uncontrolled_hypertension": QuestionSpec(
        question_key="uncontrolled_hypertension",
        text_template="Has a clinician told you that you have uncontrolled high blood pressure?",
        answer_type="single_select",
        options=YES_NO_NS,
        priority=100,
    ),
    "uncontrolled_diabetes": QuestionSpec(
        question_key="uncontrolled_diabetes",
        text_template="Do you have diabetes that is not well controlled?",
        help_text="If you're not sure, choose 'Not sure'.",
        answer_type="single_select",
        options=YES_NO_NS,
        priority=101,
    ),
    "recent_cardiovascular_event": QuestionSpec(
        question_key="recent_cardiovascular_event",
        text_template="Have you had a heart attack, stroke, or similar serious heart/brain event in the last {window_value} {window_unit}?",
        help_text=with_not_sure_help(),
        answer_type="single_select",
        options=YES_NO_NS,
        clinic_only_default=False,
        unknown_policy="needs_review",
        strength="hard_exclude",
        aliases=["heart attack", "stroke", "cardiovascular event"],
        priority=102,
    ),
    "kidney_disease_dialysis": QuestionSpec(
        question_key="kidney_disease_dialysis",
        text_template="Do you have severe kidney disease or are you on dialysis?",
        help_text=with_not_sure_help(),
        answer_type="single_select",
        options=YES_NO_NS,
        clinic_only_default=False,
        unknown_policy="needs_review",
        strength="hard_exclude",
        aliases=["dialysis", "renal failure", "kidney failure"],
        priority=103,
    ),
    "liver_disease": QuestionSpec(
        question_key="liver_disease",
        text_template="Do you have severe liver disease?",
        help_text=with_not_sure_help("Examples: cirrhosis or liver failure."),
        answer_type="single_select",
        options=YES_NO_NS,
        clinic_only_default=False,
        unknown_policy="needs_review",
        strength="context",
        aliases=["cirrhosis", "hepatic failure", "liver failure"],
        priority=104,
    ),
    "hiv_or_hepatitis": QuestionSpec(
        question_key="hiv_or_hepatitis",
        text_template="Have you been diagnosed with HIV or hepatitis B or C?",
        help_text=with_not_sure_help(),
        answer_type="single_select",
        options=YES_NO_NS,
        clinic_only_default=False,
        unknown_policy="needs_review",
        strength="context",
        aliases=["hiv", "hepatitis b", "hepatitis c", "hbv", "hcv"],
        priority=105,
    ),
    "active_infection": QuestionSpec(
        question_key="active_infection",
        text_template="Are you taking medicine for an infection right now?",
        help_text=with_not_sure_help("Examples: antibiotics or antivirals."),
        answer_type="single_select",
        options=YES_NO_NS,
        clinic_only_default=False,
        unknown_policy="needs_review",
        strength="soft_exclude",
        aliases=["infection", "antibiotics", "antivirals"],
        priority=106,
    ),
    "organ_transplant": QuestionSpec(
        question_key="organ_transplant",
        text_template="Have you ever had an organ transplant?",
        help_text=with_not_sure_help(),
        answer_type="single_select",
        options=YES_NO_NS,
        clinic_only_default=False,
        unknown_policy="needs_review",
        strength="hard_exclude",
        aliases=["organ transplant", "transplant"],
        priority=107,
    ),
    "prior_malignancy_recent": QuestionSpec(
        question_key="prior_malignancy_recent",
        text_template="Have you had another cancer diagnosis in the last {window_value} {window_unit}?",
        help_text=with_not_sure_help(),
        answer_type="single_select",
        options=YES_NO_NS,
        clinic_only_default=False,
        strength="soft_exclude",
        aliases=["prior malignancy", "prior cancer", "second cancer"],
        priority=108,
    ),

    # Performance status (patient-friendly approximation)
    "ecog_activity": QuestionSpec(
        question_key="ecog_activity",
        text_template="Which best describes your daily activity right now?",
        help_text="This helps estimate how active you are day to day.",
        answer_type="single_select",
        options=ECOG_ACTIVITY_OPTIONS,
        priority=110,
    ),

    # Anthropometrics
    "height_cm": QuestionSpec(
        question_key="height_cm",
        text_template="What is your height?",
        help_text="In centimeters.",
        answer_type="number",
        validation={"min": 50, "max": 250, "unit": "cm"},
        answerability="patient",
        priority=120,
    ),
    "weight_kg": QuestionSpec(
        question_key="weight_kg",
        text_template="What is your weight?",
        help_text="In kilograms.",
        answer_type="number",
        validation={"min": 20, "max": 300, "unit": "kg"},
        answerability="patient",
        priority=121,
    ),
    "bmi": QuestionSpec(
        question_key="bmi",
        text_template="What is your body mass index (BMI)?",
        help_text="If you know it.",
        answer_type="number",
        validation={"min": 10, "max": 80, "unit": "kg/m2"},
        answerability="patient",
        priority=122,
    ),

    # Vitals and labs (patient-reportable)
    "systolic_bp": QuestionSpec(
        question_key="systolic_bp",
        text_template="What is your systolic blood pressure (top number)?",
        answer_type="number",
        validation={"min": 70, "max": 220, "unit": "mmHg"},
        answerability="records",
        priority=130,
    ),
    "diastolic_bp": QuestionSpec(
        question_key="diastolic_bp",
        text_template="What is your diastolic blood pressure (bottom number)?",
        answer_type="number",
        validation={"min": 40, "max": 140, "unit": "mmHg"},
        answerability="records",
        priority=131,
    ),
    "hba1c_percent": QuestionSpec(
        question_key="hba1c_percent",
        text_template="What is your most recent HbA1c?",
        help_text="Percent value, if you know it.",
        answer_type="number",
        validation={"min": 3, "max": 20, "unit": "percent"},
        answerability="records",
        priority=140,
    ),
    "egfr": QuestionSpec(
        question_key="egfr",
        text_template="What is your most recent eGFR?",
        help_text="If you know it.",
        answer_type="number",
        validation={"min": 0, "max": 200, "unit": "mL/min"},
        answerability="records",
        priority=141,
    ),
    "creatinine_mg_dl": QuestionSpec(
        question_key="creatinine_mg_dl",
        text_template="What is your most recent creatinine?",
        help_text="If you know it.",
        answer_type="number",
        validation={"min": 0, "max": 20, "unit": "mg/dL"},
        answerability="records",
        priority=142,
    ),
    "ast_u_l": QuestionSpec(
        question_key="ast_u_l",
        text_template="What is your most recent AST (U/L)?",
        help_text="If you know it.",
        answer_type="number",
        validation={"min": 0, "max": 1000, "unit": "U/L"},
        answerability="records",
        priority=143,
    ),
    "alt_u_l": QuestionSpec(
        question_key="alt_u_l",
        text_template="What is your most recent ALT (U/L)?",
        help_text="If you know it.",
        answer_type="number",
        validation={"min": 0, "max": 1000, "unit": "U/L"},
        answerability="records",
        priority=144,
    ),
    "bilirubin_mg_dl": QuestionSpec(
        question_key="bilirubin_mg_dl",
        text_template="What is your most recent bilirubin?",
        help_text="If you know it.",
        answer_type="number",
        validation={"min": 0, "max": 50, "unit": "mg/dL"},
        answerability="records",
        priority=145,
    ),
    "hemoglobin_g_dl": QuestionSpec(
        question_key="hemoglobin_g_dl",
        text_template="What is your most recent hemoglobin?",
        help_text="If you know it.",
        answer_type="number",
        validation={"min": 3, "max": 25, "unit": "g/dL"},
        answerability="records",
        priority=146,
    ),
    "anc": QuestionSpec(
        question_key="anc",
        text_template="What is your most recent absolute neutrophil count (ANC)?",
        help_text="If you know it.",
        answer_type="number",
        validation={"min": 0, "max": 20000, "unit": "cells/uL"},
        answerability="records",
        priority=147,
    ),
    "platelets": QuestionSpec(
        question_key="platelets",
        text_template="What is your most recent platelet count?",
        help_text="If you know it.",
        answer_type="number",
        validation={"min": 0, "max": 1000000, "unit": "cells/uL"},
        answerability="records",
        priority=148,
    ),
    "qtc_ms": QuestionSpec(
        question_key="qtc_ms",
        text_template="What is your QTc interval (milliseconds)?",
        help_text="If you know it.",
        answer_type="number",
        validation={"min": 300, "max": 700, "unit": "ms"},
        answerability="records",
        priority=149,
    ),
    # Clinic-only / investigator judgement (tier-2 rules)
    "abnormal_labs": QuestionSpec(
        question_key="abnormal_labs",
        text_template="Have you been told you have abnormal lab test results?",
        help_text="If you're not sure, choose 'Not sure'.",
        answer_type="single_select",
        options=YES_NO_NS,
        clinic_only_default=True,
        answerability="clinician",
        strength="context",
        priority=200,
    ),
    "ecg_abnormal": QuestionSpec(
        question_key="ecg_abnormal",
        text_template="Have you been told you have an abnormal ECG (EKG)?",
        help_text="If you're not sure, choose 'Not sure'.",
        answer_type="single_select",
        options=YES_NO_NS,
        clinic_only_default=True,
        answerability="clinician",
        strength="context",
        priority=201,
    ),
    "mri_contraindication": QuestionSpec(
        question_key="mri_contraindication",
        text_template="Do you have any reason you cannot get an MRI scan?",
        help_text="Examples: certain implanted devices (pacemaker), metal fragments, or severe claustrophobia.",
        answer_type="single_select",
        options=YES_NO_NS,
        clinic_only_default=True,
        answerability="clinician",
        strength="context",
        priority=202,
    ),
    "unable_to_comply": QuestionSpec(
        question_key="unable_to_comply",
        text_template="Would you be able to attend study visits and follow study procedures?",
        help_text="If you're not sure, choose 'Not sure'.",
        answer_type="single_select",
        options=YES_NO_NS,
        clinic_only_default=True,
        answerability="clinician",
        strength="context",
        priority=203,
    ),
    "clinically_significant_condition": QuestionSpec(
        question_key="clinically_significant_condition",
        text_template="Has a clinician told you you have another serious condition that could make participation unsafe?",
        help_text="This is sometimes determined by the study doctor. If you're not sure, choose 'Not sure'.",
        answer_type="single_select",
        options=YES_NO_NS,
        clinic_only_default=True,
        answerability="clinician",
        strength="context",
        priority=204,
    ),
}


def get_question_spec(question_key: str) -> QuestionSpec:
    if question_key not in QUESTION_BANK:
        raise KeyError(f"Unknown question_key: {question_key}")
    return QUESTION_BANK[question_key]


_WINDOW_PLACEHOLDER_RE = re.compile(r"\{window_value\}|\{window_unit\}")
_TEMPLATE_PLACEHOLDER_RE = re.compile(r"\{([^}]+)\}")
_ALLOWED_PLACEHOLDERS = {"window_value", "window_unit"}
_WINDOW_REPLACEMENTS = [
    re.compile(r"(?i)in the last\s+\{window_value\}\s+\{window_unit\}"),
    re.compile(r"(?i)last\s+\{window_value\}\s+\{window_unit\}"),
    re.compile(r"(?i)in the past\s+\{window_value\}\s+\{window_unit\}"),
    re.compile(r"(?i)past\s+\{window_value\}\s+\{window_unit\}"),
    re.compile(r"(?i)within\s+\{window_value\}\s+\{window_unit\}"),
]


def _render_window_fallback(template: str) -> str:
    text = template
    for pat in _WINDOW_REPLACEMENTS:
        text = pat.sub("recently", text)
    text = text.replace("{window_value}", "").replace("{window_unit}", "")
    text = re.sub(r"\s+", " ", text).strip()
    return text

def _coerce_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        try:
            fval = float(value)
        except (TypeError, ValueError):
            return None
        return int(fval) if fval.is_integer() else None


def _format_window_unit(unit: str, value: Optional[int]) -> str:
    if not unit:
        return unit
    base = unit.lower()
    if base.endswith("s"):
        base = base[:-1]
    if value == 1:
        return base
    return f"{base}s"


def instantiate_question(
    question_key: str,
    *,
    params: Optional[Mapping[str, Any]] = None,
    required: Optional[bool] = None,
    clinic_only: Optional[bool] = None,
    options_override: Optional[Sequence[str]] = None,
    validation_override: Optional[Mapping[str, Any]] = None,
    logic: Optional[List[Dict[str, Any]]] = None,
    sources: Optional[List[str]] = None,
) -> QuestionInstance:
    spec = get_question_spec(question_key)

    render_params = dict(params) if params else {}
    if "window_value" in render_params and "window_unit" in render_params:
        value = _coerce_int(render_params.get("window_value"))
        if value is not None:
            render_params["window_unit"] = _format_window_unit(str(render_params.get("window_unit") or ""), value)

    uses_window = _WINDOW_PLACEHOLDER_RE.search(spec.text_template) is not None
    missing_window_params = uses_window and (render_params.get("window_value") is None or render_params.get("window_unit") is None)
    rendered_text = _render_window_fallback(spec.text_template) if missing_window_params else spec.render_text(params=render_params)
    expected_params = ["window_value", "window_unit"] if missing_window_params else []

    inst = QuestionInstance(
        question_key=question_key,
        text=rendered_text,
        help_text=spec.help_text,
        answer_type=spec.answer_type,
        options=list(options_override) if options_override is not None else (list(spec.options) if spec.options else None),
        required=spec.required_default if required is None else required,
        clinic_only=spec.clinic_only_default if clinic_only is None else clinic_only,
        validation=dict(spec.validation) if spec.validation else {},
        logic=list(logic) if logic else [],
        sources=list(sources) if sources else [],
        template_missing_params=missing_window_params,
        template_expected_params=expected_params,
    )

    if validation_override:
        inst.validation.update(dict(validation_override))

    if inst.answer_type in ("single_select", "multi_select") and inst.options is not None and len(inst.options) == 0:
        inst.options = None

    return inst


def question_priority(question_key: str) -> int:
    spec = QUESTION_BANK.get(question_key)
    return spec.priority if spec else 9999


def lint_question_bank_vs_rules(strict: bool = True) -> List[str]:
    missing = []
    from pmq.rules import DEFAULT_RULES  # local import to avoid cycles

    for rule in DEFAULT_RULES:
        qk = getattr(rule, "question_key", None)
        if qk and qk not in QUESTION_BANK:
            missing.append(qk)
    missing = sorted(set(missing))
    if missing and strict:
        raise ValueError(f"QUESTION_BANK missing keys from rules: {missing}")
    return missing


def lint_single_select_not_sure(strict: bool = True) -> List[str]:
    missing = []
    allowlist = {"sex_at_birth", "ecog_activity"}
    for key, spec in QUESTION_BANK.items():
        if spec.answer_type != "single_select":
            continue
        if spec.clinic_only_default:
            continue
        if key in allowlist:
            continue
        options = spec.options or []
        if "Not sure" not in options:
            missing.append(key)
    missing = sorted(set(missing))
    if missing and strict:
        raise ValueError(f"single_select questions missing 'Not sure': {missing}")
    return missing


def lint_template_placeholders(strict: bool = True) -> List[str]:
    issues = []
    for key, spec in QUESTION_BANK.items():
        placeholders = _TEMPLATE_PLACEHOLDER_RE.findall(spec.text_template)
        unknown = sorted(set(p for p in placeholders if p not in _ALLOWED_PLACEHOLDERS))
        if unknown:
            issues.append(f"{key}:{','.join(unknown)}")
    if issues and strict:
        raise ValueError(f"Unknown template placeholders detected: {issues}")
    return issues


def lint_answer_type_contract(strict: bool = True) -> List[str]:
    issues = []
    multi_select_dynamic = {"diagnosis_confirmed"}
    single_select_not_sure_exempt = {"sex_at_birth", "ecog_activity"}

    for key, spec in QUESTION_BANK.items():
        if spec.answer_type == "single_select":
            if not spec.options:
                issues.append(f"{key}:single_select_missing_options")
            if not spec.clinic_only_default and key not in single_select_not_sure_exempt:
                if not spec.options or "Not sure" not in spec.options:
                    issues.append(f"{key}:single_select_missing_not_sure")
        elif spec.answer_type == "multi_select":
            if key in multi_select_dynamic:
                continue
            if not spec.options:
                issues.append(f"{key}:multi_select_missing_options")
        elif spec.answer_type == "number":
            validation = spec.validation or {}
            if "min" not in validation or "max" not in validation:
                issues.append(f"{key}:number_missing_min_max")
            if "unit" not in validation:
                issues.append(f"{key}:number_missing_unit")

    if issues and strict:
        raise ValueError(f"Question bank contract lint failed: {issues}")
    return issues


def lint_priority_guardrails(strict: bool = True) -> List[str]:
    issues: List[str] = []
    core_keys = {"age_years", "sex_at_birth", "diagnosis_confirmed"}
    disqualifiers = {
        "prior_malignancy_recent",
        "active_infection",
        "organ_transplant",
        "hiv_or_hepatitis",
        "kidney_disease_dialysis",
        "recent_cardiovascular_event",
        "liver_disease",
        "recent_cancer_therapy",
    }
    for key in core_keys:
        spec = QUESTION_BANK.get(key)
        if spec and spec.priority > 60:
            issues.append(f"core_priority:{key}={spec.priority}")
    for key in disqualifiers:
        spec = QUESTION_BANK.get(key)
        if spec and spec.priority > 120:
            issues.append(f"disqualifier_priority:{key}={spec.priority}")
    for key, spec in QUESTION_BANK.items():
        if spec.answer_type != "number":
            continue
        if key == "age_years":
            continue
        if spec.priority < 120:
            issues.append(f"numeric_priority:{key}={spec.priority}")
    if issues and strict:
        raise ValueError(f"Question priority guardrails failed: {issues}")
    return issues
