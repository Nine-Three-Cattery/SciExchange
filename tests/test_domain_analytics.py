"""Independent analytic oracles for the numerical algorithms."""

import json
from pathlib import Path

import numpy as np
import pytest
from scipy.integrate import trapezoid
from scipy.special import erf

from app.compiler.domain_analytics import (
    differential_capacity,
    differential_tafel_analysis,
    predict_knee_point,
    tafel_analysis,
)
from scripts.seed_slices import generate_slices


def test_protocol_tafel_recovers_analytic_slope_and_eta() -> None:
    voltage = np.linspace(1.2, 1.7, 1001)
    current = 10.0 * 10 ** ((voltage - 1.469) / 0.0425)
    result = tafel_analysis(voltage, current)
    assert result["tafel_slope_mv_dec"] == pytest.approx(42.5, abs=1e-9)
    assert result["r_squared"] == pytest.approx(1.0, abs=1e-12)
    assert result["overpotential_10ma_mv"] == pytest.approx(240.0, abs=0.01)
    assert result["fit_current_range_ma_cm2"][0] >= 1
    assert result["fit_current_range_ma_cm2"][1] <= 10


def test_generated_benchmarks_connect_to_numerical_algorithms(tmp_path: Path) -> None:
    generate_slices(tmp_path)
    oer = json.loads((tmp_path / "slice_oer_valid.json").read_text())
    voltage = [row[oer["columns"].index("potential_v_rhe")] for row in oer["rows"]]
    current = [row[oer["columns"].index("current_density_ma_cm2")] for row in oer["rows"]]
    fixed = tafel_analysis(voltage, current)
    dta = differential_tafel_analysis(voltage, current)
    assert fixed["overpotential_10ma_mv"] == pytest.approx(240.0, abs=0.1)
    assert fixed["tafel_slope_mv_dec"] == pytest.approx(42.5, abs=0.1)
    assert dta["tafel_slope_mv_dec"] == pytest.approx(42.5, abs=0.5)
    assert dta["kinetic_consistent"]
    battery = json.loads((tmp_path / "slice_battery_valid.json").read_text())
    charge = battery["charge_curve"]
    q_voltage = [row[charge["columns"].index("voltage_v")] for row in charge["rows"]]
    capacity = [row[charge["columns"].index("capacity_ah")] for row in charge["rows"]]
    curve = differential_capacity(q_voltage, capacity)
    assert curve["positive"]
    assert curve["peak_voltages_v"] == pytest.approx([3.425], abs=0.002)


def test_protocol_tafel_refuses_extrapolation_and_reversed_scan() -> None:
    with pytest.raises(ValueError, match="bracket"):
        tafel_analysis([1.4, 1.41, 1.42], [1.0, 2.0, 3.0])
    with pytest.raises(ValueError, match="monotonic"):
        tafel_analysis([1.4, 1.41, 1.42, 1.43], [1.0, 3.0, 2.0, 10.0])


def test_dta_recovers_exponential_and_agrees_with_current_fit() -> None:
    voltage = np.linspace(1.25, 1.52, 1001)
    current = 10.0 * 10 ** ((voltage - 1.469) / 0.0425)
    result = differential_tafel_analysis(voltage, current)
    assert result["tafel_slope_mv_dec"] == pytest.approx(42.5, rel=0.001)
    assert result["current_tafel_slope_mv_dec"] == pytest.approx(42.5, rel=0.001)
    assert result["kinetic_consistent"]
    assert result["slope_relative_difference"] < 0.001
    assert result["derivative_r_squared"] > 0.999
    assert result["fit_potential_range_v"][1] <= result["second_derivative_max_potential_v"]


def test_dta_selects_kinetic_region_before_transport_turnover() -> None:
    voltage = np.linspace(1.2, 1.7, 1501)
    kinetic = 10.0 * 10 ** ((voltage - 1.469) / 0.0425)
    current = kinetic / (1.0 + kinetic / 300.0)
    result = differential_tafel_analysis(voltage, current)
    assert result["kinetic_consistent"]
    assert result["tafel_slope_mv_dec"] == pytest.approx(42.5, rel=0.02)
    assert result["fit_potential_range_v"][1] < result["second_derivative_max_potential_v"]
    assert result["second_derivative_max_potential_v"] < 1.6


def test_dta_avoids_constant_current_background() -> None:
    voltage = np.linspace(1.2, 1.55, 1201)
    kinetic = 10.0 * 10 ** ((voltage - 1.469) / 0.0425)
    result = differential_tafel_analysis(voltage, kinetic + 0.5)
    assert result["tafel_slope_mv_dec"] == pytest.approx(42.5, rel=0.005)
    assert result["fit_potential_range_v"][0] > 1.4
    assert result["kinetic_consistent"]


