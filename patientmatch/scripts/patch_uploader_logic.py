import os

PATH = "/Users/pramos11/ct_project/scripts/push_to_supabase.py"

def patch_file():
    with open(PATH, "r") as f:
        content = f.read()

    # Move insights_cols definition up
    # First, undo the previous bad patch if it exists
    content = content.replace('select_sql = build_select_sql(trials_cols, questionnaire_cols, insights_cols)', 
                            'select_sql = build_select_sql(trials_cols, questionnaire_cols)')
    
    # Now apply the fix correctly
    insights_cols_def = '    insights_cols = get_table_columns(con, "gold", "pm_trial_insights")'
    if insights_cols_def not in content:
        content = content.replace('    trials_cols = get_table_columns(con, "gold", "pm_trials_serving")',
                                '    trials_cols = get_table_columns(con, "gold", "pm_trials_serving")\\n' + insights_cols_def)

    # Update build_select_sql calls (all of them)
    content = content.replace('build_select_sql(trials_cols, questionnaire_cols)', 
                            'build_select_sql(trials_cols, questionnaire_cols, insights_cols)')

    with open(PATH, "w") as f:
        f.write(content)
    print("Correctly patched push_to_supabase.py")

if __name__ == "__main__":
    patch_file()
