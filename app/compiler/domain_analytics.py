"""Numerical, observation-bounded electrochemistry analyses.

DTA follows Corva et al., ACS Catalysis (2022), DOI 10.1021/acscatal.2c03581:
compare exponential slopes of current and its first derivative, using the
second-derivative maximum as an upper bound. Interval selection below is a
documented deterministic implementation, not a claim of a universal estimator.
"""

from __future__ import annotations

from typing import Any, Sequence

import numpy as np
from numpy.typing import NDArray
from scipy.ndimage import gaussian_filter1d
from scipy.optimize import minimize_scalar
from scipy.signal import find_peaks, savgol_filter
from scipy.stats import linregress

FloatArray = NDArray[np.float64]


def _paired(
    x_values: Sequence[float], y_values: Sequence[float], *, minimum: int
) -> tuple[FloatArray, FloatArray]:
    """Check real, finite, paired samples without silently sorting a scan."""
    x_raw, y_raw = np.asarray(x_values), np.asarray(y_values)
    if x_raw.dtype.kind not in "iuf" or y_raw.dtype.kind not in "iuf":
        raise ValueError("Samples must be real numbers, not strings or booleans")
    x, y = x_raw.astype(float), y_raw.astype(float)
    if x.ndim != 1 or y.ndim != 1 or x.size != y.size or x.size < minimum:
        raise ValueError(f"At least {minimum} paired one-dimensional samples are required")
    if not np.isfinite(x).all() or not np.isfinite(y).all():
        raise ValueError("Samples must be finite")
    if np.any(np.diff(x) <= 0):
        raise ValueError("Independent samples must be strictly increasing")
    return x, y


def tafel_analysis(
    v_arr: Sequence[float], j_arr: Sequence[float], equilibrium_v: float = 1.229
) -> dict[str, Any]:
    """Fit eta versus log10(j) on the protocol's fixed 1--10 mA/cm² range.

    Potentials must already use the same reference as ``equilibrium_v``.
    Eta10 is interpolated only when the measured scan brackets 10 mA/cm².
    """
    v, j = _paired(v_arr, j_arr, minimum=3)
    if isinstance(equilibrium_v, bool) or not np.isfinite(equilibrium_v):
        raise ValueError("Equilibrium potential must be finite")
    if np.any(np.diff(j) < -1e-6):
        raise ValueError("Eta10 interpolation requires a monotonic anodic scan")
    if j[0] > 10.0 or j[-1] < 10.0:
        raise ValueError("The observed current range does not bracket 10 mA/cm²")
    selected = (j >= 1.0) & (j <= 10.0)
    if np.count_nonzero(selected) < 3 or np.ptp(j[selected]) == 0:
        raise ValueError("At least three distinct samples in 1--10 mA/cm² are required")
    fit = linregress(np.log10(j[selected]), v[selected] - equilibrium_v)
    # Only sub-tolerance downward steps are flattened for ordered interpolation;
    # regression uses the original measurements, and substantive drops reject.
    v10 = float(np.interp(10.0, np.maximum.accumulate(j), v))
    return {
        "tafel_slope_mv_dec": float(fit.slope * 1000.0),
        "r_squared": float(fit.rvalue**2),
        "overpotential_10ma_mv": float((v10 - equilibrium_v) * 1000.0),
        "potential_10ma_v": v10,
        "intercept_mv": float(fit.intercept * 1000.0),
        "fit_current_range_ma_cm2": [float(j[selected][0]), float(j[selected][-1])],
        "fit_point_count": int(np.count_nonzero(selected)),
        "method": "OLS eta vs log10(j); fixed protocol interval 1 <= j <= 10 mA/cm²",
    }


