"""
Helpers for reading criteria_json payloads from gold.pm_trial_criteria.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple


def unpack_criteria_json(criteria_json_obj: Any) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Accepts either:
      - legacy list: [ ...criteria... ]
      - new wrapper: { "criteria": [...], "stats": {...} }

    Returns: (criteria_list, stats_dict)
    """
    if criteria_json_obj is None:
        return [], {}

    if isinstance(criteria_json_obj, list):
        return criteria_json_obj, {}

    if isinstance(criteria_json_obj, dict):
        crit = criteria_json_obj.get("criteria") or []
        stats = criteria_json_obj.get("stats") or {}
        return (crit if isinstance(crit, list) else []), (stats if isinstance(stats, dict) else {})

    return [], {}


if __name__ == "__main__":
    legacy = [{"question_key": "age_years"}]
    wrapped = {"criteria": legacy, "stats": {"atom_count": 3}}

    c1, s1 = unpack_criteria_json(legacy)
    assert c1 == legacy and s1 == {}

    c2, s2 = unpack_criteria_json(wrapped)
    assert c2 == legacy and s2["atom_count"] == 3

    print("criteria_io.py self-test passed")
