import os

path = "/Users/pramos11/ct_project/scripts/push_to_supabase.py"

def repair():
    # We will read the file and replace the messy parts with clean ones.
    # We have samples of most of the file from previous cat/sed.
    
    with open(path, "r") as f:
        lines = f.readlines()

    final_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # 1. Ensure INSIGHTS_CANDIDATES is there
        if "QUESTIONNAIRE_CANDIDATES =" in line and "INSIGHTS_CANDIDATES =" not in "".join(lines[max(0, i-50):i+50]):
             # We insert it after QUESTIONNAIRE_CANDIDATES block
             final_lines.append(line)
             i += 1
             # find end of questionnaire candidates
             while i < len(lines) and "}" not in lines[i]:
                 final_lines.append(lines[i])
                 i += 1
             if i < len(lines):
                 final_lines.append(lines[i])
                 i += 1
             final_lines.append("\nINSIGHTS_CANDIDATES = {\n")
             final_lines.append("    \"strictness_score\": [\"strictness_score\"],\n")
             final_lines.append("    \"burden_score\": [\"burden_score\"],\n")
             final_lines.append("    \"novelty_score\": [\"novelty_score\"],\n")
             final_lines.append("    \"logistics_score\": [\"logistics_score\"],\n")
             final_lines.append("    \"top_disqualifiers_json\": [\"top_disqualifiers_json\"],\n")
             final_lines.append("    \"insights_flags_json\": [\"insights_flags_json\"],\n")
             final_lines.append("}\n\n")
             continue

        # 2. Re-write build_select_sql
        if "def build_select_sql" in line:
            final_lines.append("def build_select_sql(trials_cols, questionnaire_cols, insights_cols):\n")
            final_lines.append("    selects = [\"t.nct_id as nct_id\"]\n")
            final_lines.append("\n")
            final_lines.append("    for out_col, cand_list in TRIAL_CANDIDATES.items():\n")
            final_lines.append("        picked = pick_column(trials_cols, cand_list)\n")
            final_lines.append("        if picked:\n")
            final_lines.append("            selects.append(f\"t.{picked} as {out_col}\")\n")
            final_lines.append("\n")
            final_lines.append("    for out_col, cand_list in QUESTIONNAIRE_CANDIDATES.items():\n")
            final_lines.append("        picked = pick_column(questionnaire_cols, cand_list)\n")
            final_lines.append("        if picked:\n")
            final_lines.append("            selects.append(f\"q.{picked} as {out_col}\")\n")
            final_lines.append("\n")
            final_lines.append("    if insights_cols:\n")
            final_lines.append("        for out_col, cand_list in INSIGHTS_CANDIDATES.items():\n")
            final_lines.append("            picked = pick_column(insights_cols, cand_list)\n")
            final_lines.append("            if picked:\n")
            final_lines.append("                selects.append(f\"i.{picked} as {out_col}\")\n")
            final_lines.append("\n")
            final_lines.append("    return \"select\\n  \" + \",\\n  \".join(selects)\n")
            
            # Skip until next function
            while i < len(lines) and "def " not in lines[i][4:] and "def build_cohort_select_sql" not in lines[i]:
                i += 1
            if i < len(lines) and "def build_select_sql" in lines[i]:
                 # Just in case there are duplicates
                 i += 1
            continue

        # 3. Fix push_tracer_bullet JOIN and SELECT logic
        if "def push_tracer_bullet" in line:
            # We will keep the function signature and start
            final_lines.append(line)
            i += 1
            # Go until the middle where we need to fix it
            while i < len(lines) and "questionnaire_agg_sql = None" not in lines[i]:
                final_lines.append(lines[i])
                i += 1
            
            # Insert the insights_cols fetch
            # But wait, it might already be there or messed up.
            # We will rewrite from here to from_sql
            final_lines.append("    insights_cols = get_table_columns(con, \"gold\", \"pm_trial_insights\")\n")
            final_lines.append("    questionnaire_agg_sql = None\n")
            final_lines.append("    questionnaire_join_sql = \"\"\n")
            final_lines.append("    cte_parts = []\n")
            final_lines.append("\n")
            final_lines.append("    if cohort_mode:\n")
            final_lines.append("        questionnaire_agg_sql = build_questionnaire_agg_sql(questionnaire_cols)\n")
            final_lines.append("        if questionnaire_agg_sql:\n")
            final_lines.append("            cte_parts.append(f\"questionnaire_agg as ({questionnaire_agg_sql})\")\n")
            final_lines.append("            questionnaire_join_sql = (\n")
            final_lines.append("                \"left join questionnaire_agg q on q.nct_id = t.nct_id\"\n")
            final_lines.append("            )\n")
            final_lines.append("        select_sql = build_cohort_select_sql(\n")
            final_lines.append("            trials_cols,\n")
            final_lines.append("            questionnaire_cols,\n")
            final_lines.append("            questionnaire_from_agg=bool(questionnaire_agg_sql),\n")
            final_lines.append("        )\n")
            final_lines.append("    else:\n")
            final_lines.append("        questionnaire_join_sql = \"join gold.pm_questionnaires q on q.nct_id = t.nct_id\"\n")
            final_lines.append("        select_sql = build_select_sql(trials_cols, questionnaire_cols, insights_cols)\n")
            final_lines.append("\n")
            final_lines.append("    insights_join_sql = \"left join gold.pm_trial_insights i on i.nct_id = t.nct_id\"\n")
            final_lines.append("    if build_tag:\n")
            final_lines.append("        insights_join_sql += f\" and i.pipeline_version = '{build_tag}'\"\n")
            final_lines.append("\n")
            final_lines.append("    from_sql = f\"\"\"\n")
            final_lines.append("    from gold.pm_trials_serving t\n")
            final_lines.append("    {questionnaire_join_sql}\n")
            final_lines.append("    {insights_join_sql}\n")
            final_lines.append("    \"\"\"\n")

            # Skip until where from_sql used to end
            while i < len(lines) and "from_sql = f\"\"\"" not in lines[i]:
                i += 1
            # skip the from_sql block in original
            if i < len(lines):
                 i += 1 # skip f"""
                 while i < len(lines) and "\"\"\"" not in lines[i]:
                     i += 1
                 if i < len(lines):
                     i += 1
            continue

        # 4. Clean up loops and DEBUG prints
        if "for rec in records:" in line:
            # We will clean up the loop body
            final_lines.append(line)
            i += 1
            # Skip any existing debug prints or corrupted lines
            while i < len(lines) and (lines[i].strip().startswith("if rec ==") or lines[i].strip().startswith("print(f") or "DEBUG" in lines[i]):
                 i += 1
            # The rest of the loop should be fine...?
            # Actually, let's just keep going and clean as we see them.
            continue
            
        if "DEBUG" in line:
             i += 1
             continue

        final_lines.append(line)
        i += 1

    with open(path, "w") as f:
        f.writelines(final_lines)
    print("Repaired push_to_supabase.py successfully")

if __name__ == "__main__":
    repair()
