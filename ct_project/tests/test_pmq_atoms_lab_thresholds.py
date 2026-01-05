from pmq.atoms import extract_atoms_from_text
from pmq.rules import DEFAULT_RULES


ELIGIBILITY_TEXT = """
Inclusion Criteria:
- HbA1c <= 7.5%.
- eGFR >= 45 mL/min/1.73m2.
- QTc < 450 ms.
"""


def _find_atom(atoms, question_key: str):
    return next(a for a in atoms if a.question_key == question_key)


def test_hba1c_threshold_atom():
    atoms, _stats = extract_atoms_from_text(ELIGIBILITY_TEXT, rules=DEFAULT_RULES)
    atom = _find_atom(atoms, "hba1c_percent")
    assert atom.tier == 1
    assert atom.params["operator"] == "<="
    assert atom.params["threshold"] == 7.5
    assert "HbA1c" in atom.evidence


def test_egfr_threshold_atom():
    atoms, _stats = extract_atoms_from_text(ELIGIBILITY_TEXT, rules=DEFAULT_RULES)
    atom = _find_atom(atoms, "egfr")
    assert atom.tier == 1
    assert atom.params["operator"] == ">="
    assert atom.params["threshold"] == 45
    assert "eGFR" in atom.evidence


def test_qtc_threshold_atom():
    atoms, _stats = extract_atoms_from_text(ELIGIBILITY_TEXT, rules=DEFAULT_RULES)
    atom = _find_atom(atoms, "qtc_ms")
    assert atom.tier == 1
    assert atom.params["operator"] == "<"
    assert atom.params["threshold"] == 450
    assert "QTc" in atom.evidence
