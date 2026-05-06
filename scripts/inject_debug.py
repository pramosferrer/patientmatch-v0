path = "/Users/pramos11/ct_project/scripts/push_to_supabase.py"
with open(path, "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    new_lines.append(line)
    if "for rec in records:" in line and "insights_records" not in line and "site_records" not in line:
        # This is likely the main trials loop
        indent = line[:line.find("for")]
        new_lines.append(f"{indent}    if rec.get('nct_id') == 'NCT00004317':\n")
        new_lines.append(f"{indent}        print(f'DEBUG TRIALS NCT00004317 keys: {{list(rec.keys())}}')\n")
        new_lines.append(f"{indent}        print(f'DEBUG TRIALS NCT00004317 burden: {{rec.get(\"burden_score\")}}')\n")

with open(path, "w") as f:
    f.writelines(new_lines)
print("Injected specific trial debug into push_to_supabase.py")
