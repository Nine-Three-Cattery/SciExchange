from copy import deepcopy

import pytest
from pydantic import ValidationError

from app.agent.intent import parse_intent
from app.agent.matching import assess_barter, match_catalog


def catalog_item():
    return {
        "slice_id": "public_battery", "version": "1", "domain": "battery_cycling",
        "columns": ["cycle_index", "discharge_capacity_ah"], "can_discover": True,
        "blocking_failure": False, "compiler_status": "REVIEW_REQUIRED",
        "metadata": {"license": "CC-BY-4.0", "data_origin": "experimental", "temperature_c": 30},
    }


@pytest.mark.parametrize("bounds", [[False, 30], [20, True], ["20", 30], [0, float("nan")]])
def test_query_bounds_require_finite_numbers_without_coercion(bounds):
    with pytest.raises(ValidationError):
        parse_intent({"domain": "battery_cycling", "numeric_ranges": {"temperature_c": bounds}})


def test_integer_bounds_are_accepted_and_matched():
    intent = parse_intent({"domain": "battery_cycling", "numeric_ranges": {"temperature_c": [29, 31]}})
    assert match_catalog(intent, [catalog_item()])[0]["status"] == "matched"


@pytest.mark.parametrize("value", [10**1000, float("inf"), float("nan"), True, "30"])
def test_invalid_numeric_metadata_stays_unknown(value):
    item = catalog_item()
    item["metadata"]["temperature_c"] = value
    result = match_catalog({"domain": "battery_cycling", "numeric_ranges": {"temperature_c": [29, 31]}}, [item])[0]
    assert result["status"] == "needs_review"
    assert result["unknown_conditions"] == ["temperature_c"]


@pytest.mark.parametrize("bad_item", [None, [], "invalid", {}, {"can_discover": True}])
def test_malformed_entries_do_not_hide_valid_results(bad_item):
    result = match_catalog({"domain": "battery_cycling"}, [bad_item, catalog_item()])
    assert len(result) == 1 and result[0]["slice_id"] == "public_battery"


@pytest.mark.parametrize("field,value", [
    ("metadata", None), ("columns", None), ("columns", [None]),
    ("columns", ["cycle_index", "cycle_index"]), ("slice_id", None),
    ("slice_id", "../private"), ("version", None), ("version", ""),
    ("domain", []), ("can_discover", 1),
])
def test_malformed_visible_records_are_omitted(field, value):
    assert match_catalog({"domain": "battery_cycling"}, [catalog_item() | {field: value}]) == []


def test_malformed_catalog_container_fails_closed():
    assert match_catalog({"domain": "battery_cycling"}, {"private": catalog_item()}) == []


@pytest.mark.parametrize("hidden_side", ["a", "b", "both"])
def test_hidden_offers_do_not_leak_condition_comparison(hidden_side):
    a, b = catalog_item(), deepcopy(catalog_item())
    a["metadata"]["temperature_c"] = 25
    if hidden_side in ("a", "both"):
        a["can_discover"] = False
    if hidden_side in ("b", "both"):
        b["can_discover"] = False
    result = assess_barter({"domain": "battery_cycling"}, b, {"domain": "battery_cycling"}, a)
    assert result["condition_comparison"] is None
    assert result["status"] == "requirements_not_met"
    assert result["execution_authorized"] is False


def test_malformed_offer_cannot_produce_a_comparison():
    result = assess_barter({"domain": "battery_cycling"}, None, {"domain": "battery_cycling"}, catalog_item())
    assert result["condition_comparison"] is None


def test_visible_offers_keep_declared_condition_comparison():
    a, b = catalog_item(), deepcopy(catalog_item())
    a["metadata"]["temperature_c"] = 25
    result = assess_barter({"domain": "battery_cycling"}, b, {"domain": "battery_cycling"}, a)
    assert result["condition_comparison"]["different_fields"] == ["temperature_c"]
    assert result["status"] == "candidate_for_human_review"