def differential_tafel_analysis(
    v_arr: Sequence[float], j_arr: Sequence[float]
) -> dict[str, Any]:
    """Compute DTA with automatic, derivative-consistent interval selection.

    Samples are interpolated onto a uniform voltage grid before a fourth-order
    Savitzky--Golay differentiation. Before the second-derivative maximum, the
    longest contiguous interval where d ln(j)/dV and d ln(dj/dV)/dV agree within
    10% is used. At least six samples and a quarter decade are required. Both
    fits use this exact same interval. A lack of such an interval is reported
    as insufficient kinetic evidence instead of extrapolating a slope.
    """
    measured_v, measured_j = _paired(v_arr, j_arr, minimum=15)
    v = np.linspace(measured_v[0], measured_v[-1], measured_v.size)
    j = np.interp(v, measured_v, measured_j)
    step = float(v[1] - v[0])
    window = min(31, max(7, 2 * (v.size // 100) + 1))
    window = min(window, v.size if v.size % 2 else v.size - 1)
    d1 = savgol_filter(j, window, polyorder=4, deriv=1, delta=step)
    d2 = savgol_filter(j, window, polyorder=4, deriv=2, delta=step)
    margin = window // 2
    interior = np.arange(margin, v.size - margin)
    maximum_index = int(interior[np.argmax(d2[interior])])
    if d2[maximum_index] <= 0:
        raise ValueError("No positive second-derivative maximum supports exponential kinetics")
    current_log_gradient = np.zeros_like(j)
    derivative_log_gradient = np.zeros_like(j)
    np.divide(d1, j, out=current_log_gradient, where=j > 0)
    np.divide(d2, d1, out=derivative_log_gradient, where=d1 > 0)
    scale = np.maximum(np.abs(current_log_gradient), np.abs(derivative_log_gradient))
    mismatch = np.full_like(j, np.inf)
    np.divide(
        np.abs(current_log_gradient - derivative_log_gradient),
        scale,
        out=mismatch,
        where=scale > 0,
    )
    selected = (
        (j > max(float(np.max(j)) * 1e-6, 0.0))
        & (d1 > 0)
        & (d2 > 0)
        & (mismatch <= 0.10)
        & (np.arange(v.size) >= margin)
        & (np.arange(v.size) <= maximum_index)
    )
    indices = np.flatnonzero(selected)
    runs = np.split(indices, np.flatnonzero(np.diff(indices) > 1) + 1)
    eligible = [
        run
        for run in runs
        if run.size >= 6 and np.log10(j[run[-1]] / j[run[0]]) >= 0.25
    ]
    if not eligible:
        raise ValueError("No derivative-consistent kinetic interval spans a quarter decade")
    interval = max(eligible, key=lambda run: (run.size, -int(run[0])))
    current_fit = linregress(v[interval], np.log(j[interval]))
    derivative_fit = linregress(v[interval], np.log(d1[interval]))
    if current_fit.slope <= 0 or derivative_fit.slope <= 0:
        raise ValueError("Selected interval does not have positive exponential growth")
    current_slope = float(1000.0 * np.log(10.0) / current_fit.slope)
    derivative_slope = float(1000.0 * np.log(10.0) / derivative_fit.slope)
    difference = abs(current_slope - derivative_slope) / max(current_slope, derivative_slope)
    local_slopes: list[float | None] = [
        float(1000.0 * np.log(10.0) / value) if value > 0 else None
        for value in derivative_log_gradient
    ]
    return {
        "tafel_slope_mv_dec": derivative_slope,
        "current_tafel_slope_mv_dec": current_slope,
        "derivative_r_squared": float(derivative_fit.rvalue**2),
        "current_r_squared": float(current_fit.rvalue**2),
        "slope_relative_difference": float(difference),
        "kinetic_consistent": bool(
            difference <= 0.10
            and derivative_fit.rvalue**2 >= 0.98
            and current_fit.rvalue**2 >= 0.98
        ),
        "fit_potential_range_v": [float(v[interval[0]]), float(v[interval[-1]])],
        "fit_point_count": int(interval.size),
        "second_derivative_max_potential_v": float(v[maximum_index]),
        "voltage_v": v.tolist(),
        "current_density_ma_cm2": j.tolist(),
        "first_derivative": d1.tolist(),
        "second_derivative": d2.tolist(),
        "local_tafel_slope_mv_dec": local_slopes,
        "smoothing_window_points": int(window),
        "method": "Corva DTA: matched ln(j) and ln(dj/dV) fits before max(d²j/dV²)",
    }


def differential_capacity(
    v_arr: Sequence[float], q_arr: Sequence[float]
) -> dict[str, Any]:
    """Differentiate a charge capacity curve with a Gaussian first derivative.

    The input is one monotonic-voltage charge segment, with cumulative capacity
    in Ah. Uniform-grid interpolation handles nonuniform voltage sampling.
    Linear continuation at either edge avoids zero-padding phase artifacts.
    """
    measured_v, measured_q = _paired(v_arr, q_arr, minimum=7)
    v = np.linspace(measured_v[0], measured_v[-1], measured_v.size)
    q = np.interp(v, measured_v, measured_q)
    step = float(v[1] - v[0])
    sigma = 1.5
    radius = int(4.0 * sigma + 0.5)
    left = q[0] + np.arange(-radius, 0) * (q[1] - q[0])
    right = q[-1] + np.arange(1, radius + 1) * (q[-1] - q[-2])
    extended = np.concatenate([left, q, right])
    derivative = gaussian_filter1d(extended, sigma=sigma, order=1)[radius:-radius] / step
    prominence = float(np.max(np.abs(derivative))) * 0.02
    peaks, _ = find_peaks(derivative, prominence=max(prominence, np.finfo(float).eps))
    positive_peaks = peaks[derivative[peaks] > 0]
    return {
        "voltage_v": v.tolist(),
        "dq_dv_ah_v": derivative.tolist(),
        "peak_voltages_v": v[positive_peaks].tolist(),
        "peak_heights_ah_v": derivative[positive_peaks].tolist(),
        "positive": bool(np.all(derivative > 0)),
        "gaussian_sigma_samples": sigma,
        "method": "Uniform-grid Gaussian first derivative of charge capacity; Ah/V",
    }


def predict_knee_point(
    cycles: Sequence[float], capacities: Sequence[float]
) -> dict[str, Any]:
    """Estimate an observed knee by a continuous bilinear least-squares fit.

    The method compares a line against y=a+b*N+c*max(0,N-k). A knee is reported
    only for appreciably faster fade, BIC improvement > 6, and an interior
    breakpoint supported by at least 10% of observations on each side. This is
    an observation-bounded estimate, not a validated future-lifetime predictor.
    """
    x, y = _paired(cycles, capacities, minimum=12)
    if np.any(y <= 0):
        raise ValueError("Discharge capacities must be positive")
    count = x.size
    line_design = np.column_stack([np.ones(count), x])
    line_coeff, _, _, _ = np.linalg.lstsq(line_design, y, rcond=None)
    line_sse = float(np.sum((line_design @ line_coeff - y) ** 2))
    minimum_side = max(5, count // 10)
    candidates = x[minimum_side:-minimum_side]

    def fit_at(knee: float) -> tuple[float, FloatArray, FloatArray]:
        design = np.column_stack([np.ones(count), x, np.maximum(0.0, x - knee)])
        coeff, _, _, _ = np.linalg.lstsq(design, y, rcond=None)
        prediction = design @ coeff
        return float(np.sum((prediction - y) ** 2)), coeff, prediction

    errors = [fit_at(float(knee))[0] for knee in candidates]
    best_index = int(np.argmin(errors))
    low = float(candidates[max(0, best_index - 1)])
    high = float(candidates[min(candidates.size - 1, best_index + 1)])
    optimized = minimize_scalar(lambda knee: fit_at(float(knee))[0], bounds=(low, high), method="bounded")
    knee = float(optimized.x)
    sse, coefficients, predicted = fit_at(knee)
    pre = float(coefficients[1])
    post = float(coefficients[1] + coefficients[2])
    floor = np.finfo(float).eps * max(float(np.sum(y**2)), 1.0)
    bic_gain = float(count * np.log(max(line_sse, floor) / max(sse, floor)) - 2 * np.log(count))
    improvement = max(0.0, (line_sse - sse) / line_sse) if line_sse > floor else 0.0
    identified = bool(
        line_sse > floor
        and bic_gain > 6.0
        and pre <= 0.0
        and post < pre
        and abs(post) >= 1.5 * abs(pre)
    )
    total_variation = float(np.sum((y - np.mean(y)) ** 2))
    chosen_sse = sse if identified else line_sse
    r_squared = 1.0 - chosen_sse / total_variation if total_variation > floor else 1.0
    return {
        "knee_cycle": knee if identified else None,
        "identified": identified,
        "pre_knee_slope": pre if identified else float(line_coeff[1]),
        "post_knee_slope": post if identified else None,
        "fit_r_squared": float(r_squared),
        "relative_sse_improvement": float(improvement),
        "bic_improvement": bic_gain,
        "observed_cycle_range": [float(x[0]), float(x[-1])],
        "fitted_capacity_ah": predicted.tolist() if identified else (line_design @ line_coeff).tolist(),
        "status": "observed_knee" if identified else "not_identifiable_from_observed_cycles",
        "method": "Continuous bilinear fit; no extrapolation beyond observed cycles",
    }
