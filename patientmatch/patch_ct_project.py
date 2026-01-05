def patch_question_bank():
    path = "/Users/pramos11/ct_project/pmq/question_bank.py"
    with open(path, "r") as f:
        content = f.read()
    
    if '"physical_activity": QuestionSpec(' in content:
        print("question_bank.py already patched")
        return

    new_specs = """
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
"""
    marker = "QUESTION_BANK: Dict[str, QuestionSpec] = {"
    if marker in content:
        content = content.replace(marker, marker + new_specs)
        with open(path, "w") as f:
            f.write(content)
        print("Patched question_bank.py successfully")
    else:
        print("Marker not found in question_bank.py")

def patch_rules():
    path = "/Users/pramos11/ct_project/pmq/rules.py"
    with open(path, "r") as f:
        content = f.read()
    
    if 'rule_id="physical_activity"' in content:
        print("rules.py already patched")
        return

    new_rules = """
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
        "coronary artery disease", "heart disease", "myocardial infarction", "cad", "heart attack",
        "congestive heart failure", "chf"
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
    keywords=["insulin", "basal insulin", "non-basal insulin", "insulin pump"],
    kind="medication",
))

DEFAULT_RULES.append(KeywordRule(
    rule_id="generic_condition_history",
    description="Generic history of common conditions (Asthma, BP, etc).",
    question_key="condition_history",
    sections=["inclusion", "exclusion", "unknown"],
    keywords=[
        "asthma", "high blood pressure", "hypertension", "copd", "arthritis", "thyroid",
        "kidney disease", "renal impairment", "stroke", "tia"
    ],
    kind="comorbidity",
    clinic_only=True,
    tier=2,
))
"""
    # Insert before the first function or at the end of appends
    marker = "def criterion_from_atom"
    if marker in content:
        content = content.replace(marker, new_rules + "\n\n" + marker)
        with open(path, "w") as f:
            f.write(content)
        print("Patched rules.py successfully")
    else:
        print("Marker not found in rules.py")

if __name__ == "__main__":
    patch_rules()
    patch_question_bank()
