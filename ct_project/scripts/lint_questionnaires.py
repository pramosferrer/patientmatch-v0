#!/usr/bin/env python3
"""
Questionnaire quality linter + readability report.

Computes text metrics for all questions and optional questions in gold.pm_questionnaires.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import duckdb


DEFAULT_PIPELINE_VERSION = "pmq_v5_age_bullets_2025_12_22"

WORD_RE = re.compile(r"[A-Za-z0-9']+")
SENTENCE_RE = re.compile(r"[.!?]+")
VOWEL_GROUP_RE = re.compile(r"[aeiouy]+", re.I)

DOUBLE_BARRELED_RE = re.compile(r"\band/or\b", re.I)
VERB_RE = re.compile(
    r"\b(are|is|was|were|be|been|have|has|had|do|does|did|take|takes|taken|taking|receive|received|receiving|use|used|using|"
    r"willing|enroll|enrolled|enrolling|participate|participating|volunteer|volunteering|diagnosed|diagnosis|need|needs|needed)\b",
    re.I,
)

JARGON_TOKENS = [
    "ECOG",
    "HbA1c",
    "eGFR",
    "INR",
    "BMI",
    "CBC",
    "CMP",
    "MRI",
    "CT",
    "PET",
    "ECG",
    "EKG",
    "ALT",
    "AST",
    "LDL",
    "HDL",
    "IVUS",
    "OCT",
    "PTA",
    "HIV",
    "HBV",
    "HCV",
    "COPD",
    "BP",
]


@dataclass
class QuestionMetric:
    question_key: str
    question_text: str
    count: int
    readability: float
    word_count: int
    char_count: int
    flags: List[str]


def _syllable_count(word: str) -> int:
    w = word.lower()
    if not w:
        return 0
    w = re.sub(r"[^a-z]", "", w)
    if not w:
        return 0
    groups = VOWEL_GROUP_RE.findall(w)
    count = len(groups)
    if w.endswith("e") and len(w) > 2 and not w.endswith("le"):
        count = max(1, count - 1)
    return max(1, count)


def _flesch_kincaid_grade(text: str, word_count: int, sentence_count: int) -> float:
    if word_count == 0:
        return 0.0
    sentences = max(1, sentence_count)
    syllables = sum(_syllable_count(w) for w in WORD_RE.findall(text))
    return 0.39 * (word_count / sentences) + 11.8 * (syllables / word_count) - 15.59


def _word_count(text: str) -> int:
    return len(WORD_RE.findall(text))


def _sentence_count(text: str) -> int:
    return len(SENTENCE_RE.findall(text)) or (1 if text.strip() else 0)


def _has_verb(text: str) -> bool:
    return VERB_RE.search(text) is not None


def _detect_double_barreled(text: str) -> bool:
    if DOUBLE_BARRELED_RE.search(text):
        return True
    if ";" in text:
        return True
    if _sentence_count(text) > 1:
        return True

    lowered = text.lower()
    for conj in (" and ", " or "):
        if conj not in lowered:
            continue
        for match in re.finditer(re.escape(conj), lowered):
            left = text[: match.start()]
            right = text[match.end() :]
            if _has_verb(left) and _has_verb(right):
                return True
    return False


def _detect_jargon(text: str) -> List[str]:
    found = []
    for token in JARGON_TOKENS:
        if re.search(rf"\b{re.escape(token)}\b", text, re.I):
            found.append(token)
    return found


def _iter_question_instances(qjson: Dict[str, object]) -> Iterable[Tuple[str, str]]:
    for section in ("questions", "optional_questions"):
        items = qjson.get(section)
        if not isinstance(items, list):
            continue
        for q in items:
            if not isinstance(q, dict):
                continue
            key = str(q.get("question_key") or "").strip()
            text = str(q.get("text") or "").strip()
            if key and text:
                yield key, text


def _read_questionnaires(con: duckdb.DuckDBPyConnection, pipeline_version: str, limit: Optional[int]) -> Iterable[Dict[str, object]]:
    limit_clause = f"LIMIT {int(limit)}" if limit is not None else ""
    rows = con.execute(
        f"""
        SELECT questionnaire_json
        FROM gold.pm_questionnaires
        WHERE pipeline_version = ?
        {limit_clause};
        """,
        [pipeline_version],
    ).fetchall()
    for (qjson,) in rows:
        if not qjson:
            continue
        yield json.loads(qjson)


def _readability_bucket(score: float) -> str:
    if score < 5:
        return "<5"
    if score < 8:
        return "5-8"
    if score < 12:
        return "8-12"
    if score < 16:
        return "12-16"
    return ">=16"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--db", required=True, help="Path to aact.duckdb")
    p.add_argument("--pipeline-version", default=DEFAULT_PIPELINE_VERSION)
    p.add_argument("--out-csv", default="reports/questionnaire_lint_pmq_v5_age_bullets_2025_12_22.csv")
    p.add_argument("--limit-trials", type=int, default=None, help="Optional limit on questionnaires scanned")
    p.add_argument("--max-unique", type=int, default=2000, help="Max unique (question_key, question_text) rows")
    p.add_argument("--top-k-worst", type=int, default=50)
    args = p.parse_args()

    con = duckdb.connect(args.db, read_only=False)

    metrics_map: Dict[Tuple[str, str], QuestionMetric] = {}
    jargon_counts: Counter[str] = Counter()
    jargon_examples: Dict[str, set] = defaultdict(set)
    skipped = 0

    for qjson in _read_questionnaires(con, args.pipeline_version, args.limit_trials):
        for key, text in _iter_question_instances(qjson):
            metric_key = (key, text)
            if metric_key in metrics_map:
                metrics_map[metric_key].count += 1
                continue
            if args.max_unique is not None and len(metrics_map) >= args.max_unique:
                skipped += 1
                continue

            char_count = len(text)
            words = _word_count(text)
            sentences = _sentence_count(text)
            readability = _flesch_kincaid_grade(text, words, sentences)
            flags: List[str] = []
            if _detect_double_barreled(text):
                flags.append("double_barreled")
            jargon = _detect_jargon(text)
            if jargon:
                flags.append("jargon:" + ",".join(sorted(jargon)))
                for token in jargon:
                    jargon_counts[token] += 1
                    jargon_examples[token].add(f"{key}: {text}")

            metrics_map[metric_key] = QuestionMetric(
                question_key=key,
                question_text=text,
                count=1,
                readability=readability,
                word_count=words,
                char_count=char_count,
                flags=flags,
            )

    metrics = list(metrics_map.values())
    readability_dist_unique = Counter()
    readability_dist_weighted = Counter()
    for m in metrics:
        bucket = _readability_bucket(m.readability)
        readability_dist_unique[bucket] += 1
        readability_dist_weighted[bucket] += m.count

    out_path = Path(args.out_csv)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["question_key", "question_text", "count", "readability", "word_count", "flags"])
        for m in metrics:
            writer.writerow([
                m.question_key,
                m.question_text,
                m.count,
                f"{m.readability:.2f}",
                m.word_count,
                "|".join(m.flags),
            ])

    print("Readability distribution (unique texts, Flesch-Kincaid grade):")
    for bucket in ("<5", "5-8", "8-12", "12-16", ">=16"):
        print(f"  {bucket}: {readability_dist_unique.get(bucket, 0)}")

    print("\nReadability distribution (weighted by count):")
    for bucket in ("<5", "5-8", "8-12", "12-16", ">=16"):
        print(f"  {bucket}: {readability_dist_weighted.get(bucket, 0)}")

    worst = sorted(metrics, key=lambda m: (m.readability, m.char_count), reverse=True)[: args.top_k_worst]
    print(f"\nTop {len(worst)} worst questions (readability, length):")
    for m in worst:
        print(f"  {m.readability:.2f}\t{m.char_count}\t{m.count}\t{m.question_key}\t{m.question_text}")

    print("\nMost common jargon tokens:")
    for token, count in jargon_counts.most_common(20):
        examples = sorted(jargon_examples[token])[:5]
        print(f"  {token}: {count}")
        for ex in examples:
            print(f"    - {ex}")

    if skipped:
        print(f"\nSkipped {skipped} question instances due to --max-unique")
    print(f"\nUnique questions: {len(metrics)}")
    print(f"Wrote CSV to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
