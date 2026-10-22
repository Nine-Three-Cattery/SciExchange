import importlib.util
import json
from pathlib import Path
import shutil

import pytest
from pydantic import ValidationError

from app.agent.intent import parse_intent
from app.agent.matching import assess_barter, compare_conditions, match_catalog
from app.services.science_io import load_slices

ROOT = Path(__file__).resolve().parents[2]


def offer(payload):
    return payload | {"can_discover": True, "blocking_failure": False, "compiler_status": "REVIEW_REQUIRED"}


def test_match_missing_temperature_stays_unknown(real_slices):
    intent = {"domain": "battery_cycling", "numeric_ranges": {"temperature_c": [29, 31]}}
    result = match_catalog(intent, [offer(real_slices["battery_b1c5_early"])])[0]
    assert result["status"] == "needs_review"
    assert result["unknown_conditions"] == ["temperature_c"]


def test_private_metadata_omitted_and_protocol_mismatch_rejected(real_slices):
    item = offer(real_slices["battery_b1c5_early"])
    assert match_catalog({"domain": "battery_cycling"}, [item | {"can_discover": False}]) == []
    result = match_catalog({"domain": "battery_cycling", "numeric_ranges": {"charge_rate_c": [3.5, 3.7]}}, [item])[0]
    assert result["status"] == "rejected"
    assert "outside_range:charge_rate_c" in result["reasons"]


def test_barter_needs_both_explicit_intents(real_slices):
    cat, battery = offer(real_slices["catalysis_nifec_tafel"]), offer(real_slices["battery_b1c5_early"])
    result = assess_barter({"domain": "battery_cycling"}, battery, {"domain": "electrocatalysis"}, cat)
    assert result["status"] == "candidate_for_human_review"
    assert result["execution_authorized"] is False
    result = assess_barter({"domain": "electrocatalysis"}, battery, {"domain": "electrocatalysis"}, cat)
    assert result["status"] == "requirements_not_met"


def test_intent_rejects_inverted_or_infinite_ranges():
    for bounds in ([30, 20], [0, float("inf")]):
        with pytest.raises(ValidationError):
            parse_intent({"domain": "battery_cycling", "numeric_ranges": {"temperature_c": bounds}})


def test_condition_comparison_does_not_invent_missing_conditions(real_slices):
    report = compare_conditions(real_slices["catalysis_nifec_tafel"], real_slices["battery_b1c5_early"])
    assert report["cross_domain"]
    assert "temperature_c" in report["unknown_or_inapplicable_fields"]
    assert report["causal_conclusion"] is None
    report = compare_conditions({"metadata": {"temperature_c": 25}}, {"metadata": {"temperature_c": 30}})
    assert "temperature_c" in report["different_fields"]


def test_fixture_tampering_detected(tmp_path):
    shutil.copytree(ROOT/"data/slices", tmp_path/"slices")
    path = tmp_path/"slices/battery_b1c5_early.csv"
    path.write_text(path.read_text().replace("1.0761266", "9.9999999"))
    with pytest.raises(ValueError, match="integrity"):
        load_slices(tmp_path/"slices")


def test_fixture_path_cannot_escape(tmp_path):
    shutil.copytree(ROOT/"data/slices", tmp_path/"slices")
    manifest_path = tmp_path/"slices/manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["entries"][0]["metadata_file"] = "../outside.json"
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="escapes"):
        load_slices(tmp_path/"slices")


def test_source_records_and_exclusions_are_preserved(real_slices):
    early = real_slices["battery_b1c5_early"]
    assert early["metadata"]["excluded_cycles"] == [1]
    assert early["metadata"]["source_full_sha256"] is None
    assert early["metadata"]["license"] == "CC-BY-4.0"
    cat = real_slices["catalysis_nifec_tafel"]
    assert cat["metadata"]["source_reported_ph"] == 16.67
    assert len(cat["rows"]) == 9


def test_demo_is_deterministic():
    spec = importlib.util.spec_from_file_location("science_demo", ROOT/"backend/scripts/run_science_demo.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    one = json.dumps(module.run(ROOT/"data/slices"), sort_keys=True, allow_nan=False)
    two = json.dumps(module.run(ROOT/"data/slices"), sort_keys=True, allow_nan=False)
    assert one == two
