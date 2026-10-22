"""Deterministic matching of A-authorized public catalog metadata; no raw-data delivery."""
import math
import re

from .intent import SearchIntent, parse_intent


def _discoverable_record(item) -> bool:
    """Guard the catalog boundary without treating catalog flags as delivery authorization."""
    if not isinstance(item, dict) or item.get("can_discover") is not True:
        return False
    slice_id, version, columns = item.get("slice_id"), item.get("version"), item.get("columns")
    return bool(
        isinstance(slice_id, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,120}", slice_id)
        and isinstance(version, str) and re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", version)
        and isinstance(item.get("domain"), str)
        and isinstance(item.get("metadata"), dict)
        and isinstance(columns, list) and 1 <= len(columns) <= 64
        and all(isinstance(name, str) and 1 <= len(name) <= 100 for name in columns)
        and len(set(columns)) == len(columns)
    )


def _finite_measurement(value) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def match_catalog(intent: SearchIntent | dict, visible_catalog: list[dict]) -> list[dict]:
    intent = intent if isinstance(intent, SearchIntent) else parse_intent(intent)
    output = []
    if not isinstance(visible_catalog, list):
        return output
    for item in visible_catalog:
        # A must filter per-request ACLs before calling. Invalid or hidden records emit nothing.
        if not _discoverable_record(item):
            continue
        metadata = item.get("metadata", {})
        reasons, unknown = [], []
        if item.get("domain") != intent.domain:
            reasons.append("domain_mismatch")
        if not set(intent.required_columns).issubset(item.get("columns", [])):
            reasons.append("required_columns_missing")
        if metadata.get("license") is None:
            unknown.append("license")
        elif metadata["license"] not in intent.allowed_licenses:
            reasons.append("license_not_allowed")
        if metadata.get("data_origin") != "experimental":
            reasons.append("experimental_origin_required")
        if item.get("blocking_failure") is not False:
            reasons.append("blocking_check_failed_or_unknown")
        for field, expected in intent.equals.items():
            observed = metadata.get(field)
            if observed is None:
                unknown.append(field)
            elif not isinstance(observed, str) or observed.casefold() != expected.casefold():
                reasons.append(f"mismatch:{field}")
        for field, (low, high) in intent.numeric_ranges.items():
            observed = metadata.get(field)
            if not _finite_measurement(observed):
                unknown.append(field)
            elif not low <= observed <= high:
                reasons.append(f"outside_range:{field}")
        status = "rejected" if reasons else "needs_review" if unknown else "matched"
        output.append({"slice_id": item["slice_id"], "version": item["version"], "status": status,
                       "reasons": reasons, "unknown_conditions": unknown,
                       "scientific_review_required": item.get("compiler_status") != "CHECKS_PASSED"})
    return sorted(output, key=lambda x: ({"matched": 0, "needs_review": 1, "rejected": 2}[x["status"]], x["slice_id"]))


def assess_barter(need_a: dict, offer_b: dict, need_b: dict, offer_a: dict) -> dict:
    """Both needs must be explicit; different domains do not imply scientific complementarity."""
    a = match_catalog(need_a, [offer_b])
    b = match_catalog(need_b, [offer_a])
    suitable = bool(a and b and a[0]["status"] == b[0]["status"] == "matched")
    return {"status": "candidate_for_human_review" if suitable else "requirements_not_met",
            "a_receives": a, "b_receives": b, "requires_human_approval": True,
            "execution_authorized": False, "valuation": "not_estimated",
            "condition_comparison": compare_conditions(offer_a, offer_b)
            if _discoverable_record(offer_a) and _discoverable_record(offer_b) else None}


def compare_conditions(left: dict, right: dict) -> dict:
    """Declared-condition comparison only; not causal inference or a statistical shift test."""
    differences, unknown = [], []
    for field in ("temperature_c", "electrolyte", "reference_electrode", "chemistry", "charge_policy"):
        a, b = left.get("metadata", {}).get(field), right.get("metadata", {}).get(field)
        if a is None or b is None:
            unknown.append(field)
        elif a != b:
            differences.append(field)
    return {"scope": "declared_metadata_comparison_only", "different_fields": differences,
            "unknown_or_inapplicable_fields": unknown,
            "cross_domain": left.get("domain") != right.get("domain"),
            "causal_conclusion": None, "joint_training_compatibility": "not_established"}
