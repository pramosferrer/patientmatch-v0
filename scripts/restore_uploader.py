import os

path = "/Users/pramos11/ct_project/scripts/push_to_supabase.py"
with open(path, "r") as f:
    lines = f.readlines()

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if "filtered = []" in line:
        new_lines.append(line)
        new_lines.append("    for rec in records:\n")
        i += 1
        continue
    if "insights_records = []" in line:
        new_lines.append(line)
        new_lines.append("        for rec in records:\n")
        i += 1
        continue
    new_lines.append(line)
    i += 1

with open(path, "w") as f:
    f.writelines(new_lines)
print("Restored loops in push_to_supabase.py")
