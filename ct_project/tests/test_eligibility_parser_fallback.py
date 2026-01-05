from pmq.atoms import extract_atoms_from_text
from pmq.eligibility_parser import iter_all_bullets_with_fallback
from pmq.rules import DEFAULT_RULES


def test_tilde_delimited_headers_split():
    text = """
Inclusion Criteria:~1. HbA1c <= 7.5%~2. eGFR >= 45 mL/min/1.73m2~Exclusion Criteria:~1. QTc < 450 ms
"""
    bullets = iter_all_bullets_with_fallback(text)
    assert len(bullets) >= 3
    assert bullets[0].section == "inclusion"
    assert bullets[-1].section == "exclusion"


def test_section_carry_forward():
    text = """
Inclusion Criteria:~Patients must be >= 18 years old.
Exclusion Criteria:~History of stroke.
"""
    bullets = iter_all_bullets_with_fallback(text)
    inc = [b for b in bullets if b.section == "inclusion"]
    exc = [b for b in bullets if b.section == "exclusion"]
    assert inc
    assert exc


def test_rules_fire_on_fragments():
    text = """
Inclusion Criteria: All patients must have HbA1c <= 7.5%; eGFR >= 45 mL/min/1.73m2.
"""
    atoms, _stats = extract_atoms_from_text(text, rules=DEFAULT_RULES)
    qkeys = {a.question_key for a in atoms}
    assert "hba1c_percent" in qkeys
    assert "egfr" in qkeys
