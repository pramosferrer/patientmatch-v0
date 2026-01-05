path = "/Users/pramos11/ct_project/scripts/push_to_supabase.py"
with open(path, "r") as f:
    lines = f.readlines()

clean_lines = []
for line in lines:
    if "for rec in records:\\n" in line:
        continue
    clean_lines.append(line)

with open(path, "w") as f:
    f.writelines(clean_lines)
print("Cleaned up push_to_supabase.py")
