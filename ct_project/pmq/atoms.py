"""
Atomic eligibility matches derived from parsed bullets.

Atoms are the lowest-level, deterministic hits produced by rules.
They retain the original evidence text for traceability.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol, Sequence, Tuple

from pmq.eligibility_parser import Bullet, Section, iter_all_bullets_with_fallback


@dataclass
class EligibilityAtom:
    atom_id: str
    section: Section
    question_key: str
    kind: str
    tier: int = 1

    qualifies_when: Optional[Any] = None
    disqualify_when: Optional[Any] = None

    params: Dict[str, Any] = field(default_factory=dict)
    clinic_only: bool = False

    evidence: str = ""
    rule_id: str = ""


class AtomRule(Protocol):
    def apply(self, bullet: Bullet, idx: int) -> Optional[EligibilityAtom]:
        ...


def extract_atoms_from_text(
    eligibility_text: str,
    *,
    rules: Optional[Sequence[AtomRule]] = None,
    max_atoms: int = 200,
) -> Tuple[List[EligibilityAtom], Dict[str, Any]]:
    if rules is None:
        raise ValueError("rules must be provided to extract_atoms_from_text; pass DEFAULT_RULES or a rule list.")
    rule_list = list(rules)

    bullets = iter_all_bullets_with_fallback(eligibility_text)
    extracted: List[EligibilityAtom] = []

    total_bullets = len(bullets)
    covered_bullets = 0

    for i, b in enumerate(bullets):
        hit = False
        for r in rule_list:
            atom = r.apply(b, idx=i)
            if atom:
                extracted.append(atom)
                hit = True
                if len(extracted) >= max_atoms:
                    break
        if hit:
            covered_bullets += 1
        if len(extracted) >= max_atoms:
            break

    stats = {
        "total_bullets": total_bullets,
        "covered_bullets": covered_bullets,
        "coverage_ratio": (covered_bullets / total_bullets) if total_bullets else 0.0,
        "criteria_count": len(extracted),
        "atom_count": len(extracted),
    }
    extracted = sorted(
        extracted,
        key=lambda atom: (
            atom.section,
            atom.question_key,
            atom.kind,
            atom.tier,
            atom.rule_id,
            atom.atom_id,
        ),
    )
    return extracted, stats
