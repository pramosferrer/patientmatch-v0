path = "/Users/pramos11/ct_project/scripts/push_to_supabase.py"
with open(path, "r") as f:
    content = f.read()

debug_version = """
def build_select_sql(trials_cols, questionnaire_cols, insights_cols):
    print(f"DEBUG: insights_cols = {insights_cols}")
    selects = ["t.nct_id as nct_id"]

    for out_col, cand_list in TRIAL_CANDIDATES.items():
        picked = pick_column(trials_cols, cand_list)
        if picked:
            selects.append(f"t.{picked} as {out_col}")

    for out_col, cand_list in QUESTIONNAIRE_CANDIDATES.items():
        picked = pick_column(questionnaire_cols, cand_list)
        if picked:
            selects.append(f"q.{picked} as {out_col}")

    if insights_cols:
        for out_col, cand_list in INSIGHTS_CANDIDATES.items():
            picked = pick_column(insights_cols, cand_list)
            if picked:
                print(f"DEBUG: Picking {picked} for {out_col}")
                selects.append(f"i.{picked} as {out_col}")
    else:
        print("DEBUG: insights_cols is FALSEY!")

    res = "select\\n  " + ",\\n  ".join(selects)
    print(f"DEBUG: Final select_sql:\\n{res}")
    return res
"""

import re
pattern = r"def build_select_sql\(.*?\):.*?return \"select\\n  \" \+ \",\\n  \"\.join\(selects\)"
content = re.sub(pattern, debug_version, content, flags=re.DOTALL)

with open(path, "w") as f:
    f.write(content)
print("Injected debug build_select_sql")
