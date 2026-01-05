from pathlib import Path
import importlib.util


def _load_module():
    root = Path(__file__).resolve().parents[1]
    module_path = root / "scripts" / "build_pm_trial_insights.py"
    spec = importlib.util.spec_from_file_location("build_pm_trial_insights", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_fallback_counts_dash_bullets():
    module = _load_module()
    text = """
Inclusion Criteria:
- Age >= 18
- ECOG 0-1
"""
    assert module.fallback_bullet_count(text) == 2


def test_fallback_counts_numbered_bullets():
    module = _load_module()
    text = """
Exclusion Criteria:
1. Prior chemo
2) Another exclusion
"""
    assert module.fallback_bullet_count(text) == 2


def test_fallback_ignores_headers_only():
    module = _load_module()
    text = """
Inclusion Criteria:
Exclusion Criteria:
"""
    assert module.fallback_bullet_count(text) == 0
