"""Deterministic scientific calculations; callers must supply an authorized slice."""
from __future__ import annotations

import hashlib
import json
import math
import re

import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.stats import linregress

from .safety_guardrail import is_declared_text

METHOD_VERSION = "science-1.1"
MAX_ROWS = 20000
MAX_CYCLE_INDEX = 2**53-1


def valid_identifier(value, *, version=False):
    pattern = r"[A-Za-z0-9_.-]{1,64}" if version else r"[A-Za-z0-9_-]{1,120}"
    return isinstance(value, str) and re.fullmatch(pattern, value) is not None


class ScienceError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def finite_number(value, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ScienceError("invalid_input", f"{name} must be a finite number")
    try:
        number = float(value)
    except OverflowError as error:
        raise ScienceError("invalid_input", f"{name} exceeds numeric range") from error
    if not math.isfinite(number):
        raise ScienceError("invalid_input", f"{name} must be a finite number")
    return number


def validate_table(payload: dict) -> np.ndarray:
    if not isinstance(payload, dict):
        raise ScienceError("invalid_input", "Slice must be an object")
    if not valid_identifier(payload.get("slice_id")):
        raise ScienceError("invalid_input", "slice_id must be a valid bounded identifier")
    if "version" in payload and not valid_identifier(payload["version"], version=True):
        raise ScienceError("invalid_input", "version must be a valid bounded identifier")
    columns, rows = payload.get("columns"), payload.get("rows")
    if (not isinstance(columns, list) or not 1 <= len(columns) <= 64
            or any(not isinstance(c, str) or not 1 <= len(c) <= 100 for c in columns)
            or len(set(columns)) != len(columns)):
        raise ScienceError("invalid_input", "Columns must be distinct names (1..64)")
    if not isinstance(rows, list) or not 1 <= len(rows) <= MAX_ROWS:
        raise ScienceError("insufficient_data", f"Expected 1..{MAX_ROWS} rows")
    if any(not isinstance(row, list) or len(row) != len(columns) for row in rows):
        raise ScienceError("invalid_input", "Row widths must match columns")
    for row in rows:
        for value in row:
            finite_number(value, "Measurement")
    if not isinstance(payload.get("metadata", {}), dict):
        raise ScienceError("invalid_input", "Metadata must be an object")
    try:
        json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
    except (ValueError, TypeError, RecursionError) as error:
        raise ScienceError("invalid_input", "Slice must be finite UTF-8 JSON") from error
    return np.asarray(rows, dtype=float)


def column(payload: dict, name: str, unit: str) -> np.ndarray:
    table = validate_table(payload)
    if name not in payload["columns"]:
        raise ScienceError("insufficient_data", f"Required column: {name}")
    units = payload.get("metadata", {}).get("units", {})
    if not isinstance(units, dict) or units.get(name) != unit:
        raise ScienceError("unknown_units", f"{name} requires unit {unit}")
    return table[:, payload["columns"].index(name)]


def input_hash(payload: dict) -> str:
    data = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    return hashlib.sha256(data.encode()).hexdigest()


def _result(payload, method, parameters):
    return {"slice_id": payload.get("slice_id"), "version": payload.get("version"),
            "method": method, "method_version": METHOD_VERSION,
            "input_sha256": input_hash(payload), "parameters": parameters,
            "warnings": [], "status": "ok"}


def catalysis(payload: dict, *, current_min=1.0, current_max=10.0, target_current=10.0) -> dict:
    """Fit apparent dE/dlog10(j) over an explicitly selected interval. No extrapolation."""
    low = finite_number(current_min, "current_min")
    high = finite_number(current_max, "current_max")
    target = finite_number(target_current, "target_current")
    if not 0 < low < high or target <= 0:
        raise ScienceError("invalid_input", "Require 0 < current_min < current_max and positive target")
    j = column(payload, "current_density_ma_cm2", "mA/cm2")
    if payload["metadata"].get("measurement_type") == "potential_sweep_with_return":
        raise ScienceError("ambiguous_sweep", "Select and record a single sweep branch before fitting a Tafel relation")
    names = payload["columns"]
    if "overpotential_v" in names:
        potential_name = "overpotential_v"
    elif "potential_v_vs_rhe" in names:
        potential_name = "potential_v_vs_rhe"
    elif "potential_v_vs_reference" in names:
        potential_name = "potential_v_vs_reference"
        if not is_declared_text(payload["metadata"].get("reference_electrode")):
            raise ScienceError("missing_reference", "Reference electrode must be a nonempty, nonquarantined name")
    else:
        raise ScienceError("insufficient_data", "A potential or overpotential column is required")
    potential = column(payload, potential_name, "V")
    mask = (j >= low) & (j <= high)
    if mask.sum() < 5 or np.ptp(np.log10(j[mask])) < 0.5:
        raise ScienceError("insufficient_fit_range", "Need at least 5 points spanning 0.5 current decades")
    x, y = np.log10(j[mask]), potential[mask]
    if np.ptp(y) == 0:
        raise ScienceError("degenerate_fit", "Constant potential does not identify a Tafel relation")
    fit = linregress(x, y)
    result = _result(payload, "apparent_tafel_ols", {
        "current_min_ma_cm2": low, "current_max_ma_cm2": high,
        "target_current_ma_cm2": target, "potential_column": potential_name})
    result.update(tafel_slope_mv_dec=float(fit.slope * 1000), r_squared=float(fit.rvalue**2),
                  slope_standard_error_mv_dec=float(fit.stderr * 1000), fit_points=int(mask.sum()),
                  measured_current_range_ma_cm2=[float(j.min()), float(j.max())],
                  potential_at_target_v=None, overpotential_at_target_mv=None,
                  curve={"current_density_ma_cm2": j.tolist(), "potential_v": potential.tolist()},
                  fit={"log10_current_density": x.tolist(), "potential_v": (fit.intercept + fit.slope*x).tolist()})
    # Multiple crossings are ambiguous (e.g. hysteresis). Never sort away that evidence.
    crossings = []
    for i in range(len(j)-1):
        if j[i] != j[i+1] and min(j[i], j[i+1]) <= target <= max(j[i], j[i+1]):
            crossings.append(float(potential[i] + (target-j[i])*(potential[i+1]-potential[i])/(j[i+1]-j[i])))
    exact = [float(v) for v in potential[j == target]]
    values = np.unique(np.round(exact + crossings, 12))
    if len(values) == 1:
        value = float(values[0])
        result["potential_at_target_v"] = value
        if potential_name == "overpotential_v":
            result["overpotential_at_target_mv"] = value * 1000
        elif potential_name == "potential_v_vs_rhe":
            equilibrium = payload["metadata"].get("equilibrium_potential_v_vs_rhe")
            if equilibrium is not None:
                result["overpotential_at_target_mv"] = 1000*(value-finite_number(equilibrium, "equilibrium potential"))
            else:
                result["warnings"].append("EQUILIBRIUM_POTENTIAL_UNSPECIFIED")
        else:
            result["warnings"].append("RHE_CALIBRATION_UNVERIFIED_NO_OVERPOTENTIAL")
    else:
        result["warnings"].append("TARGET_NOT_BRACKETED" if not len(values) else "AMBIGUOUS_TARGET_CROSSINGS")
    result["warnings"].append("APPARENT_SLOPE_IS_NOT_A_MECHANISM_OR_KINETIC_REGION_PROOF")
    steps = np.diff(potential)
    if np.any(steps > 0) and np.any(steps < 0):
        result["warnings"].append("POTENTIAL_REVERSALS_REVIEW_SWEEP_BRANCH_SELECTION")
    if fit.rvalue**2 < 0.98:
        result["warnings"].append("LOW_LINEAR_FIT_QUALITY")
    if payload["metadata"].get("ir_correction_applied") is not True:
        result["warnings"].append("IR_CORRECTION_NOT_CONFIRMED")
    return result


def _capacity_series(payload):
    cycles = column(payload, "cycle_index", "1")
    capacity = column(payload, "discharge_capacity_ah", "Ah")
    if np.any(cycles < 1) or np.any(cycles > MAX_CYCLE_INDEX) or np.any(cycles != np.floor(cycles)) or np.any(np.diff(cycles) <= 0):
        raise ScienceError("invalid_cycle_order", "Use one cell with positive, increasing, unique integer cycles <= 2^53-1")
    if np.any(capacity <= 0):
        raise ScienceError("invalid_capacity", "Capacity must be positive; retain invalid records separately")
    return cycles, capacity


def capacity_fade(payload: dict) -> dict:
    cycles, q = _capacity_series(payload)
    result = _result(payload, "capacity_retention", {"baseline_cycle": int(cycles[0]), "baseline_capacity_ah": float(q[0])})
    result.update(cycle_index=cycles.tolist(), discharge_capacity_ah=q.tolist(),
                  capacity_retention_pct=(100*q/q[0]).tolist(),
                  cycle_range=[int(cycles[0]), int(cycles[-1])])
    if np.any(np.diff(q) > 0):
        result["warnings"].append("CAPACITY_INCREASE_OBSERVED_NOT_AUTOMATICALLY_INVALID")
    return result


def differential_capacity(payload: dict, *, grid_points=300, sigma_points=1.5) -> dict:
    if isinstance(grid_points, bool) or not isinstance(grid_points, int) or not 50 <= grid_points <= 2000:
        raise ScienceError("invalid_input", "grid_points must be an integer in 50..2000")
    sigma = finite_number(sigma_points, "sigma_points")
    if not 0 <= sigma <= 5:
        raise ScienceError("invalid_input", "sigma_points must be in 0..5")
    v = column(payload, "voltage_v", "V")
    q = column(payload, "capacity_ah", "Ah")
    phase = payload["metadata"].get("phase")
    if phase not in ("charge", "discharge") or payload["metadata"].get("capacity_convention") != "positive_cumulative":
        raise ScienceError("missing_convention", "State phase and positive_cumulative capacity convention")
    span = float(np.ptp(v))
    # Allow rounding at the threshold, not a physically smaller measurement window.
    sufficient_span = span >= 0.05 or math.isclose(span, 0.05, rel_tol=1e-12, abs_tol=0.0)
    if len(v) < 10 or not sufficient_span or np.any(q < 0) or np.any(np.diff(q) < 0):
        raise ScienceError("invalid_curve", "Need a single monotonic-capacity segment with >=10 samples and >=0.05 V span")
    dv = np.diff(v)
    if (phase == "charge" and np.any(dv <= 0)) or (phase == "discharge" and np.any(dv >= 0)):
        raise ScienceError("nonmonotonic_voltage", "Select a single monotonic voltage segment; duplicates/reversals need explicit preprocessing")
    if phase == "discharge":
        v, q = v[::-1], q[::-1]
    grid = np.linspace(v[0], v[-1], grid_points)
    interpolated = np.interp(grid, v, q)
    # SciPy's default support is floor(4*sigma+0.5). A zero-radius kernel is identity;
    # bypass it before tiny sigma squared underflows inside the Gaussian formula.
    radius = int(4.0*sigma + 0.5)
    smooth = gaussian_filter1d(interpolated, sigma, mode="nearest", radius=radius) if radius else interpolated
    derivative = np.gradient(smooth, grid)
    trim = max(1, int(math.ceil(3*sigma)))
    keep = slice(trim, -trim)
    result = _result(payload, "voltage_grid_gaussian_gradient", {
        "grid_points": grid_points, "sigma_points": sigma, "gaussian_radius_points": radius,
        "edge_trim_points": trim,
        "phase": phase, "capacity_convention": "positive_cumulative", "derivative_sign": "signed_dQ_dV"})
    result.update(voltage_v=grid[keep].tolist(), capacity_ah=smooth[keep].tolist(),
                  dq_dv_ah_v=derivative[keep].tolist(),
                  voltage_range_v=[float(v[0]), float(v[-1])])
    result["warnings"].append("FEATURES_DO_NOT_UNIQUELY_IDENTIFY_DEGRADATION_MECHANISM")
    return result


def knee_point(payload: dict, *, min_segment_points=5, minimum_bic_gain=6.0) -> dict:
    cycles, capacity = _capacity_series(payload)
    if isinstance(min_segment_points, bool) or not isinstance(min_segment_points, int) or min_segment_points < 5:
        raise ScienceError("invalid_input", "min_segment_points must be an integer >=5")
    gain_limit = finite_number(minimum_bic_gain, "minimum_bic_gain")
    if gain_limit < 0 or len(cycles) < 2*min_segment_points+1:
        raise ScienceError("insufficient_data", "Need >=2*min_segment_points+1 cycles and nonnegative BIC threshold")
    # Normalize the cycle coordinate so least-squares conditioning is independent of units/range.
    x = (cycles-cycles[0])/(cycles[-1]-cycles[0])
    q = capacity/capacity[0]
    n = len(q)
    isolated = np.flatnonzero((np.abs(q[1:-1]-(q[:-2]+q[2:])/2) > 0.02)
                             & (np.abs(q[:-2]-q[2:]) < 0.01)) + 1
    linear_design = np.column_stack([np.ones(n), x])
    linear = linear_design @ np.linalg.lstsq(linear_design, q, rcond=None)[0]
    linear_sse = float(np.sum((q-linear)**2))
    best = None
    candidates = np.unique(np.linspace(min_segment_points, n-min_segment_points-1,
                                       min(300, n-2*min_segment_points), dtype=int))
    for i in candidates:
        design = np.column_stack([np.ones(n), x, np.maximum(0, x-x[i])])
        coeff = np.linalg.lstsq(design, q, rcond=None)[0]
        fitted = design @ coeff
        sse = float(np.sum((q-fitted)**2))
        if best is None or sse < best[0]:
            best = (sse, i, coeff, fitted)
    sse, i, coeff, fitted = best
    floor = np.finfo(float).eps * n
    # Four parameters count the searched breakpoint as well as the three coefficients.
    bic_gain = n*math.log(max(linear_sse, floor)/max(sse, floor)) - 2*math.log(n)
    accelerated_loss = coeff[2] < 0 and coeff[1]+coeff[2] < 0
    detectable_loss = -coeff[2]*(x[-1]-x[i]) >= 0.01
    detected = bool(bic_gain >= gain_limit and accelerated_loss and detectable_loss)
    result = _result(payload, "continuous_segmented_regression", {
        "min_segment_points": min_segment_points, "minimum_bic_gain": gain_limit,
        "minimum_added_fractional_loss": 0.01, "candidate_count": len(candidates),
        "search": "up_to_300_evenly_spaced_observed_cycles",
        "cycle_coordinate": "normalized_observed_span_0_to_1",
        "isolated_anomaly_screen": {"fractional_deviation_above": 0.02, "neighbor_difference_below": 0.01}})
    result.update(status="candidate_detected" if detected else "not_detected",
                  knee_point_cycle_estimated=int(cycles[i]) if detected else None,
                  bic_gain=float(bic_gain), cycle_range=[int(cycles[0]), int(cycles[-1])],
                  isolated_capacity_anomaly_cycles=cycles[isolated].astype(int).tolist(),
                  cycle_index=cycles.tolist(), fitted_capacity_ah=(fitted*capacity[0]).tolist() if detected else [])
    if len(isolated):
        result["warnings"].append("ISOLATED_CAPACITY_ANOMALIES_RETAINED_REVIEW_BREAKPOINT_SENSITIVITY")
    result["warnings"].append("DESCRIPTIVE_BREAKPOINT_WITHIN_OBSERVED_RANGE_NOT_LIFETIME_PREDICTION")
    return result


def analyze(payload: dict, method: str, parameters: dict | None = None) -> dict:
    functions = {"tafel_slope": ("electrocatalysis", catalysis),
                 "capacity_fade": ("battery_cycling", capacity_fade),
                 "dq_dv": ("battery_cycling", differential_capacity),
                 "knee_point": ("battery_cycling", knee_point)}
    if not isinstance(method, str) or method not in functions:
        raise ScienceError("unsupported_analysis", "Unknown analysis type")
    domain, function = functions[method]
    if payload.get("domain") != domain:
        raise ScienceError("domain_mismatch", "Analysis does not match slice domain")
    if parameters is not None and not isinstance(parameters, dict):
        raise ScienceError("invalid_input", "Parameters must be an object")
    try:
        with np.errstate(over="raise", divide="raise", invalid="raise"):
            result = function(payload, **(parameters or {}))
        try:
            json.dumps(result, allow_nan=False)
        except ValueError as error:
            raise ScienceError("numerical_failure", "Calculation produced nonfinite output") from error
        return result
    except TypeError as error:
        raise ScienceError("invalid_input", "Unsupported analysis parameter") from error
    except (FloatingPointError, np.linalg.LinAlgError, OverflowError) as error:
        raise ScienceError("numerical_failure", "Calculation exceeds stable finite numeric range") from error
