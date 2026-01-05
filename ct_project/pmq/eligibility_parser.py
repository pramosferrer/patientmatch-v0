"""
Eligibility criteria parsing utilities.

We use a pragmatic parser that:
- splits the text into inclusion/exclusion/unknown sections
- extracts bullet-ish criteria lines with simple continuation handling

This is intentionally conservative: it is designed to support deterministic rule extraction.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Literal, Optional, Tuple

Section = Literal["inclusion", "exclusion", "unknown"]


HEADER_INCLUSION_RE = re.compile(r"^\s*inclusion\s+criteria\s*[:\-]?\s*(?P<rest>.*)$", re.IGNORECASE)
HEADER_EXCLUSION_RE = re.compile(r"^\s*exclusion\s+criteria\s*[:\-]?\s*(?P<rest>.*)$", re.IGNORECASE)
HEADER_INCLUSION_SHORT_RE = re.compile(r"^\s*inclusion\s*[:\-]\s*(?P<rest>.*)$", re.IGNORECASE)
HEADER_EXCLUSION_SHORT_RE = re.compile(r"^\s*exclusion\s*[:\-]\s*(?P<rest>.*)$", re.IGNORECASE)

HEADER_INCLUSION_INLINE_RE = re.compile(r"\binclusion\s+criteria\b", re.IGNORECASE)
HEADER_EXCLUSION_INLINE_RE = re.compile(r"\bexclusion\s+criteria\b", re.IGNORECASE)

BULLET_START_RE = re.compile(
    r"""^\s*(?:
        [\-\*\u2022\u00B7\u2219\u25E6\u25AA\u25AB\u25CF]\s+    # -,*,•,· etc
        |(?:\(?\d{1,3}\)?[\.\)]\s+)                           # 1. 2) (3).
        |(?:[A-Za-z][\.\)]\s+)                                # a) b.
        )""",
    re.VERBOSE,
)


@dataclass(frozen=True)
class Bullet:
    section: Section
    text: str


def _clean_lines(text: str) -> List[str]:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("~", "\n")
    lines = [ln.strip() for ln in text.split("\n")]
    return [ln for ln in lines if ln]


def _match_header_line(line: str) -> Optional[Tuple[Section, str]]:
    for section, pat in (
        ("inclusion", HEADER_INCLUSION_RE),
        ("exclusion", HEADER_EXCLUSION_RE),
        ("inclusion", HEADER_INCLUSION_SHORT_RE),
        ("exclusion", HEADER_EXCLUSION_SHORT_RE),
    ):
        m = pat.match(line)
        if not m:
            continue
        rest = m.group("rest") or ""
        return (section, rest.strip())
    return None


def split_sections(eligibility_text: str) -> Tuple[str, str, str]:
    """
    Returns (inclusion_text, exclusion_text, unknown_text).
    """
    lines = _clean_lines(eligibility_text)
    if not lines:
        return ("", "", "")

    inc_idx: Optional[int] = None
    exc_idx: Optional[int] = None
    inc_rest: Optional[str] = None
    exc_rest: Optional[str] = None

    for i, ln in enumerate(lines):
        header = _match_header_line(ln)
        if inc_idx is None and header and header[0] == "inclusion":
            inc_idx = i
            inc_rest = header[1]
            continue
        if exc_idx is None and header and header[0] == "exclusion":
            exc_idx = i
            exc_rest = header[1]

    if inc_idx is None and exc_idx is None:
        text_joined = "\n".join(lines)
        m_inc = HEADER_INCLUSION_INLINE_RE.search(text_joined)
        m_exc = HEADER_EXCLUSION_INLINE_RE.search(text_joined)
        if m_inc and m_exc:
            if m_inc.start() < m_exc.start():
                inc = text_joined[m_inc.end(): m_exc.start()]
                exc = text_joined[m_exc.end():]
                return (inc.strip(), exc.strip(), "")
            return ("", "", text_joined.strip())
        return ("", "", text_joined.strip())

    if inc_idx is not None and exc_idx is None:
        inc_lines = []
        if inc_rest:
            inc_lines.append(inc_rest)
        inc_lines.extend(lines[inc_idx + 1 :])
        inc = "\n".join(inc_lines).strip()
        return (inc, "", "")
    if exc_idx is not None and inc_idx is None:
        exc_lines = []
        if exc_rest:
            exc_lines.append(exc_rest)
        exc_lines.extend(lines[exc_idx + 1 :])
        exc = "\n".join(exc_lines).strip()
        return ("", exc, "")

    assert inc_idx is not None and exc_idx is not None
    if inc_idx < exc_idx:
        inc_lines = []
        if inc_rest:
            inc_lines.append(inc_rest)
        inc_lines.extend(lines[inc_idx + 1 : exc_idx])
        exc_lines = []
        if exc_rest:
            exc_lines.append(exc_rest)
        exc_lines.extend(lines[exc_idx + 1 :])
        inc = "\n".join(inc_lines).strip()
        exc = "\n".join(exc_lines).strip()
        return (inc, exc, "")

    return ("", "", "\n".join(lines).strip())


def extract_bullets(section_text: str, *, section: Section) -> List[Bullet]:
    """
    Split section text into bullet-ish line items.

    Strategy:
    - treat lines starting with bullet/numbering tokens as bullet starts
    - otherwise, join as continuation of previous bullet
    """
    lines = _clean_lines(section_text)
    bullets: List[str] = []
    for ln in lines:
        if BULLET_START_RE.match(ln):
            cleaned = BULLET_START_RE.sub("", ln).strip()
            bullets.append(cleaned)
        else:
            if bullets:
                bullets[-1] = (bullets[-1] + " " + ln).strip()
            else:
                bullets.append(ln.strip())

    out = []
    for b in bullets:
        b2 = re.sub(r"\s+", " ", b).strip()
        if b2:
            out.append(Bullet(section=section, text=b2))
    return out


INLINE_HEADER_RE = re.compile(r"\b(inclusion|exclusion)\s+criteria\b", re.IGNORECASE)
SEMICOLON_SPLIT_MIN_LEN = 200
PERIOD_SPLIT_MIN_LEN = 300
MIN_CLAUSE_LEN = 40


def _split_inline_headers(line: str) -> List[Tuple[Optional[Section], str]]:
    matches = list(INLINE_HEADER_RE.finditer(line))
    if not matches:
        return [(None, line)]
    segments: List[Tuple[Optional[Section], str]] = []
    current: Optional[Section] = None
    last = 0
    for m in matches:
        if m.start() > last:
            seg = line[last : m.start()].strip()
            if seg:
                segments.append((current, seg))
        current = "inclusion" if m.group(1).lower() == "inclusion" else "exclusion"
        last = m.end()
    tail = line[last:].strip()
    if tail:
        segments.append((current, tail))
    return segments


def _split_on_semicolons(line: str) -> List[str]:
    if len(line) <= SEMICOLON_SPLIT_MIN_LEN or ";" not in line:
        return [line]
    parts = [p.strip() for p in line.split(";") if p.strip()]
    if len(parts) <= 1:
        return [line]
    if all(len(p) >= MIN_CLAUSE_LEN for p in parts):
        return parts
    return [line]


def _split_on_periods(line: str) -> List[str]:
    if len(line) <= PERIOD_SPLIT_MIN_LEN or ". " not in line:
        return [line]
    parts = [p.strip() for p in re.split(r"(?<=\.)\s+", line) if p.strip()]
    if len(parts) <= 1:
        return [line]
    if all(len(p) >= MIN_CLAUSE_LEN for p in parts):
        return parts
    return [line]


def _fallback_bullets(eligibility_text: str, *, max_bullets: int = 120) -> List[Bullet]:
    lines = _clean_lines(eligibility_text)
    if not lines:
        return []
    bullets: List[Bullet] = []
    section: Section = "unknown"
    for line in lines:
        header = _match_header_line(line)
        if header:
            section = header[0]
            line = header[1]
            if not line:
                continue
        for seg_section, seg_text in _split_inline_headers(line):
            if seg_section is not None:
                section = seg_section
            text = seg_text.lstrip(":;- ").strip()
            if not text:
                continue
            chunks: List[str] = []
            for chunk in _split_on_semicolons(text):
                chunks.extend(_split_on_periods(chunk))
            for chunk in chunks:
                cleaned = BULLET_START_RE.sub("", chunk).strip()
                cleaned = re.sub(r"\s+", " ", cleaned).strip()
                if not cleaned:
                    continue
                bullets.append(Bullet(section=section, text=cleaned))
                if len(bullets) >= max_bullets:
                    return bullets
    return bullets


def iter_all_bullets(eligibility_text: str) -> List[Bullet]:
    inc, exc, unk = split_sections(eligibility_text)
    bullets: List[Bullet] = []
    if inc:
        bullets.extend(extract_bullets(inc, section="inclusion"))
    if exc:
        bullets.extend(extract_bullets(exc, section="exclusion"))
    if unk:
        bullets.extend(extract_bullets(unk, section="unknown"))
    return bullets


def _expand_bullets_clause_split(bullets: List[Bullet], *, max_bullets: int = 120) -> List[Bullet]:
    """
    If primary parsing returns very long bullets (common in mixed-format criteria),
    split those bullets into clause-like chunks using the existing semicolon/period heuristics.
    """
    out: List[Bullet] = []
    for b in bullets:
        chunks: List[str] = []
        for chunk in _split_on_semicolons(b.text):
            chunks.extend(_split_on_periods(chunk))

        if len(chunks) == 1 and chunks[0] == b.text:
            out.append(b)
        else:
            for ch in chunks:
                cleaned = re.sub(r"\s+", " ", ch).strip()
                if cleaned:
                    out.append(Bullet(section=b.section, text=cleaned))
                if len(out) >= max_bullets:
                    return out

        if len(out) >= max_bullets:
            return out

    return out


def iter_all_bullets_with_fallback(eligibility_text: str, *, max_bullets: int = 120) -> List[Bullet]:
    """
    Hybrid strategy:
    1) Primary section + bullet-ish extraction
    2) Clause-split very long bullets
    3) If the result still looks under-split for a long text, prefer full fallback bullets
    """
    primary = iter_all_bullets(eligibility_text)
    if not primary:
        return _fallback_bullets(eligibility_text, max_bullets=max_bullets)

    expanded = _expand_bullets_clause_split(primary, max_bullets=max_bullets)

    clean_text = " ".join(_clean_lines(eligibility_text))
    if len(expanded) < 4 and len(clean_text) >= 600:
        fb = _fallback_bullets(eligibility_text, max_bullets=max_bullets)
        if len(fb) > len(expanded):
            return fb

    return expanded
