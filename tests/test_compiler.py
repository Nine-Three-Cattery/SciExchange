import copy
import json
import math
import pytest

from app.compiler.formal_engine import (
    FARADAY_CONSTANT,
    PhysicalCompiler,
    calculate_faradaic_efficiency,
    nernst_potential,
    verify_coulombic_efficiency,
    verify_faradaic_efficiency,
    verify_lsv_monotonicity,
    verify_nernst_potential,
    verify_uncompensated_resistance,
)
from scripts.seed_slices import generate_slices


@pytest.fixture(scope="module")
def documents(tmp_path_factory):
    directory = tmp_path_factory.mktemp("compiler-slices")
    generate_slices(directory)
    return {path.stem: json.loads(path.read_text()) for path in directory.glob("*.json")}


@pytest.mark.parametrize("name", ["slice_oer_valid", "slice_battery_valid", "slice_dark_reaction"])
def test_valid_benchmarks_pass_real_checks(documents, name):
    report = PhysicalCompiler().verify(documents[name])
    assert report["valid"], report["diagnostic_log"]
    assert report["compiler_status"] == "FORMAL_PROOF_VALID"
    assert not report["violated_axioms"]
    assert "theorem InvariantProof" in report["diagnostic_log"]
    assert "not a Lean-kernel-checked" in report["diagnostic_log"]


def test_oer_valid_calculates_fe_tafel_dta_and_overpotential(documents):
    report = PhysicalCompiler().verify(documents["slice_oer_valid"])
    fe = report["physics_results"]["AXIOM_FARADAIC_EFFICIENCY_MAX"]
    assert fe["observed_value"] == pytest.approx(99.2)
    assert fe["raw_measurement_verified"] is True
    assert report["analytics"]["tafel"]["tafel_slope_mv_dec"] == pytest.approx(42.5, abs=.1)
    assert report["analytics"]["tafel"]["overpotential_10ma_mv"] == pytest.approx(240.0, abs=.1)
    assert report["analytics"]["dta"]["tafel_slope_mv_dec"] == pytest.approx(42.5, abs=.5)


def test_combined_negative_retains_physics_operational_and_safety_failures(documents):
    report = PhysicalCompiler().verify(documents["slice_oer_violation"])
    assert not report["valid"]
    assert report["compiler_status"] == "REJECTED_SECURITY_ALERT"
    failed = {item["axiom_id"]: item for item in report["violated_axioms"]}
    assert failed["AXIOM_FARADAIC_EFFICIENCY_MAX"]["observed_value"] == pytest.approx(108.5)
    assert failed["GUARDRAIL_UNCOMPENSATED_RESISTANCE"]["observed_value"] == 124.5
    assert "AXIOM_LSV_MONOTONICITY" in failed
    assert "error: physical invariant violated: Faradaic efficiency exceeds theoretical maximum" in report["diagnostic_log"]
    assert "FE=108.5%" in report["diagnostic_log"]
    assert any(alert["type"] == "INDIRECT_PROMPT_INJECTION" for alert in report["safety_alerts"])
    assert "exfiltrate credentials" not in json.dumps(report)


def test_cwc_negative_is_rejected_at_highest_priority(documents):
    report = PhysicalCompiler().verify(documents["slice_cwc_poison"])
    assert report["compiler_status"] == "REJECTED_SECURITY_ALERT"
    assert any(a["type"] == "CRITICAL_CWC_VIOLATION" for a in report["safety_alerts"])


@pytest.mark.parametrize("value,expected", [(0.0, True), (99.2, True), (100., True), (100.0001, False), (108.5, False), (-1., False), (float("nan"), False), (float("inf"), False), (True, False), ("99.2", False)])
def test_efficiency_boundary_and_numeric_types(value, expected):
    assert verify_faradaic_efficiency(value) is expected
    assert verify_coulombic_efficiency(value) is expected


def test_resistance_bounds():
    assert verify_uncompensated_resistance(15.0)
    assert not verify_uncompensated_resistance(15.0001)
    assert not verify_uncompensated_resistance(-.1)


