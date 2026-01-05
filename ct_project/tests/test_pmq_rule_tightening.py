from pmq.atoms import extract_atoms_from_text
from pmq.rules import DEFAULT_RULES


def _qkeys(text: str):
    atoms, _stats = extract_atoms_from_text(text, rules=DEFAULT_RULES)
    return {a.question_key for a in atoms}, atoms


def test_investigational_washout_requires_anchor_and_window():
    text = """
Inclusion Criteria:
- Received an investigational agent within 30 days prior to screening.
"""
    qkeys, atoms = _qkeys(text)
    assert "recent_investigational_drug" in qkeys
    atom = next(a for a in atoms if a.question_key == "recent_investigational_drug")
    assert atom.params.get("window_days") == 30


def test_investigational_current_study_contraindication_excluded():
    text = """
Exclusion Criteria:
- Contraindication to the investigational drug / study drug.
"""
    qkeys, _atoms = _qkeys(text)
    assert "recent_investigational_drug" not in qkeys


def test_investigational_pre_dose_excluded():
    text = """
Exclusion Criteria:
- No CYP3A4 inhibitors within 14 days before first dose of study drug.
"""
    qkeys, _atoms = _qkeys(text)
    assert "recent_investigational_drug" not in qkeys


def test_concurrent_investigational_maps_to_current_trial():
    text = """
Exclusion Criteria:
- No other investigational agent while on study.
"""
    qkeys, _atoms = _qkeys(text)
    assert "currently_in_other_trial" in qkeys
    assert "recent_investigational_drug" not in qkeys


def test_optune_concurrent_maps_to_current_trial():
    text = """
Exclusion Criteria:
- Concurrent Optune therapy is not permitted during this study.
"""
    qkeys, _atoms = _qkeys(text)
    assert "currently_in_other_trial" in qkeys
    assert "recent_investigational_drug" not in qkeys


def test_alt_uln_not_liver_disease():
    text = """
Exclusion Criteria:
- ALT <= 3x ULN.
"""
    qkeys, _atoms = _qkeys(text)
    assert "liver_disease" not in qkeys
    assert "abnormal_labs" in qkeys


def test_cirrhosis_triggers_liver_disease():
    text = """
Exclusion Criteria:
- History of cirrhosis.
"""
    qkeys, _atoms = _qkeys(text)
    assert "liver_disease" in qkeys


def test_metastatic_liver_disease_veto():
    text = """
Exclusion Criteria:
- Measurable metastatic liver disease.
"""
    qkeys, _atoms = _qkeys(text)
    assert "liver_disease" not in qkeys


def test_hepatic_mets_veto():
    text = """
Exclusion Criteria:
- Evidence of hepatic mets on imaging.
"""
    qkeys, _atoms = _qkeys(text)
    assert "liver_disease" not in qkeys


def test_hepatic_impairment_triggers_liver_disease():
    text = """
Exclusion Criteria:
- Hepatic impairment (Child-Pugh B or C).
"""
    qkeys, _atoms = _qkeys(text)
    assert "liver_disease" in qkeys


def test_non_clinically_significant_lab_negation():
    text = """
Exclusion Criteria:
- Non-clinically significant laboratory abnormalities.
"""
    qkeys, _atoms = _qkeys(text)
    assert "clinically_significant_condition" not in qkeys
    assert "abnormal_labs" not in qkeys
