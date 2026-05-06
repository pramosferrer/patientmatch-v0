import os
import re

PATH = "/Users/pramos11/ct_project/scripts/build_pm_trial_insights.py"

def final_fix():
    with open(PATH, "r") as f:
        content = f.read()

    # 1. Fix SQL (adding t.title)
    if 't.interventions_display,' in content and 't.title as brief_title,' not in content:
        content = content.replace('t.interventions_display,', 't.interventions_display,\n            t.title as brief_title,')

    # 2. Fix Unpacking (must include brief_title)
    # Be careful with the comma and spaces
    unpack_old = """        (
            nct_id,
            phase,
            eligibility_hash,
            conditions_display,
            interventions_display,
            site_count_us,
            states_list,
            question_count_total,
            readiness,
            quality_flags,
            eligibility_text_clean,
        ) = row"""
    unpack_new = """        (
            nct_id,
            phase,
            eligibility_hash,
            conditions_display,
            interventions_display,
            brief_title,
            site_count_us,
            states_list,
            question_count_total,
            readiness,
            quality_flags,
            eligibility_text_clean,
        ) = row"""
    content = content.replace(unpack_old, unpack_new)

    # 3. Fix trials.append (ensure it has title and eligibility_text)
    append_marker = '"interventions_display": list(interventions_display) if interventions_display is not None else [],'
    if append_marker in content and '"title":' not in content:
        content = content.replace(append_marker, append_marker + '\n                "title": brief_title or "",\n                "eligibility_text": eligibility_text,')

    # 4. Fix Loop Body (Corrupted Burden/Logistics calls)
    correct_loop_body = """        states_count = len({state for state in trial.get("states_list", []) if state})
        burden_score = _compute_burden(
            question_count_total=trial.get("question_count_total"),
            phase_raw=trial.get("phase"),
        )

        is_remote = _is_remote(trial.get("title", ""), trial.get("eligibility_text", ""))
        logistics_score = _compute_logistics(is_remote=is_remote)"""

    # Match the messy area
    pattern = r'states_count = len\(.*?logistics_score = _compute_logistics\(is_remote=is_remote\)\s*'
    content = re.sub(pattern, correct_loop_body, content, flags=re.DOTALL)

    with open(PATH, "w") as f:
        f.write(content)
    print("Final fix for build_pm_trial_insights.py applied")

if __name__ == "__main__":
    final_fix()