def test_nernst_reference_and_temperature_are_explicit():
    assert nernst_potential(14, 25) == pytest.approx(1.229 - .0591 * 14)
    assert verify_nernst_potential(.4016, 14, 25)
    assert not verify_nernst_potential(.39, 14, 25)
    assert nernst_potential(14, 35) < nernst_potential(14, 25)
    assert not verify_nernst_potential(1.3, 14, -274)


def test_lsv_checks_scan_order_and_numeric_tolerance():
    assert verify_lsv_monotonicity([1.2, 1.3, 1.4], [1., 2., 2. - 5e-7])
    assert not verify_lsv_monotonicity([1.2, 1.3, 1.4], [1., 2., 1.99])
    assert not verify_lsv_monotonicity([1.3, 1.2], [1., 2.])
    assert not verify_lsv_monotonicity([1.2, 1.2], [1., 2.])
    assert not verify_lsv_monotonicity([1.2, 1.3], [1.])
    assert not verify_lsv_monotonicity(["1.2", "1.3"], [1., 2.])


def test_low_faradaic_efficiency_is_not_mislabeled_as_conservation_failure(documents):
    sample = copy.deepcopy(documents["slice_oer_valid"])
    metrics = sample["metadata"]["extracted_metrics"]
    metrics["oxygen_moles"] *= 80 / metrics["faradaic_efficiency"]
    metrics["faradaic_efficiency"] = 80.0
    report = PhysicalCompiler().verify(sample)
    assert report["valid"]
    assert report["physics_results"]["AXIOM_FARADAIC_EFFICIENCY_MAX"]["benchmark_normal_range"] is False


def test_metadata_only_fe_is_identified_as_unverified_measurement(documents):
    sample = copy.deepcopy(documents["slice_oer_valid"])
    del sample["metadata"]["extracted_metrics"]["oxygen_moles"]
    del sample["metadata"]["extracted_metrics"]["total_charge_c"]
    report = PhysicalCompiler().verify(sample)
    assert report["valid"]
    assert report["physics_results"]["AXIOM_FARADAIC_EFFICIENCY_MAX"]["raw_measurement_verified"] is False


def test_forged_summary_does_not_hide_raw_charge_violation(documents):
    sample = copy.deepcopy(documents["slice_oer_valid"])
    sample["metadata"]["extracted_metrics"]["oxygen_moles"] *= 1.1
    report = PhysicalCompiler().verify(sample)
    assert not report["valid"]
    assert not report["physics_results"]["AXIOM_FARADAIC_REPORT_CONSISTENCY"]["passed"]
    assert not report["physics_results"]["AXIOM_FARADAIC_EFFICIENCY_MAX"]["passed"]


@pytest.mark.parametrize("removed", ["faradaic_efficiency", "oxygen_moles", "total_charge_c"])
def test_missing_required_or_partial_raw_measurements_fail(documents, removed):
    sample = copy.deepcopy(documents["slice_oer_valid"])
    del sample["metadata"]["extracted_metrics"][removed]
    report = PhysicalCompiler().verify(sample)
    assert not report["valid"]
    assert not report["physics_results"]["AXIOM_FARADAIC_EFFICIENCY_MAX"]["passed"]


def test_raw_fe_zero_charge_rejected():
    with pytest.raises(ValueError, match="positive"):
        calculate_faradaic_efficiency(.001, 0)


@pytest.mark.parametrize("charge", [30.0, 60.0, 100.0, 3600.0])
def test_exact_faradaic_ceiling_survives_product_charge_roundoff(documents, charge):
    sample = copy.deepcopy(documents["slice_oer_valid"])
    metrics = sample["metadata"]["extracted_metrics"]
    metrics.update(faradaic_efficiency=100.0, total_charge_c=charge,
                   oxygen_moles=charge / (4 * FARADAY_CONSTANT))
    report = PhysicalCompiler().verify(sample)
    assert report["valid"], report["diagnostic_log"]
    result = report["physics_results"]["AXIOM_FARADAIC_EFFICIENCY_MAX"]
    assert result["passed"] is True
    assert result["benchmark_normal_range"] is True
    assert result["observed_value"] == 100.0
    assert "exceeds theoretical maximum" not in report["diagnostic_log"]


