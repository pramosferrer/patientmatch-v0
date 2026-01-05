"""
Deterministic age-bound inference from structured fields + eligibility text.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple, TYPE_CHECKING

from pmq.eligibility_parser import iter_all_bullets

if TYPE_CHECKING:
    from pmq.generator import TrialRow


_NUM_RE = r"\d{1,4}(?:\.\d+)?"
_UNIT_RE = r"(?:years?|months?|weeks?|days?|hours?|minutes?)"
_UNIT_SUFFIX_RE = r"(?:\s+(?:old|of\s+age))?"

_AGE_ANY_RE = re.compile(
    r"\b(regardless of age|any age|no age limit|no age limits|no age restriction|no age restrictions)\b",
    re.I,
)

_AGE_KEYWORD_RE = re.compile(
    r"\b(age|aged|years\s+old|months\s+old|of\s+age|pediatric|adult)\b",
    re.I,
)
_AGE_HINT_NUM_UNIT_RE = re.compile(rf"\b{_NUM_RE}\s*{_UNIT_RE}\b", re.I)

_RANGE_PATTERNS: List[re.Pattern] = [
    re.compile(rf"\b(?:aged|age)\s*(?P<min>{_NUM_RE})\s*(?:-|to)\s*(?P<max>{_NUM_RE})\s*(?P<unit>{_UNIT_RE})?{_UNIT_SUFFIX_RE}\b", re.I),
    re.compile(rf"\bbetween\s+(?P<min>{_NUM_RE})\s+and\s+(?P<max>{_NUM_RE})\s*(?P<unit>{_UNIT_RE}){_UNIT_SUFFIX_RE}\b", re.I),
    re.compile(rf"\b(?P<min>{_NUM_RE})\s*-\s*(?P<max>{_NUM_RE})\s*(?P<unit>{_UNIT_RE}){_UNIT_SUFFIX_RE}\b", re.I),
]

_MIN_PATTERNS: List[re.Pattern] = [
    re.compile(rf"\b>=\s*(?P<num>{_NUM_RE})\s*(?P<unit>{_UNIT_RE}){_UNIT_SUFFIX_RE}\b", re.I),
    re.compile(rf"\bat\s+least\s+(?P<num>{_NUM_RE})\s*(?P<unit>{_UNIT_RE}){_UNIT_SUFFIX_RE}\b", re.I),
    re.compile(rf"\b(?P<num>{_NUM_RE})\s*(?P<unit>{_UNIT_RE}){_UNIT_SUFFIX_RE}\s*(?:or|and)\s+older\b", re.I),
    re.compile(rf"\bolder\s+than\s+(?P<num>{_NUM_RE})\s*(?P<unit>{_UNIT_RE})?{_UNIT_SUFFIX_RE}\b", re.I),
    re.compile(rf"\bage\s*>=\s*(?P<num>{_NUM_RE})\s*(?P<unit>{_UNIT_RE})?{_UNIT_SUFFIX_RE}\b", re.I),
]

_MAX_PATTERNS: List[re.Pattern] = [
    re.compile(rf"\b<=\s*(?P<num>{_NUM_RE})\s*(?P<unit>{_UNIT_RE}){_UNIT_SUFFIX_RE}\b", re.I),
    re.compile(rf"\bat\s+most\s+(?P<num>{_NUM_RE})\s*(?P<unit>{_UNIT_RE}){_UNIT_SUFFIX_RE}\b", re.I),
    re.compile(rf"\bno\s+older\s+than\s+(?P<num>{_NUM_RE})\s*(?P<unit>{_UNIT_RE})?{_UNIT_SUFFIX_RE}\b", re.I),
    re.compile(rf"\bunder\s+(?P<num>{_NUM_RE})\s*(?P<unit>{_UNIT_RE}){_UNIT_SUFFIX_RE}\b", re.I),
    re.compile(rf"\byounger\s+than\s+(?P<num>{_NUM_RE})\s*(?P<unit>{_UNIT_RE})?{_UNIT_SUFFIX_RE}\b", re.I),
    re.compile(rf"\bage\s*<=\s*(?P<num>{_NUM_RE})\s*(?P<unit>{_UNIT_RE})?{_UNIT_SUFFIX_RE}\b", re.I),
]


def _normalize_text(text: str) -> str:
    t = text.lower()
    t = t.replace("\u2265", ">=")
    t = t.replace("\u2264", "<=")
    t = t.replace("\u2013", "-")
    t = t.replace("\u2014", "-")
    return t


def _to_years(value: float, unit: Optional[str], *, default_unit: str = "years") -> Optional[float]:
    unit_key = (unit or default_unit).lower()
    if unit_key.endswith("s"):
        unit_key = unit_key[:-1]
    if unit_key == "year":
        return value
    if unit_key == "month":
        return value / 12.0
    if unit_key == "week":
        return value / 52.1429
    if unit_key == "day":
        return value / 365.2425
    if unit_key == "hour":
        return value / (24.0 * 365.2425)
    if unit_key == "minute":
        return value / (60.0 * 24.0 * 365.2425)
    return None


def _extract_numeric_bounds(text: str) -> Tuple[List[float], List[float], List[Tuple[float, float]]]:
    min_candidates: List[float] = []
    max_candidates: List[float] = []
    ranges: List[Tuple[float, float]] = []

    for pat in _RANGE_PATTERNS:
        for m in pat.finditer(text):
            unit = m.group("unit")
            min_val = float(m.group("min"))
            max_val = float(m.group("max"))
            min_years = _to_years(min_val, unit, default_unit="years")
            max_years = _to_years(max_val, unit, default_unit="years")
            if min_years is not None:
                min_candidates.append(min_years)
            if max_years is not None:
                max_candidates.append(max_years)
            if min_years is not None and max_years is not None:
                ranges.append((min_years, max_years))

    for pat in _MIN_PATTERNS:
        for m in pat.finditer(text):
            num = float(m.group("num"))
            unit = m.group("unit")
            years = _to_years(num, unit, default_unit="years")
            if years is not None:
                min_candidates.append(years)

    for pat in _MAX_PATTERNS:
        for m in pat.finditer(text):
            num = float(m.group("num"))
            unit = m.group("unit")
            years = _to_years(num, unit, default_unit="years")
            if years is not None:
                max_candidates.append(years)

    return min_candidates, max_candidates, ranges


def _age_hint_with_number(bullets: List[str]) -> bool:
    for bullet in bullets:
        if _AGE_KEYWORD_RE.search(bullet) and _AGE_HINT_NUM_UNIT_RE.search(bullet):
            return True
    return False


def _has_disjoint_ranges(ranges: List[Tuple[float, float]]) -> bool:
    if len(ranges) < 2:
        return False
    seen = set()
    deduped: List[Tuple[float, float]] = []
    for min_years, max_years in ranges:
        key = (round(min_years, 6), round(max_years, 6))
        if key in seen:
            continue
        seen.add(key)
        deduped.append((min_years, max_years))
    if len(deduped) < 2:
        return False
    deduped.sort(key=lambda r: (r[0], r[1]))
    eps = 1e-6
    merged: List[Tuple[float, float]] = [deduped[0]]
    for min_years, max_years in deduped[1:]:
        last_min, last_max = merged[-1]
        if min_years <= last_max + eps:
            merged[-1] = (last_min, max(last_max, max_years))
        else:
            merged.append((min_years, max_years))
    return len(merged) > 1


def infer_age_bounds(trial: "TrialRow") -> Tuple[Optional[float], Optional[float], List[str]]:
    flags: List[str] = []

    min_years = trial.min_age_years
    max_years = trial.max_age_years

    text_raw = trial.eligibility_text_clean or ""
    text = _normalize_text(text_raw)

    age_any = False
    age_hint = False
    numeric_detected = False
    age_keywords_present = False

    if min_years is None and max_years is None:
        if trial.adult is False and trial.child is True:
            min_years = 0.0
            max_years = 17.999
            flags.append("inferred_age_from_flags")

    bullets = [b.text for b in iter_all_bullets(text_raw)] if text_raw else []
    age_bullets = []
    for bullet in bullets:
        if _AGE_KEYWORD_RE.search(bullet):
            age_keywords_present = True
            age_bullets.append(bullet)

    parse_text = bool(age_bullets) and (min_years is None or max_years is None)
    if parse_text:
        age_any = _AGE_ANY_RE.search(text) is not None
        age_hint = _age_hint_with_number(age_bullets)

        min_candidates: List[float] = []
        max_candidates: List[float] = []
        ranges: List[Tuple[float, float]] = []
        for bullet in age_bullets:
            bullet_text = _normalize_text(bullet)
            b_min, b_max, b_ranges = _extract_numeric_bounds(bullet_text)
            min_candidates.extend(b_min)
            max_candidates.extend(b_max)
            ranges.extend(b_ranges)

        numeric_detected = bool(min_candidates or max_candidates or ranges)

        if age_any:
            flags.append("age_any_or_unspecified")
        else:
            if _has_disjoint_ranges(ranges):
                flags.append("age_multi_cohort")
                flags.append("age_bounds_conflict_resolved")
                min_years = None
                max_years = None
            else:
                inferred_min = max(min_candidates) if min_candidates else None
                inferred_max = min(max_candidates) if max_candidates else None

                if inferred_min is not None and inferred_max is not None and inferred_min > inferred_max:
                    flags.append("age_bounds_conflict")
                    inferred_min = None
                    inferred_max = None

                merged_min = min_years
                merged_max = max_years
                used_text = False

                if min_years is None and inferred_min is not None:
                    merged_min = inferred_min
                    used_text = True
                if max_years is None and inferred_max is not None:
                    merged_max = inferred_max
                    used_text = True

                if merged_min is not None and merged_max is not None and merged_min > merged_max:
                    flags.append("age_bounds_conflict")
                    merged_min = min_years
                    merged_max = max_years
                    used_text = False

                if used_text:
                    flags.append("inferred_age_from_text")

                min_years = merged_min
                max_years = merged_max

        if not numeric_detected and not age_any and age_hint and "age_multi_cohort" not in flags:
            flags.append("age_hint_unparsed")

    if min_years is None and max_years is None:
        if not age_keywords_present and not numeric_detected:
            if "age_any_or_unspecified" not in flags:
                flags.append("age_any_or_unspecified")

    if min_years is None and max_years is None:
        if "age_multi_cohort" not in flags:
            if "age_hint_unparsed" in flags:
                flags.append("missing_age_bounds")
            elif trial.adult is False and trial.child is True and "inferred_age_from_flags" not in flags:
                flags.append("missing_age_bounds")

    return min_years, max_years, flags
