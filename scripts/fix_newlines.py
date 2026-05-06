path = "/Users/pramos11/ct_project/scripts/build_pm_trial_insights.py"
with open(path, "r") as f:
    content = f.read()

# Replace the literal characters \ and n with a real newline
# only where we expect our corruption to be
content = content.replace("is_remote)\n        novelty", "is_remote)\n        novelty") # Wait, if it's already fixed?
# Actually, the problem is it looks like \n but it's backslash n.

content = content.replace("\\n", "\n")

with open(path, "w") as f:
    f.write(content)
print("Manually cleaned up build_pm_trial_insights.py")