def test_faradaic_roundoff_handling_does_not_allow_measured_excess(documents):
    sample = copy.deepcopy(documents["slice_oer_valid"])
    metrics = sample["metadata"]["extracted_metrics"]
    metrics.update(faradaic_efficiency=100.0, total_charge_c=30.0,
                   oxygen_moles=(30 / (4 * FARADAY_CONSTANT)) * (1 + 1e-10))
    report = PhysicalCompiler().verify(sample)
    result = report["physics_results"]["AXIOM_FARADAIC_EFFICIENCY_MAX"]
    assert result["passed"] is False
    assert result["benchmark_normal_range"] is False
    assert result["observed_value"] > 100.0


def test_faradaic_reported_excess_is_not_rounded_away(documents):
    sample = copy.deepcopy(documents["slice_oer_valid"])
    metrics = sample["metadata"]["extracted_metrics"]
    metrics.update(faradaic_efficiency=math.nextafter(100.0, math.inf),
                   total_charge_c=30.0, oxygen_moles=30 / (4 * FARADAY_CONSTANT))
    report = PhysicalCompiler().verify(sample)
    assert report["physics_results"]["AXIOM_FARADAIC_EFFICIENCY_MAX"]["passed"] is False


def test_she_and_rhe_normalization_produces_same_scientific_result(documents):
    sample = copy.deepcopy(documents["slice_oer_valid"])
    sample["metadata"]["testing_conditions"]["potential_reference"] = "SHE"
    sample["columns"][0] = "potential_v_she"
    for row in sample["rows"]:
        row[0] -= .0591 * 14
    report = PhysicalCompiler().verify(sample)
    assert report["valid"], report["diagnostic_log"]
    assert report["analytics"]["tafel"]["overpotential_10ma_mv"] == pytest.approx(240, abs=.1)


def test_rhe_scan_below_equilibrium_is_allowed_only_for_background_current(documents):
    sample = copy.deepcopy(documents["slice_oer_valid"])
    sample["rows"][0][1] = 1.0
    report = PhysicalCompiler().verify(sample)
    assert not report["physics_results"]["AXIOM_NERNST_POTENTIAL"]["passed"]


def test_operational_failures_are_distinct_from_conservation_failures(documents):
    sample = copy.deepcopy(documents["slice_oer_valid"])
    sample["metadata"]["extracted_metrics"]["uncompensated_resistance_ohm"] = 124.5
    report = PhysicalCompiler().verify(sample)
    assert report["compiler_status"] == "REJECTED_OPERATIONAL_ARTEFACT"
    assert report["physics_results"]["AXIOM_FARADAIC_EFFICIENCY_MAX"]["passed"]


def test_ocv_short_observation_cannot_pass_60_second_rule(documents):
    sample = copy.deepcopy(documents["slice_oer_valid"])
    sample["metadata"]["testing_conditions"]["ocv_observation_seconds"] = 1
    report = PhysicalCompiler().verify(sample)
    assert not report["physics_results"]["GUARDRAIL_OCV_DRIFT"]["passed"]


def test_battery_raw_capacity_violation_beats_forged_efficiency(documents):
    sample = copy.deepcopy(documents["slice_battery_valid"])
    sample["rows"][30][1] = sample["rows"][30][2] * 1.02
    report = PhysicalCompiler().verify(sample)
    assert not report["physics_results"]["AXIOM_COULOMBIC_EFFICIENCY_MAX"]["passed"]
    assert not report["physics_results"]["AXIOM_COULOMBIC_REPORT_CONSISTENCY"]["passed"]


@pytest.mark.parametrize("derived_capacity", ["charge", "discharge"])
def test_battery_exact_normal_ce_floor_survives_roundoff(documents, derived_capacity):
    sample = copy.deepcopy(documents["slice_battery_valid"])
    for row in sample["rows"]:
        if derived_capacity == "charge":
            row[2] = row[1] / .98
        else:
            row[1] = row[2] * .98
        row[3] = 98.0
    sample["metadata"]["extracted_metrics"]["coulombic_efficiency"] = 98.0
    report = PhysicalCompiler().verify(sample)
    assert report["valid"], report["diagnostic_log"]
    result = report["physics_results"]["GUARDRAIL_COULOMBIC_NORMAL_RANGE"]
    assert result["passed"] is True
    assert result["observed_value"] == 98.0