def test_dta_rejects_a_linear_current_without_exponential_region() -> None:
    voltage = np.linspace(1.2, 1.7, 501)
    with pytest.raises(ValueError, match="kinetic|exponential"):
        differential_tafel_analysis(voltage, 20.0 * (voltage - 1.1))


def test_gaussian_capacity_derivative_matches_known_phase_peak() -> None:
    voltage = np.linspace(3.0, 3.6, 1001)
    center, width = 3.425, 0.016
    capacity = 0.1 * (voltage - 3.0) + 0.5 * (
        1 + erf((voltage - center) / (np.sqrt(2) * width))
    )
    expected = 0.1 + np.exp(-0.5 * ((voltage - center) / width) ** 2) / (
        np.sqrt(2 * np.pi) * width
    )
    result = differential_capacity(voltage, capacity)
    derivative = np.asarray(result["dq_dv_ah_v"])
    assert result["positive"]
    assert result["peak_voltages_v"] == pytest.approx([center], abs=0.001)
    np.testing.assert_allclose(derivative, expected, atol=0.05, rtol=0.005)
    assert trapezoid(derivative, voltage) == pytest.approx(capacity[-1] - capacity[0], rel=0.002)


def test_capacity_derivative_retains_negative_charge_segments() -> None:
    voltage = np.linspace(3.0, 3.6, 401)
    result = differential_capacity(voltage, 4.0 - voltage)
    assert not result["positive"]
    assert np.max(result["dq_dv_ah_v"]) < 0


def test_nonuniform_voltage_sampling_still_recovers_linear_derivative() -> None:
    voltage = 3.0 + np.linspace(0.0, np.sqrt(0.6), 401) ** 2
    result = differential_capacity(voltage, 2.0 * (voltage - 3.0))
    np.testing.assert_allclose(result["dq_dv_ah_v"], 2.0, rtol=0.001)


def test_knee_recovers_known_continuous_piecewise_transition() -> None:
    cycles = np.arange(1.0, 101.0)
    capacity = 1.1 - 0.0003 * cycles - 0.002 * np.maximum(cycles - 62.5, 0.0)
    result = predict_knee_point(cycles, capacity)
    assert result["identified"]
    assert result["knee_cycle"] == pytest.approx(62.5, abs=0.05)
    assert result["pre_knee_slope"] == pytest.approx(-0.0003, abs=1e-6)
    assert result["post_knee_slope"] == pytest.approx(-0.0023, abs=1e-6)
    assert result["fit_r_squared"] > 0.9999
    assert result["status"] == "observed_knee"
    assert result["observed_cycle_range"] == [1.0, 100.0]


def test_knee_recovers_noisy_bilinear_transition_with_fixed_seed() -> None:
    cycles = np.arange(1.0, 101.0)
    rng = np.random.default_rng(2026)
    capacity = 1.1 - 0.0003 * cycles - 0.002 * np.maximum(cycles - 62.5, 0.0)
    capacity += rng.normal(0, 0.0005, cycles.size)
    result = predict_knee_point(cycles, capacity)
    assert result["identified"]
    assert result["knee_cycle"] == pytest.approx(62.5, abs=1)


@pytest.mark.parametrize("slope", [0.0, -0.0003])
def test_knee_does_not_invent_late_life_from_linear_early_cycles(slope: float) -> None:
    cycles = np.arange(1.0, 101.0)
    result = predict_knee_point(cycles, 1.1 + slope * cycles)
    assert not result["identified"]
    assert result["knee_cycle"] is None
    assert result["status"] == "not_identifiable_from_observed_cycles"


@pytest.mark.parametrize(
    "function",
    [tafel_analysis, differential_tafel_analysis, differential_capacity, predict_knee_point],
)
@pytest.mark.parametrize("fault", ["nan", "reversed", "duplicate", "boolean", "unequal"])
def test_algorithms_reject_invalid_numeric_arrays(function, fault: str) -> None:
    x = np.linspace(1.0, 2.0, 40)
    y = np.linspace(1.0, 20.0, 40)
    if fault == "nan":
        y[10] = np.nan
    elif fault == "reversed":
        x = x[::-1]
    elif fault == "duplicate":
        x[10] = x[9]
    elif fault == "boolean":
        y = np.ones(40, dtype=bool)
    elif fault == "unequal":
        y = y[:-1]
    with pytest.raises(ValueError):
        function(x, y)
