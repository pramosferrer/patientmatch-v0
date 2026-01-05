import pytest

from pmq.atoms import extract_atoms_from_text
from pmq.generator import TrialRow, generate_questionnaire
from pmq.rules import DEFAULT_RULES, dedupe_criteria, extract_criteria_from_text


ELIGIBILITY_TEXT = """
Inclusion Criteria:
- Use of an investigational drug within 30 days.
- Use of an investigational agent within 12 months.
"""


def test_atoms_requires_rules():
    with pytest.raises(ValueError, match="rules must be provided"):
        extract_atoms_from_text(ELIGIBILITY_TEXT, rules=None)


def test_atoms_deterministic():
    atoms1, stats1 = extract_atoms_from_text(ELIGIBILITY_TEXT, rules=DEFAULT_RULES)
    atoms2, stats2 = extract_atoms_from_text(ELIGIBILITY_TEXT, rules=DEFAULT_RULES)
    assert atoms1 == atoms2
    assert stats1 == stats2


def test_dedupe_keeps_two_windows():
    criteria, _stats = extract_criteria_from_text(ELIGIBILITY_TEXT, rules=DEFAULT_RULES)
    deduped = dedupe_criteria(criteria)
    windows = [c for c in deduped if c.question_key == "recent_investigational_drug"]
    assert len(windows) == 2


def test_generator_multiple_logic_entries():
    criteria, stats = extract_criteria_from_text(ELIGIBILITY_TEXT, rules=DEFAULT_RULES)
    trial = TrialRow(
        nct_id="NCT00000000",
        title="Test Trial",
        phase="PHASE1",
        gender="ALL",
        min_age_years=18.0,
        max_age_years=65.0,
        healthy_volunteers=False,
        conditions_display=["Condition A"],
        condition_slugs=["condition-a"],
        eligibility_hash="hash",
        eligibility_text_clean=ELIGIBILITY_TEXT,
        adult=True,
        child=False,
        older_adult=False,
    )
    result = generate_questionnaire(
        trial,
        criteria,
        pipeline_version="pmq_test",
        extraction_stats=stats,
    )

    qjson = result.questionnaire
    all_questions = qjson["questions"] + qjson["optional_questions"]
    target = next(q for q in all_questions if q["question_key"] == "recent_investigational_drug")
    assert len(target.get("logic", [])) == 2
    assert target.get("logic_operator") == "AND"
    assert "multi_constraints_same_question" in result.quality_flags
    assert "multi_time_windows_same_question" in result.quality_flags
