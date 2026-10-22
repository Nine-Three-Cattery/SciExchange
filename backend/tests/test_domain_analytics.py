import copy

import numpy as np
import pytest

from app.services.domain_analytics import (
    ScienceError, analyze, capacity_fade, catalysis, differential_capacity, knee_point,
)


def test_known_tafel_slope_and_exact_target(tafel_slice):
    result = catalysis(tafel_slice)
    assert result["tafel_slope_mv_dec"] == pytest.approx(42.5)
    assert result["r_squared"] == pytest.approx(1)
    assert result["overpotential_at_target_mv"] == pytest.approx(242.5)
    assert len(result["input_sha256"]) == 64


def test_no_extrapolation(tafel_slice):
    result = catalysis(tafel_slice, target_current=101)
    assert result["overpotential_at_target_mv"] is None
    assert "TARGET_NOT_BRACKETED" in result["warnings"]


def test_no_overpotential_from_uncalibrated_reference(tafel_slice):
    tafel_slice["columns"][1] = "potential_v_vs_reference"
    tafel_slice["metadata"]["units"] = {"current_density_ma_cm2": "mA/cm2", "potential_v_vs_reference": "V"}
    tafel_slice["metadata"]["reference_electrode"] = "Ag/AgCl"
    result = catalysis(tafel_slice)
    assert result["tafel_slope_mv_dec"] == pytest.approx(42.5)
    assert result["overpotential_at_target_mv"] is None


def test_hysteresis_target_is_ambiguous(tafel_slice):
    tafel_slice["rows"] += [[20, 0.5], [10, 0.45], [1, 0.4]]
    result = catalysis(tafel_slice)
    assert "AMBIGUOUS_TARGET_CROSSINGS" in result["warnings"]
    assert result["potential_at_target_v"] is None


def test_fit_requires_points_and_current_span(tafel_slice):
    with pytest.raises(ScienceError, match="0.5 current decades"):
        catalysis(tafel_slice, current_min=5, current_max=8)


def test_constant_potential_rejected(tafel_slice):
    for row in tafel_slice["rows"]:
        row[1] = 1
    with pytest.raises(ScienceError, match="Constant potential"):
        catalysis(tafel_slice)


@pytest.mark.parametrize("phase,expected", [("charge", 2), ("discharge", -2)])
def test_derivative_units_and_sign(phase, expected):
    voltage = np.linspace(3, 4, 100) if phase == "charge" else np.linspace(4, 3, 100)
    payload = {"slice_id": "analytic_curve", "version": "1", "domain": "battery_cycling",
               "columns": ["voltage_v", "capacity_ah"],
               "rows": np.column_stack([voltage, np.linspace(0, 2, 100)]).tolist(),
               "metadata": {"phase": phase, "capacity_convention": "positive_cumulative",
                            "units": {"voltage_v": "V", "capacity_ah": "Ah"}}}
    result = differential_capacity(payload, sigma_points=0)
    np.testing.assert_allclose(result["dq_dv_ah_v"], expected, atol=1e-10)
    payload["rows"][2][0] = payload["rows"][1][0]
    with pytest.raises(ScienceError, match="duplicates/reversals"):
        differential_capacity(payload)


def test_known_breakpoint_and_no_breakpoint(capacity_slice):
    result = knee_point(capacity_slice)
    assert result["status"] == "candidate_detected"
    assert abs(result["knee_point_cycle_estimated"]-80) <= 1
    assert result["parameters"]["candidate_count"] <= 300
    for cycle, row in enumerate(capacity_slice["rows"]):
        row[1] = 1.1-0.0001*cycle
    assert knee_point(capacity_slice)["status"] == "not_detected"
    for row in capacity_slice["rows"]:
        row[1] = 1.1
    assert knee_point(capacity_slice)["knee_point_cycle_estimated"] is None


def test_cycle_order_and_units_required(capacity_slice):
    capacity_slice["rows"][2][0] = 2
    with pytest.raises(ScienceError, match="unique"):
        capacity_fade(capacity_slice)
    capacity_slice["metadata"]["units"]["discharge_capacity_ah"] = "mAh"
    with pytest.raises(ScienceError, match="requires unit Ah"):
        capacity_fade(capacity_slice)


def test_isolated_capacity_dip_is_reported_not_removed(capacity_slice):
    capacity_slice["rows"][59][1] -= 0.2
    result = knee_point(capacity_slice)
    assert result["isolated_capacity_anomaly_cycles"] == [60]
    assert len(result["cycle_index"]) == len(capacity_slice["rows"])
    assert "ISOLATED_CAPACITY_ANOMALIES_RETAINED_REVIEW_BREAKPOINT_SENSITIVITY" in result["warnings"]


def test_real_data_not_forced_to_scripted_values(real_slices):
    result = analyze(real_slices["catalysis_nifec_tafel"], "tafel_slope", {"current_min": 0.3, "current_max": 10})
    assert 70 < result["tafel_slope_mv_dec"] < 85
    assert result["overpotential_at_target_mv"] is None
    early = real_slices["battery_b1c5_early"]
    assert len(early["rows"]) == 99
    assert early["rows"][0][0] == 2
    assert knee_point(early)["knee_point_cycle_estimated"] is None
    full = knee_point(real_slices["battery_b1c5_lifetime"])
    assert 800 < full["knee_point_cycle_estimated"] < 950
    for number in (10, 50, 100):
        result = differential_capacity(real_slices[f"battery_b1c5_cycle_{number}"])
        assert np.isfinite(result["dq_dv_ah_v"]).all()
        assert max(result["dq_dv_ah_v"]) <= 0


@pytest.mark.parametrize("method,params", [("unknown", {}), ("tafel_slope", {"temperature": 30}), ("dq_dv", {})])
def test_bad_analysis_requests(tafel_slice, method, params):
    with pytest.raises(ScienceError):
        analyze(tafel_slice, method, params)


def test_input_version_is_part_of_provenance(tafel_slice):
    first = catalysis(tafel_slice)
    altered = copy.deepcopy(tafel_slice)
    altered["version"] = "2"
    assert catalysis(altered)["input_sha256"] != first["input_sha256"]
