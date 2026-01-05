"""
Deterministic eligibility criteria extraction rules.

These rules capture the most common patient-relevant eligibility concepts
and translate them into normalized criteria tied to canonical question_keys.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Sequence, Tuple

from pmq.atoms import AtomRule, EligibilityAtom, extract_atoms_from_text
from pmq.eligibility_parser import Bullet, Section

Unit = Literal["hours", "days", "weeks", "months", "years"]


@dataclass(frozen=True)
class TimeWindow:
    value: int
    unit: Unit

    def to_days(self) -> int:
        if self.unit == "hours":
            return max(1, self.value // 24)
        if self.unit == "days":
            return self.value
        if self.unit == "weeks":
            return self.value * 7
        if self.unit == "months":
            return self.value * 30
        if self.unit == "years":
            return self.value * 365
        return self.value


@dataclass
class ExtractedCriterion:
    criterion_id: str
    section: Section
    question_key: str
    kind: str

    qualifies_when: Optional[Any] = None
    disqualify_when: Optional[Any] = None

    params: Dict[str, Any] = field(default_factory=dict)
    clinic_only: bool = False

    evidence: str = ""
    rule_id: str = ""


WINDOW_PATTERNS: List[re.Pattern] = [
    re.compile(r"\bwithin\s+(?P<num>\d{1,3})\s*[-]?\s*(?P<unit>hour|hours|day|days|week|weeks|month|months|year|years)\b", re.I),
    re.compile(r"\bpast\s+(?P<num>\d{1,3})\s*[-]?\s*(?P<unit>hour|hours|day|days|week|weeks|month|months|year|years)\b", re.I),
    re.compile(r"\bprevious\s+(?P<num>\d{1,3})\s*[-]?\s*(?P<unit>hour|hours|day|days|week|weeks|month|months|year|years)\b", re.I),
    re.compile(r"\b(?P<num>\d{1,3})\s*[-]?\s*(?P<unit>hour|hours|day|days|week|weeks|month|months|year|years)\s+(?:prior|before)\b", re.I),
]

INVESTIGATIONAL_KEYWORDS = [
    "investigational",
    "experimental",
    "unapproved",
    "investigational agent",
    "investigational drug",
    "investigational product",
    "investigational medicinal product",
    "clinical trial drug",
    "imp",
]

INVESTIGATIONAL_CONCURRENT_PHRASES = [
    "concurrent",
    "during study",
    "during this study",
    "while on study",
    "on study",
    "no other investigational",
    "other investigational",
    "another investigational",
    "concomitant investigational",
    "other interventional study",
    "another interventional study",
    "while participating",
    "while participating in this study",
    "on-study",
]

INVESTIGATIONAL_PRIOR_ANCHORS = [
    "received",
    "treated with",
    "exposed to",
    "administration of",
    "use of",
    "participated in another",
    "participation in another",
    "enrolled in another",
    "prior clinical trial",
    "previous clinical trial",
    "prior investigational",
    "previous investigational",
    "other investigational agent",
    "other investigational product",
    "other investigational drug",
]

INVESTIGATIONAL_OTHER_ANCHORS = [
    "other investigational",
    "another investigational",
    "other investigational agent",
    "other investigational product",
    "other investigational drug",
    "another interventional study",
    "other interventional study",
]

CONCURRENT_THERAPY_KEYWORDS = [
    "optune",
]

CURRENT_STUDY_CONTEXT = [
    "study drug",
    "study treatment",
    "study therapy",
    "study medication",
    "investigational regimen",
    "first dose",
    "before first dose",
    "prior to first dose",
    "during study treatment",
    "during this study",
    "during study",
    "while on study",
    "on study",
    "on-study",
    "after last dose",
    "post study",
    "study intervention",
    "contraindication",
    "contraindicated",
    "ineligible for study drug",
    "cannot receive study drug",
    "sperm",
    "ova",
    "oocytes",
    "donation",
    "breastfeed",
    "breastfeeding",
    "contraception",
]


def extract_time_window(text: str) -> Optional[TimeWindow]:
    t = text.lower()
    for pat in WINDOW_PATTERNS:
        m = pat.search(t)
        if not m:
            continue
        num = int(m.group("num"))
        unit_raw = m.group("unit").lower()
        if unit_raw.endswith("s"):
            unit_raw = unit_raw[:-1]
        unit_map: Dict[str, Unit] = {
            "hour": "hours",
            "day": "days",
            "week": "weeks",
            "month": "months",
            "year": "years",
        }
        unit = unit_map.get(unit_raw)
        if unit is None:
            continue
        return TimeWindow(value=num, unit=unit)
    return None


def _contains_any(text: str, keywords: Sequence[str]) -> bool:
    """Check if text contains any of the keywords.
    Short keywords (<=3 chars) require word boundaries to avoid substring matches.
    """
    import re
    t = text.lower()
    for k in keywords:
        if len(k) <= 3:
            # Short keywords need word boundary matching to avoid false positives
            # e.g. 'tia' should not match 'potential'
            if re.search(r'\b' + re.escape(k) + r'\b', t):
                return True
        else:
            if k in t:
                return True
    return False


NON_RESTRICTIVE_PHRASES = [
    "no restriction",
    "no restrictions",
    "not restricted",
    "without restriction",
    "without restrictions",
    "no limitation",
    "no limitations",
    "without limitation",
    "without limitations",
    "no limits",
    "without limits",
    "does not exclude",
    "do not exclude",
    "not exclusionary",
    "not required",
    "not necessary",
    "not needed",
    "not mandated",
]

ALLOWED_RE = re.compile(r"\b(allowed|permitted)\s+to\b|\b(is|are)\s+(allowed|permitted)\b", re.I)
NOT_ALLOWED_RE = re.compile(r"\bnot\s+(allowed|permitted)\b", re.I)
MUST_NOT_RE = re.compile(r"\b(must|should)\s+not\b", re.I)


def _keyword_pattern(keyword: str) -> str:
    return re.sub(r"\s+", r"\\s+", re.escape(keyword.strip()))


def _has_nonrestrictive_context(text: str) -> bool:
    t = text.lower()
    if MUST_NOT_RE.search(t):
        return False
    if NOT_ALLOWED_RE.search(t):
        return False
    if any(phrase in t for phrase in NON_RESTRICTIVE_PHRASES):
        return True
    if ALLOWED_RE.search(t):
        return True
    return False




def _mk_id(rule_id: str, idx: int) -> str:
    return f"{rule_id}:{idx}"


_OP_NORMALIZE = {"≤": "<=", "≥": ">="}


def _normalize_operator(op: str) -> str:
    return _OP_NORMALIZE.get(op, op)


def _parse_threshold_value(raw: str) -> Any:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return raw
    return int(value) if value.is_integer() else value


@dataclass(frozen=True)
class Rule(AtomRule):
    rule_id: str
    description: str
    question_key: str
    sections: Sequence[Section]
    clinic_only: bool = False
    tier: int = 1

    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        raise NotImplementedError


class KeywordRule(Rule):
    keywords: Tuple[str, ...]
    kind: str
    default_window_value: Optional[int] = None
    default_window_unit: Unit = "days"
    disqualify_when: Optional[Any] = None
    qualifies_when: Optional[Any] = None
    blocklist_phrases: Tuple[str, ...] = ()

    def __init__(
        self,
        *,
        rule_id: str,
        description: str,
        question_key: str,
        sections: Sequence[Section],
        keywords: Sequence[str],
        kind: str,
        clinic_only: bool = False,
        tier: int = 1,
        blocklist_phrases: Optional[Sequence[str]] = None,
        default_window_value: Optional[int] = None,
        default_window_unit: Unit = "days",
        disqualify_when: Optional[Any] = None,
        qualifies_when: Optional[Any] = None,
    ):
        super().__init__(rule_id=rule_id, description=description, question_key=question_key, sections=sections, clinic_only=clinic_only, tier=tier)
        object.__setattr__(self, "keywords", tuple(k.lower() for k in keywords))
        object.__setattr__(self, "kind", kind)
        object.__setattr__(self, "blocklist_phrases", tuple(p.lower() for p in (blocklist_phrases or [])))
        object.__setattr__(self, "default_window_value", default_window_value)
        object.__setattr__(self, "default_window_unit", default_window_unit)
        object.__setattr__(self, "disqualify_when", disqualify_when)
        object.__setattr__(self, "qualifies_when", qualifies_when)

    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        if bullet.section not in self.sections:
            return None
        t = bullet.text.lower()
        if not _contains_any(t, self.keywords):
            return None
        if self.blocklist_phrases and any(p in t for p in self.blocklist_phrases):
            return None
        if _has_nonrestrictive_context(t):
            return None

        params: Dict[str, Any] = {}
        tw = extract_time_window(t)
        if tw:
            params["window_value"] = tw.value
            params["window_unit"] = tw.unit
            params["window_days"] = tw.to_days()
        elif self.default_window_value is not None:
            params["window_value"] = self.default_window_value
            params["window_unit"] = self.default_window_unit
            params["window_days"] = TimeWindow(value=self.default_window_value, unit=self.default_window_unit).to_days()

        disq = self.disqualify_when
        qual = self.qualifies_when

        if disq is None and qual is None:
            if bullet.section == "exclusion":
                disq = "Yes"
            elif bullet.section == "inclusion":
                disq = "No"

        return EligibilityAtom(
            atom_id=_mk_id(self.rule_id, idx),
            section=bullet.section,
            question_key=self.question_key,
            kind=self.kind,
            tier=self.tier,
            qualifies_when=qual,
            disqualify_when=disq,
            params=params,
            clinic_only=self.clinic_only,
            evidence=bullet.text,
            rule_id=self.rule_id,
        )


class RecentTrialParticipationRule(Rule):
    """
    Captures phrases like "participation in another clinical trial within 30 days/weeks/months".

    We require a time window to reduce false positives from generic mentions of "clinical trial".
    """
    RE = re.compile(r"\b(participat(ed|ion)|enroll(ed|ment)|took part)\b.*\b(clinical trial|study)\b", re.I)

    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        if bullet.section not in self.sections:
            return None
        if not self.RE.search(bullet.text):
            return None
        tw = extract_time_window(bullet.text)
        if not tw:
            return None
        params: Dict[str, Any] = {
            "window_value": tw.value,
            "window_unit": tw.unit,
            "window_days": tw.to_days(),
        }
        return EligibilityAtom(
            atom_id=_mk_id(self.rule_id, idx),
            section=bullet.section,
            question_key=self.question_key,
            kind="recent_trial_participation",
            tier=self.tier,
            disqualify_when="Yes",
            params=params,
            clinic_only=self.clinic_only,
            evidence=bullet.text,
            rule_id=self.rule_id,
        )


class InvestigationalWashoutRule(Rule):
    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        if bullet.section not in self.sections:
            return None
        t = bullet.text.lower()
        if not _contains_any(t, INVESTIGATIONAL_KEYWORDS):
            return None
        if _contains_any(t, INVESTIGATIONAL_CONCURRENT_PHRASES):
            return None
        if _contains_any(t, CURRENT_STUDY_CONTEXT):
            return None
        tw = extract_time_window(t)
        if tw is None:
            return None
        if not _contains_any(t, INVESTIGATIONAL_PRIOR_ANCHORS):
            return None

        params: Dict[str, Any] = {}
        if tw:
            params["window_value"] = tw.value
            params["window_unit"] = tw.unit
            params["window_days"] = tw.to_days()

        disq: Optional[Any] = None
        if bullet.section == "exclusion":
            disq = "Yes"
        elif bullet.section == "inclusion":
            disq = "No"

        return EligibilityAtom(
            atom_id=_mk_id(self.rule_id, idx),
            section=bullet.section,
            question_key=self.question_key,
            kind="recent_investigational",
            tier=self.tier,
            disqualify_when=disq,
            params=params,
            clinic_only=self.clinic_only,
            evidence=bullet.text,
            rule_id=self.rule_id,
        )


class ConcurrentInvestigationalRule(Rule):
    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        if bullet.section not in self.sections:
            return None
        t = bullet.text.lower()
        if not _contains_any(t, INVESTIGATIONAL_CONCURRENT_PHRASES):
            return None
        has_trial_ref = (
            _contains_any(t, INVESTIGATIONAL_KEYWORDS)
            or "interventional" in t
            or _contains_any(t, INVESTIGATIONAL_OTHER_ANCHORS)
        )
        if not has_trial_ref and not _contains_any(t, CONCURRENT_THERAPY_KEYWORDS):
            return None

        return EligibilityAtom(
            atom_id=_mk_id(self.rule_id, idx),
            section=bullet.section,
            question_key=self.question_key,
            kind="concurrent_investigational",
            tier=self.tier,
            disqualify_when="Yes",
            params={},
            clinic_only=self.clinic_only,
            evidence=bullet.text,
            rule_id=self.rule_id,
        )


class LiverDiseaseRule(Rule):
    DISEASE_TERMS = [
        "cirrhosis",
        "hepatic impairment",
        "hepatic failure",
        "liver failure",
        "liver disease",
        "decompensated",
        "portal hypertension",
        "end-stage liver disease",
        "end stage liver disease",
        "child-pugh",
    ]
    IMPAIRMENT_TERMS = [
        "hepatic impairment",
        "hepatic failure",
        "liver failure",
        "cirrhosis",
        "child-pugh",
        "decompensated",
        "portal hypertension",
        "end-stage liver",
        "end stage liver",
    ]
    METASTASIS_VETO = [
        "liver metastasis",
        "hepatic metastasis",
        "metastatic liver",
        "liver metastases",
        "hepatic metastases",
        "metastases to the liver",
        "metastases in the liver",
        "metastatic to the liver",
        "liver mets",
        "hepatic mets",
        "mets to liver",
        "mets to the liver",
        "liver lesion",
        "hepatic lesion",
        "liver lesions",
        "hepatic lesions",
        "lesions in the liver",
        "liver tumor",
        "hepatic tumor",
        "liver tumors",
        "hepatic tumors",
        "liver tumour",
        "hepatic tumour",
        "liver tumours",
        "hepatic tumours",
        "liver mass",
        "hepatic mass",
        "liver masses",
        "hepatic masses",
    ]

    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        if bullet.section not in self.sections:
            return None
        t = bullet.text.lower()
        if not _contains_any(t, self.DISEASE_TERMS):
            return None
        if _contains_any(t, self.METASTASIS_VETO) and not _contains_any(t, self.IMPAIRMENT_TERMS):
            return None
        return EligibilityAtom(
            atom_id=_mk_id(self.rule_id, idx),
            section=bullet.section,
            question_key=self.question_key,
            kind="liver_disease",
            tier=self.tier,
            disqualify_when="Yes",
            params={},
            clinic_only=self.clinic_only,
            evidence=bullet.text,
            rule_id=self.rule_id,
        )


class PregnancyRule(Rule):
    PREG_RE = re.compile(r"\bpregnan(t|cy)\b", re.I)

    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        if bullet.section not in self.sections:
            return None
        if not self.PREG_RE.search(bullet.text):
            return None
        if _has_nonrestrictive_context(bullet.text):
            return None
        return EligibilityAtom(
            atom_id=_mk_id(self.rule_id, idx),
            section=bullet.section,
            question_key=self.question_key,
            kind="pregnancy",
            tier=self.tier,
            disqualify_when="Yes",
            params={},
            clinic_only=self.clinic_only,
            evidence=bullet.text,
            rule_id=self.rule_id,
        )


class BreastfeedingRule(Rule):
    BF_RE = re.compile(r"\b(breast[-\s]?feeding|lactat(ing|ion)|nursing)\b", re.I)

    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        if bullet.section not in self.sections:
            return None
        if not self.BF_RE.search(bullet.text):
            return None
        if _has_nonrestrictive_context(bullet.text):
            return None
        return EligibilityAtom(
            atom_id=_mk_id(self.rule_id, idx),
            section=bullet.section,
            question_key=self.question_key,
            kind="breastfeeding",
            tier=self.tier,
            disqualify_when="Yes" if bullet.section == "exclusion" else None,
            qualifies_when="No" if bullet.section == "inclusion" else None,
            params={},
            clinic_only=self.clinic_only,
            evidence=bullet.text,
            rule_id=self.rule_id,
        )


class ContraceptionRule(Rule):
    RE = re.compile(r"\b(wocbp|child[-\s]?bearing\s+potential|fertile|contracept(ion|ive)|birth\s+control|condom|iud|intrauterine)\b", re.I)

    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        if bullet.section not in self.sections:
            return None
        if not self.RE.search(bullet.text):
            return None
        if _has_nonrestrictive_context(bullet.text):
            return None
        return EligibilityAtom(
            atom_id=_mk_id(self.rule_id, idx),
            section=bullet.section,
            question_key=self.question_key,
            kind="contraception",
            tier=self.tier,
            disqualify_when="No",
            params={},
            clinic_only=self.clinic_only,
            evidence=bullet.text,
            rule_id=self.rule_id,
        )


class PregnancyTestRule(Rule):
    RE = re.compile(r"\b(pregnan(t|cy)\s+test|urine\s+pregnan(t|cy)\s+test|serum\s+pregnan(t|cy)\s+test|beta[-\s]?hcg)\b", re.I)

    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        if bullet.section not in self.sections:
            return None
        if not self.RE.search(bullet.text):
            return None
        if _has_nonrestrictive_context(bullet.text):
            return None
        tw = extract_time_window(bullet.text)
        params: Dict[str, Any] = {}
        if tw:
            params["window_value"] = tw.value
            params["window_unit"] = tw.unit
            params["window_days"] = tw.to_days()
        return EligibilityAtom(
            atom_id=_mk_id(self.rule_id, idx),
            section=bullet.section,
            question_key=self.question_key,
            kind="pregnancy_test",
            tier=self.tier,
            disqualify_when="No",
            params=params,
            clinic_only=self.clinic_only,
            evidence=bullet.text,
            rule_id=self.rule_id,
        )


class SmokingRule(Rule):
    RE = re.compile(r"\b(smok(e|er|ing)|tobacco|nicotine|vape|vaping|e[-\s]?cig)\b", re.I)

    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        if bullet.section not in self.sections:
            return None
        if not self.RE.search(bullet.text):
            return None
        if _has_nonrestrictive_context(bullet.text):
            return None

        t = bullet.text.lower()
        if "non-smoker" in t or "nonsmoker" in t or "non smoker" in t:
            disq = "Current"
        elif "must not smoke" in t or "no smoking" in t or "no tobacco" in t:
            disq = "Current"
        else:
            disq = None

        tw = extract_time_window(t)
        params: Dict[str, Any] = {}
        if tw:
            params["window_value"] = tw.value
            params["window_unit"] = tw.unit
            params["window_days"] = tw.to_days()

        return EligibilityAtom(
            atom_id=_mk_id(self.rule_id, idx),
            section=bullet.section,
            question_key=self.question_key,
            kind="smoking",
            tier=self.tier,
            disqualify_when=disq,
            params=params,
            clinic_only=self.clinic_only,
            evidence=bullet.text,
            rule_id=self.rule_id,
        )


class ECOGRule(Rule):
    RE = re.compile(r"\b(ecog|performance\s+status|karnofsky)\b", re.I)
    ECOG_RANGE_RE = re.compile(r"\becog\b.*?\b(?P<min>[0-5])\s*[-–to]+\s*(?P<max>[0-5])\b", re.I)
    ECOG_LE_RE = re.compile(r"\becog\b.*?\b(<=|≤)\s*(?P<max>[0-5])\b", re.I)

    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        if bullet.section not in self.sections:
            return None
        if not self.RE.search(bullet.text):
            return None
        if _has_nonrestrictive_context(bullet.text):
            return None

        params: Dict[str, Any] = {}
        t = bullet.text
        m = self.ECOG_RANGE_RE.search(t)
        if m:
            params["ecog_min"] = int(m.group("min"))
            params["ecog_max"] = int(m.group("max"))
        else:
            m2 = self.ECOG_LE_RE.search(t)
            if m2:
                params["ecog_min"] = 0
                params["ecog_max"] = int(m2.group("max"))
            else:
                if "0-1" in t or "0–1" in t or "0 to 1" in t:
                    params["ecog_min"] = 0
                    params["ecog_max"] = 1

        return EligibilityAtom(
            atom_id=_mk_id(self.rule_id, idx),
            section=bullet.section,
            question_key=self.question_key,
            kind="performance_status",
            tier=self.tier,
            params=params,
            clinic_only=self.clinic_only,
            evidence=bullet.text,
            rule_id=self.rule_id,
        )


class NumericThresholdRule(Rule):
    def __init__(
        self,
        *,
        rule_id: str,
        description: str,
        question_key: str,
        sections: Sequence[Section],
        pattern: str,
        kind: str,
        unit: Optional[str] = None,
        clinic_only: bool = False,
        tier: int = 1,
    ):
        super().__init__(rule_id=rule_id, description=description, question_key=question_key, sections=sections, clinic_only=clinic_only, tier=tier)
        object.__setattr__(self, "pattern", re.compile(pattern, re.I))
        object.__setattr__(self, "kind", kind)
        object.__setattr__(self, "unit", unit)

    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        if bullet.section not in self.sections:
            return None
        m = self.pattern.search(bullet.text)
        if not m:
            return None
        op_raw = m.group("op")
        value_raw = m.group("value")
        if not op_raw or not value_raw:
            return None
        params: Dict[str, Any] = {
            "operator": _normalize_operator(op_raw),
            "threshold": _parse_threshold_value(value_raw),
        }
        unit = getattr(self, "unit", None)
        if unit:
            params["unit"] = unit
        return EligibilityAtom(
            atom_id=_mk_id(self.rule_id, idx),
            section=bullet.section,
            question_key=self.question_key,
            kind=self.kind,
            tier=self.tier,
            params=params,
            clinic_only=self.clinic_only,
            evidence=bullet.text,
            rule_id=self.rule_id,
        )


class ULNThresholdRule(Rule):
    def __init__(
        self,
        *,
        rule_id: str,
        description: str,
        question_key: str,
        sections: Sequence[Section],
        pattern: str,
        kind: str,
        clinic_only: bool = True,
        tier: int = 2,
    ):
        super().__init__(rule_id=rule_id, description=description, question_key=question_key, sections=sections, clinic_only=clinic_only, tier=tier)
        object.__setattr__(self, "pattern", re.compile(pattern, re.I))
        object.__setattr__(self, "kind", kind)

    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        if bullet.section not in self.sections:
            return None
        m = self.pattern.search(bullet.text)
        if not m:
            return None
        op_raw = m.group("op")
        value_raw = m.group("value")
        if not op_raw or not value_raw:
            return None
        params: Dict[str, Any] = {
            "operator": _normalize_operator(op_raw),
            "threshold": _parse_threshold_value(value_raw),
            "unit": "x_uln",
        }
        lab = m.groupdict().get("lab")
        if lab:
            params["lab"] = lab.lower()
        return EligibilityAtom(
            atom_id=_mk_id(self.rule_id, idx),
            section=bullet.section,
            question_key=self.question_key,
            kind=self.kind,
            tier=self.tier,
            params=params,
            clinic_only=self.clinic_only,
            evidence=bullet.text,
            rule_id=self.rule_id,
        )


class BMIOrWeightRule(Rule):
    RE = re.compile(r"\b(bmi|body\s+mass\s+index|height|weight|kg|lbs|pounds)\b", re.I)

    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        if bullet.section not in self.sections:
            return None
        if not self.RE.search(bullet.text):
            return None
        return EligibilityAtom(
            atom_id=_mk_id(self.rule_id, idx),
            section=bullet.section,
            question_key=self.question_key,
            kind="anthropometrics",
            tier=self.tier,
            params={},
            clinic_only=self.clinic_only,
            evidence=bullet.text,
            rule_id=self.rule_id,
        )


DEFAULT_RULES: List[AtomRule] = []

DEFAULT_RULES.append(PregnancyRule(
    rule_id="pregnancy_present",
    description="Mentions pregnancy (exclude if pregnant).",
    question_key="pregnant",
    sections=["inclusion", "exclusion", "unknown"],
))
DEFAULT_RULES.append(BreastfeedingRule(
    rule_id="breastfeeding_present",
    description="Mentions breastfeeding/lactation (exclude if breastfeeding).",
    question_key="breastfeeding",
    sections=["inclusion", "exclusion", "unknown"],
))
DEFAULT_RULES.append(ContraceptionRule(
    rule_id="contraception_required",
    description="Mentions contraception or childbearing potential requirements.",
    question_key="willing_contraception",
    sections=["inclusion", "exclusion", "unknown"],
))
DEFAULT_RULES.append(PregnancyTestRule(
    rule_id="pregnancy_test_required",
    description="Mentions pregnancy tests / beta-hCG.",
    question_key="pregnancy_test_ok",
    sections=["inclusion", "exclusion", "unknown"],
))

DEFAULT_RULES.append(InvestigationalWashoutRule(
    rule_id="investigational_washout",
    description="Recent investigational drug/device participation with a washout or prior anchor.",
    question_key="recent_investigational_drug",
    sections=["inclusion", "exclusion", "unknown"],
))

DEFAULT_RULES.append(RecentTrialParticipationRule(
    rule_id="recent_trial_participation",
    description="Participation in another clinical trial within an explicit time window.",
    question_key="recent_investigational_drug",
    sections=["inclusion", "exclusion", "unknown"],
))

DEFAULT_RULES.append(ConcurrentInvestigationalRule(
    rule_id="concurrent_investigational",
    description="Concurrent investigational agents or interventional studies during this study.",
    question_key="currently_in_other_trial",
    sections=["inclusion", "exclusion", "unknown"],
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="other_trial_participation",
    description="Currently enrolled in another interventional trial.",
    question_key="currently_in_other_trial",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=["currently enrolled", "concurrent", "another interventional", "other clinical trial", "enrolled in another"],
    kind="concurrent_trial",
    disqualify_when="Yes",
))

DEFAULT_RULES.append(SmokingRule(
    rule_id="smoking_status_rule",
    description="Smoking/tobacco/vaping status restrictions.",
    question_key="smoking_status",
    sections=["inclusion", "exclusion", "unknown"],
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="anticoagulants",
    description="Anticoagulant / blood thinner use.",
    question_key="taking_anticoagulants",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=[
        "anticoagulant", "blood thinner", "warfarin", "coumadin", "heparin", "enoxaparin", "lovenox",
        "apixaban", "eliquis", "rivaroxaban", "xarelto", "dabigatran", "pradaxa", "edoxaban"
    ],
    kind="anticoagulants",
    disqualify_when="Yes",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="antiplatelets",
    description="Antiplatelet use (clopidogrel etc).",
    question_key="taking_antiplatelets",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=[
        "antiplatelet", "clopidogrel", "plavix", "ticagrelor", "brilinta", "prasugrel", "effient"
    ],
    kind="antiplatelets",
    disqualify_when="Yes",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="immunosuppressants",
    description="Immunosuppressive medication use.",
    question_key="taking_immunosuppressants",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=[
        "immunosuppress", "immunosuppression", "tacrolimus", "cyclosporine", "mycophenolate", "azathioprine",
        "methotrexate", "biologic", "tnf inhibitor"
    ],
    kind="immunosuppressants",
    disqualify_when="Yes",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="systemic_steroids",
    description="Systemic corticosteroids (prednisone etc).",
    question_key="taking_systemic_steroids",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=[
        "systemic steroid", "corticosteroid", "prednisone", "prednisolone", "methylprednisolone", "dexamethasone"
    ],
    kind="systemic_steroids",
    disqualify_when="Yes",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="recent_cancer_therapy",
    description="Recent chemo/radiation/immunotherapy.",
    question_key="recent_cancer_therapy",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=["chemotherapy", "radiotherapy", "radiation", "immunotherapy", "anti-cancer", "anticancer", "targeted therapy"],
    kind="recent_cancer_therapy",
    clinic_only=True,
    default_window_value=28,
    default_window_unit="days",
    disqualify_when="Yes",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="recent_surgery",
    description="Recent major surgery.",
    question_key="recent_major_surgery",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=["major surgery", "surgery", "surgical procedure", "operation"],
    kind="recent_surgery",
    default_window_value=30,
    default_window_unit="days",
    disqualify_when="Yes",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="uncontrolled_htn",
    description="Uncontrolled hypertension / BP thresholds.",
    question_key="uncontrolled_hypertension",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=["uncontrolled hypertension", "high blood pressure", "systolic", "diastolic", "blood pressure"],
    kind="uncontrolled_hypertension",
    disqualify_when="Yes",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="uncontrolled_diabetes",
    description="Uncontrolled diabetes / HbA1c thresholds.",
    question_key="uncontrolled_diabetes",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=["uncontrolled diabetes", "hba1c", "hemoglobin a1c", "blood sugar", "hyperglycemia"],
    kind="uncontrolled_diabetes",
    disqualify_when="Yes",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="cv_event",
    description="Recent myocardial infarction / stroke etc.",
    question_key="recent_cardiovascular_event",
    sections=["exclusion", "unknown"],  # Only exclusion - not inclusion
    keywords=["myocardial infarction", "heart attack", "tia", "angina"],
    blocklist_phrases=[
        "terminal medical condition", "life expectancy", "end-stage", "end stage",
        "including but not limited to", "such as", "for example", "e.g."
    ],
    kind="recent_cardiovascular_event",
    clinic_only=True,
    default_window_value=6,
    default_window_unit="months",
    disqualify_when="Yes",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="renal_dialysis",
    description="Renal impairment or dialysis.",
    question_key="kidney_disease_dialysis",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=["dialysis", "renal failure", "kidney failure", "creatinine clearance", "egfr", "hemodialysis"],
    kind="kidney_disease",
    clinic_only=True,
    disqualify_when="Yes",
))

DEFAULT_RULES.append(LiverDiseaseRule(
    rule_id="liver_disease",
    description="Hepatic impairment / cirrhosis.",
    question_key="liver_disease",
    sections=["inclusion", "exclusion", "unknown"],
    clinic_only=True,
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="hiv_hepatitis",
    description="HIV or hepatitis B/C restrictions.",
    question_key="hiv_or_hepatitis",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=["hiv", "aids", "hepatitis b", "hbv", "hepatitis c", "hcv", "hbsag"],
    kind="hiv_hepatitis",
    clinic_only=True,
    disqualify_when="Yes",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="active_infection",
    description="Active infection exclusions (antibiotics/fever).",
    question_key="active_infection",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=["active infection", "systemic infection", "antibiotic", "antiviral", "fever", "sepsis"],
    kind="active_infection",
    clinic_only=True,
    disqualify_when="Yes",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="organ_transplant",
    description="Organ transplant history.",
    question_key="organ_transplant",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=["organ transplant", "transplantation"],
    kind="organ_transplant",
    clinic_only=True,
    disqualify_when="Yes",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="prior_malignancy_recent",
    description="Prior malignancy within a recent time window.",
    question_key="prior_malignancy_recent",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=["malignancy", "other cancer", "prior cancer", "history of cancer", "second primary"],
    kind="prior_malignancy_recent",
    clinic_only=True,
    default_window_value=5,
    default_window_unit="years",
    disqualify_when="Yes",
))

DEFAULT_RULES.append(ECOGRule(
    rule_id="performance_status",
    description="ECOG / Karnofsky performance status mentioned.",
    question_key="ecog_activity",
    sections=["inclusion", "exclusion", "unknown"],
))

DEFAULT_RULES.append(BMIOrWeightRule(
    rule_id="height_needed",
    description="Height/weight/BMI mentioned.",
    question_key="height_cm",
    sections=["inclusion", "exclusion", "unknown"],
))
DEFAULT_RULES.append(BMIOrWeightRule(
    rule_id="weight_needed",
    description="Height/weight/BMI mentioned.",
    question_key="weight_kg",
    sections=["inclusion", "exclusion", "unknown"],
))

DEFAULT_RULES.append(NumericThresholdRule(
    rule_id="bmi_threshold",
    description="BMI threshold explicitly stated.",
    question_key="bmi",
    sections=["inclusion", "exclusion", "unknown"],
    pattern=r"\b(bmi|body\s+mass\s+index)\b.*?(?P<op><=|>=|<|>|≤|≥)\s*(?P<value>\d{2}(?:\.\d+)?)",
    kind="bmi_threshold",
    unit="kg/m2",
))
DEFAULT_RULES.append(NumericThresholdRule(
    rule_id="systolic_bp_threshold",
    description="Systolic blood pressure threshold.",
    question_key="systolic_bp",
    sections=["inclusion", "exclusion", "unknown"],
    pattern=r"\b(systolic|sbp)\b.*?(?P<op><=|>=|<|>|≤|≥)\s*(?P<value>\d{2,3})\b",
    kind="systolic_bp_threshold",
    unit="mmHg",
))
DEFAULT_RULES.append(NumericThresholdRule(
    rule_id="diastolic_bp_threshold",
    description="Diastolic blood pressure threshold.",
    question_key="diastolic_bp",
    sections=["inclusion", "exclusion", "unknown"],
    pattern=r"\b(diastolic|dbp)\b.*?(?P<op><=|>=|<|>|≤|≥)\s*(?P<value>\d{2,3})\b",
    kind="diastolic_bp_threshold",
    unit="mmHg",
))
DEFAULT_RULES.append(NumericThresholdRule(
    rule_id="hba1c_threshold",
    description="HbA1c threshold explicitly stated.",
    question_key="hba1c_percent",
    sections=["inclusion", "exclusion", "unknown"],
    pattern=r"\b(hba1c|a1c|hemoglobin\s+a1c)\b.*?(?P<op><=|>=|<|>|≤|≥)\s*(?P<value>\d+(?:\.\d+)?)\s*%?",
    kind="hba1c_threshold",
    unit="percent",
))
DEFAULT_RULES.append(NumericThresholdRule(
    rule_id="egfr_threshold",
    description="eGFR threshold explicitly stated.",
    question_key="egfr",
    sections=["inclusion", "exclusion", "unknown"],
    pattern=r"\begfr\b.*?(?P<op><=|>=|<|>|≤|≥)\s*(?P<value>\d+(?:\.\d+)?)\s*(?:m[lL]/min(?:/1\\.73m2)?)?",
    kind="egfr_threshold",
    unit="mL/min",
))
DEFAULT_RULES.append(NumericThresholdRule(
    rule_id="creatinine_threshold",
    description="Creatinine threshold explicitly stated.",
    question_key="creatinine_mg_dl",
    sections=["inclusion", "exclusion", "unknown"],
    pattern=r"\bcreatinine\b.*?(?P<op><=|>=|<|>|≤|≥)\s*(?P<value>\d+(?:\.\d+)?)\s*(mg/dl|mgdl)\b",
    kind="creatinine_threshold",
    unit="mg/dL",
))
DEFAULT_RULES.append(NumericThresholdRule(
    rule_id="ast_threshold",
    description="AST threshold explicitly stated.",
    question_key="ast_u_l",
    sections=["inclusion", "exclusion", "unknown"],
    pattern=r"\bast\b.*?(?P<op><=|>=|<|>|≤|≥)\s*(?P<value>\d+(?:\.\d+)?)\s*(u/l|iu/l)\b",
    kind="ast_threshold",
    unit="U/L",
))
DEFAULT_RULES.append(NumericThresholdRule(
    rule_id="alt_threshold",
    description="ALT threshold explicitly stated.",
    question_key="alt_u_l",
    sections=["inclusion", "exclusion", "unknown"],
    pattern=r"\balt\b.*?(?P<op><=|>=|<|>|≤|≥)\s*(?P<value>\d+(?:\.\d+)?)\s*(u/l|iu/l)\b",
    kind="alt_threshold",
    unit="U/L",
))
DEFAULT_RULES.append(NumericThresholdRule(
    rule_id="bilirubin_threshold",
    description="Bilirubin threshold explicitly stated.",
    question_key="bilirubin_mg_dl",
    sections=["inclusion", "exclusion", "unknown"],
    pattern=r"\bbilirubin\b.*?(?P<op><=|>=|<|>|≤|≥)\s*(?P<value>\d+(?:\.\d+)?)\s*(mg/dl|mgdl)\b",
    kind="bilirubin_threshold",
    unit="mg/dL",
))
DEFAULT_RULES.append(ULNThresholdRule(
    rule_id="uln_labs",
    description="Lab thresholds expressed as x ULN.",
    question_key="abnormal_labs",
    sections=["inclusion", "exclusion", "unknown"],
    pattern=r"\b(?P<lab>alt|ast|alp|bilirubin)\b.*?(?P<op><=|>=|<|>|≤|≥)\s*(?P<value>\d+(?:\.\d+)?)\s*(?:x|×)\s*uln\b",
    kind="lab_uln_threshold",
    clinic_only=True,
    tier=2,
))
DEFAULT_RULES.append(NumericThresholdRule(
    rule_id="hemoglobin_threshold",
    description="Hemoglobin threshold explicitly stated.",
    question_key="hemoglobin_g_dl",
    sections=["inclusion", "exclusion", "unknown"],
    pattern=r"\bhemoglobin\b.*?(?P<op><=|>=|<|>|≤|≥)\s*(?P<value>\d+(?:\.\d+)?)\s*(g/dl|gdl)\b",
    kind="hemoglobin_threshold",
    unit="g/dL",
))
DEFAULT_RULES.append(NumericThresholdRule(
    rule_id="anc_threshold",
    description="Absolute neutrophil count threshold explicitly stated.",
    question_key="anc",
    sections=["inclusion", "exclusion", "unknown"],
    pattern=r"\b(anc|absolute\s+neutrophil\s+count)\b.*?(?P<op><=|>=|<|>|≤|≥)\s*(?P<value>\d+(?:\.\d+)?)\s*(?:x\s*10(?:\\^)?9\\s*/\\s*l|10(?:\\^)?9\\s*/\\s*l|/\\s*mm3|/\\s*u\\s*l|/\\s*ul|cells/\\s*mm3|cells/\\s*u\\s*l)\b",
    kind="anc_threshold",
))
DEFAULT_RULES.append(NumericThresholdRule(
    rule_id="platelets_threshold",
    description="Platelet count threshold explicitly stated.",
    question_key="platelets",
    sections=["inclusion", "exclusion", "unknown"],
    pattern=r"\bplatelet(s)?\b.*?(?P<op><=|>=|<|>|≤|≥)\s*(?P<value>\d+(?:\.\d+)?)\s*(?:x\s*10(?:\\^)?9\\s*/\\s*l|10(?:\\^)?9\\s*/\\s*l|/\\s*mm3|/\\s*u\\s*l|/\\s*ul|k/\\s*u\\s*l|k/\\s*ul)\b",
    kind="platelets_threshold",
))
DEFAULT_RULES.append(NumericThresholdRule(
    rule_id="qtc_threshold",
    description="QTc threshold explicitly stated.",
    question_key="qtc_ms",
    sections=["inclusion", "exclusion", "unknown"],
    pattern=r"\bqtc\b.*?(?P<op><=|>=|<|>|≤|≥)\s*(?P<value>\d+)\s*ms\b",
    kind="qtc_threshold",
    unit="ms",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="clinically_significant_condition",
    description="Clinically significant conditions per investigator judgement.",
    question_key="clinically_significant_condition",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=[
        "clinically significant", "clinically-significant", "investigator judgment", "investigator's judgment",
        "opinion of the investigator", "deemed unsuitable"
    ],
    kind="clinically_significant_condition",
    clinic_only=True,
    tier=2,
    blocklist_phrases=[
        "non-clinically significant",
        "non clinically significant",
        "not clinically significant",
        "no clinically significant",
    ],
))
DEFAULT_RULES.append(KeywordRule(
    rule_id="abnormal_labs",
    description="Abnormal laboratory values without explicit thresholds.",
    question_key="abnormal_labs",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=[
        "abnormal lab", "abnormal laboratory", "laboratory abnormal", "clinically significant laboratory",
        "clinically significant lab", "lab abnormality"
    ],
    kind="abnormal_labs",
    clinic_only=True,
    tier=2,
    blocklist_phrases=[
        "non-clinically significant",
        "non clinically significant",
        "not clinically significant",
        "no clinically significant",
    ],
))
DEFAULT_RULES.append(KeywordRule(
    rule_id="abnormal_ecg",
    description="Clinically significant ECG abnormalities.",
    question_key="ecg_abnormal",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=[
        "abnormal ecg", "abnormal electrocardiogram", "clinically significant ecg", "ecg abnormality"
    ],
    kind="ecg_abnormal",
    clinic_only=True,
    tier=2,
))
DEFAULT_RULES.append(KeywordRule(
    rule_id="mri_contraindication",
    description="Contraindications to MRI.",
    question_key="mri_contraindication",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=[
        "contraindication to mri", "mri contraindication", "unable to undergo mri", "cannot undergo mri"
    ],
    kind="mri_contraindication",
    clinic_only=True,
    tier=2,
))
DEFAULT_RULES.append(KeywordRule(
    rule_id="unable_to_comply",
    description="Unable or unwilling to comply with study procedures.",
    question_key="unable_to_comply",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=[
        "unable to comply", "unwilling to comply", "noncompliance", "non-compliance", "unable to adhere",
        "unable to complete study procedures"
    ],
    kind="unable_to_comply",
    clinic_only=True,
    tier=2,
))



# --- Lifestyle & Comorbidities (NCT05420051 Pilot) ---

DEFAULT_RULES.append(KeywordRule(
    rule_id="physical_activity",
    description="Physical activity / exercise levels.",
    question_key="physical_activity",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=["physical activity", "exercise", "sedentary", "activity level"],
    kind="lifestyle",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="cad_history",
    description="Coronary artery disease / Heart disease history.",
    question_key="cad_history",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=[
        "coronary artery disease", "myocardial infarction", "cad", "heart attack",
    ],
    blocklist_phrases=[
        "terminal medical condition", "life expectancy", "end-stage", "end stage",
        "including but not limited to", "such as", "for example", "e.g."
    ],
    kind="comorbidity",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="depression_diagnosis",
    description="Depression / Mental health history.",
    question_key="depression_diagnosis",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=["depression", "phq-9", "mental health", "depressive detail", "mood disorder"],
    kind="comorbidity",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="insulin_treatment",
    description="Insulin use for diabetes.",
    question_key="insulin_treatment",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=["taking insulin", "insulin therapy", "on insulin", "insulin dependent", "insulin-dependent", "basal insulin", "bolus insulin"],
    blocklist_phrases=[
        "implant", "implanted", "pacemaker", "defibrillator", "cochlear", "device"
    ],
    kind="medication",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="generic_condition_history",
    description="Generic history of common conditions (Asthma, BP, etc).",
    question_key="condition_history",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=[
        "asthma", "high blood pressure", "hypertension", "copd", "arthritis", "thyroid",
        "kidney disease", "renal impairment"
    ],
    blocklist_phrases=[
        "terminal medical condition", "life expectancy", "end-stage", "end stage",
        "including but not limited to", "such as", "for example", "e.g."
    ],
    kind="comorbidity",
    clinic_only=True,
    tier=2,
))


def criterion_from_atom(atom: EligibilityAtom, *, idx: int) -> ExtractedCriterion:
    criterion_id = atom.atom_id or f"atom:{idx}"
    return ExtractedCriterion(
        criterion_id=criterion_id,
        section=atom.section,
        question_key=atom.question_key,
        kind=atom.kind,
        qualifies_when=atom.qualifies_when,
        disqualify_when=atom.disqualify_when,
        params=dict(atom.params),
        clinic_only=atom.clinic_only,
        evidence=atom.evidence,
        rule_id=atom.rule_id,
    )


def extract_criteria_from_text(
    eligibility_text: str,
    *,
    rules: Optional[Sequence[AtomRule]] = None,
    max_criteria: int = 200,
    include_tiers: Sequence[int] = (1,),
) -> Tuple[List[ExtractedCriterion], Dict[str, Any]]:
    """
    Extract criteria from text using deterministic rules.

    include_tiers:
      - (1,)     => patient-relevant / tier-1 only (current default)
      - (1, 2)   => include clinic-only tier-2 as well
    """
    rule_list = list(rules) if rules is not None else DEFAULT_RULES
    atoms, stats = extract_atoms_from_text(
        eligibility_text,
        rules=rule_list,
        max_atoms=max_criteria,
    )

    tier1_count = sum(1 for atom in atoms if int(getattr(atom, "tier", 1)) == 1)
    tier2_count = sum(1 for atom in atoms if int(getattr(atom, "tier", 1)) == 2)
    stats["tier1_count"] = tier1_count
    stats["tier2_count"] = tier2_count

    include_set = set(int(t) for t in include_tiers)
    kept_atoms = [atom for atom in atoms if int(getattr(atom, "tier", 1)) in include_set]

    stats["criteria_count"] = len(kept_atoms)
    extracted = [criterion_from_atom(atom, idx=i) for i, atom in enumerate(kept_atoms)]
    return extracted, stats


def dedupe_criteria(criteria: Sequence[ExtractedCriterion]) -> List[ExtractedCriterion]:
    best_by_sig: Dict[Tuple[Any, ...], ExtractedCriterion] = {}

    def score(c: ExtractedCriterion) -> int:
        s = 0
        if c.params.get("window_days") is not None:
            s += 10
        if c.disqualify_when is not None or c.qualifies_when is not None:
            s += 5
        if c.section == "exclusion":
            s += 1
        return s

    def _param_signature(value: Any) -> Any:
        if isinstance(value, dict):
            return tuple((k, _param_signature(value[k])) for k in sorted(value))
        if isinstance(value, (list, tuple)):
            return tuple(_param_signature(v) for v in value)
        return value

    def _signature(c: ExtractedCriterion) -> Tuple[Any, ...]:
        return (
            c.question_key,
            c.kind,
            c.section,
            c.qualifies_when,
            c.disqualify_when,
            c.clinic_only,
            c.rule_id,
            _param_signature(c.params),
        )

    for c in criteria:
        sig = _signature(c)
        if sig not in best_by_sig:
            best_by_sig[sig] = c
            continue
        if score(c) > score(best_by_sig[sig]):
            best_by_sig[sig] = c

    return sorted(
        best_by_sig.values(),
        key=lambda c: (c.question_key, c.kind, c.rule_id, c.criterion_id),
    )


def _smoke_extract() -> None:
    sample_text = """
Inclusion Criteria:
- Use of an investigational drug within 30 days.
- Not pregnant or breastfeeding.
"""
    atoms, _stats = extract_atoms_from_text(sample_text, rules=DEFAULT_RULES)
    criteria, _stats = extract_criteria_from_text(sample_text, rules=DEFAULT_RULES)
    print(f"atoms={len(atoms)} criteria={len(criteria)}")


if __name__ == "__main__":
    _smoke_extract()