def test_battery_ce_roundoff_handling_does_not_allow_real_subthreshold_efficiency(documents):
    sample = copy.deepcopy(documents["slice_battery_valid"])
    for row in sample["rows"]:
        row[2] = row[1] / .97999
        row[3] = 97.999
    sample["metadata"]["extracted_metrics"]["coulombic_efficiency"] = 97.999
    report = PhysicalCompiler().verify(sample)
    assert not report["valid"]
    result = report["physics_results"]["GUARDRAIL_COULOMBIC_NORMAL_RANGE"]
    assert result["passed"] is False
    assert result["observed_value"] == pytest.approx(97.999)


def test_battery_growth_in_moving_average_rejected(documents):
    sample = copy.deepcopy(documents["slice_battery_valid"])
    for index, row in enumerate(sample["rows"]):
        row[1] = 1 + .001 * index
        row[2] = row[1] / .998
    report = PhysicalCompiler().verify(sample)
    assert not report["physics_results"]["AXIOM_CAPACITY_DECAY"]["passed"]


def test_battery_requires_intra_cycle_data_and_charge_phase(documents):
    sample = copy.deepcopy(documents["slice_battery_valid"])
    del sample["charge_curve"]
    report = PhysicalCompiler().verify(sample)
    assert not report["physics_results"]["AXIOM_DIFFERENTIAL_CAPACITY"]["passed"]
    sample = copy.deepcopy(documents["slice_battery_valid"])
    sample["metadata"]["testing_conditions"]["charge_curve_phase"] = "discharge"
    assert not PhysicalCompiler().verify(sample)["physics_results"]["AXIOM_DIFFERENTIAL_CAPACITY"]["passed"]


def test_negative_dq_dv_is_not_hidden_by_filtering(documents):
    sample = copy.deepcopy(documents["slice_battery_valid"])
    for row in sample["charge_curve"]["rows"]:
        row[1] = 2 - row[1]
    report = PhysicalCompiler().verify(sample)
    assert not report["physics_results"]["AXIOM_DIFFERENTIAL_CAPACITY"]["passed"]


@pytest.mark.parametrize("mutation", ["duplicate_column", "ragged_row", "string_current", "nan", "unsupported_reference"])
def test_malformed_scientific_inputs_never_pass(documents, mutation):
    sample = copy.deepcopy(documents["slice_oer_valid"])
    if mutation == "duplicate_column":
        sample["columns"][2] = sample["columns"][0]
    elif mutation == "ragged_row":
        sample["rows"][10].pop()
    elif mutation == "string_current":
        sample["rows"][10][1] = "10"
    elif mutation == "nan":
        sample["rows"][10][1] = float("nan")
    else:
        sample["metadata"]["testing_conditions"]["potential_reference"] = "Ag/AgCl"
    report = PhysicalCompiler().verify(sample)
    assert not report["valid"]
    assert not report["physics_results"]["AXIOM_LSV_MONOTONICITY"]["passed"]


def test_unknown_domain_is_rejected():
    report = PhysicalCompiler().verify({"slice_id": "unknown", "domain": "unknown", "metadata": {}})
    assert not report["valid"]


def test_dark_record_requires_actual_failure_observations(documents):
    sample = copy.deepcopy(documents["slice_dark_reaction"])
    sample["rows"] = []
    assert not PhysicalCompiler().verify(sample)["valid"]


def test_dark_report_cannot_disagree_with_observed_crystallinity(documents):
    sample = copy.deepcopy(documents["slice_dark_reaction"])
    sample["metadata"]["extracted_metrics"]["crystallinity_fraction"] = .99
    assert not PhysicalCompiler().verify(sample)["valid"]


def test_reported_ce_above_ceiling_is_not_covered_by_rounding_tolerance(documents):
    sample = copy.deepcopy(documents["slice_battery_valid"])
    for row in sample["rows"]:
        row[1] = row[2]
        row[3] = 100.04
    sample["metadata"]["extracted_metrics"]["coulombic_efficiency"] = 100.04
    report = PhysicalCompiler().verify(sample)
    assert not report["physics_results"]["AXIOM_COULOMBIC_REPORT_CONSISTENCY"]["passed"]
