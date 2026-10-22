"""Numerical enforcement of SciExchange's frozen scientific protocol.

The status name FORMAL_PROOF_VALID is retained for the v4 wire contract. Checks
are numerical protocol checks, not proofs checked by a Lean kernel. In
particular the fixed quality thresholds are not universal laws of chemistry.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Mapping, Sequence
from numbers import Real
from typing import Any

import numpy as np

from app.compiler.domain_analytics import (
    differential_capacity,
    differential_tafel_analysis,
    predict_knee_point,
    tafel_analysis,
)
from app.compiler.safety_guardrail import check_safety

FARADAY_CONSTANT = 96485.33212
STANDARD_OER_POTENTIAL_V = 1.229
NERNST_PH_COEFFICIENT_V = 0.0591


def _number(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, Real) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    return float(value)


def _in_range(value: Any, low: float, high: float) -> bool:
    try:
        numeric = _number(value, "value")
    except ValueError:
        return False
    return low <= numeric <= high


def verify_faradaic_efficiency(fe: float) -> bool:
    """The protocol's strict charge-conservation interval, in percent."""
    return _in_range(fe, 0.0, 100.0)


def verify_coulombic_efficiency(ce: float) -> bool:
    """Charge-conservation ceiling; the compiler separately checks 98--100%."""
    return _in_range(ce, 0.0, 100.0)


def verify_uncompensated_resistance(ru: float) -> bool:
    return _in_range(ru, 0.0, 15.0)


def nernst_potential(ph: float, t_c: float = 25.0) -> float:
    """OER reference versus SHE in the frozen ideal-gas, unit-activity model.

    The pH coefficient scales with absolute temperature. The frozen standard
    potential is held at 1.229 V; this is not a model for temperature-dependent
    standard Gibbs energy or nonstandard gas pressures.
    """
    ph = _number(ph, "pH")
    kelvin = _number(t_c, "temperature_c") + 273.15
    if kelvin <= 0:
        raise ValueError("temperature must be above absolute zero")
    return STANDARD_OER_POTENTIAL_V - NERNST_PH_COEFFICIENT_V * (kelvin / 298.15) * ph


def verify_nernst_potential(v: float, ph: float, t_c: float = 25.0) -> bool:
    """Check a potential explicitly expressed versus SHE, never versus RHE."""
    try:
        potential, threshold = _number(v, "potential_v_she"), nernst_potential(ph, t_c)
        return potential >= threshold or math.isclose(potential, threshold, rel_tol=0, abs_tol=1e-12)
    except ValueError:
        return False


def verify_lsv_monotonicity(
    v_arr: Sequence[float], j_arr: Sequence[float], epsilon: float = 1e-6
) -> bool:
    """Require forward voltage sampling and no current drop beyond epsilon."""
    try:
        tolerance = _number(epsilon, "epsilon")
        v = np.asarray([_number(x, "potential") for x in v_arr])
        j = np.asarray([_number(x, "current density") for x in j_arr])
    except (TypeError, ValueError):
        return False
    return bool(
        tolerance >= 0 and v.size >= 2 and v.shape == j.shape
        and np.all(np.diff(v) > 0) and np.all(np.diff(j) >= -tolerance)
    )


def calculate_faradaic_efficiency(oxygen_moles: float, total_charge_c: float) -> float:
    moles = _number(oxygen_moles, "oxygen_moles")
    charge = _number(total_charge_c, "total_charge_c")
    if moles < 0 or charge <= 0:
        raise ValueError("oxygen amount must be nonnegative and total charge positive")
    efficiency = 4.0 * moles * FARADAY_CONSTANT / charge * 100.0
    # Normalize only arithmetic roundoff at the conservation ceiling. This is
    # four floating-point ulps, not an experimental allowance for excess yield.
    if math.isclose(efficiency, 100.0, rel_tol=0.0, abs_tol=4 * math.ulp(100.0)):
        return 100.0
    return efficiency


def format_diagnostic_log(
    physics_results: Mapping[str, Mapping[str, Any]], safety_alerts: Sequence[Mapping[str, Any]] = ()
) -> list[str]:
    """Render actual check outcomes in the requested Lean-style console syntax."""
    logs = ["-- Runtime numerical diagnostics; not a Lean-kernel-checked scientific proof."]
    for axiom_id, result in physics_results.items():
        if result["passed"]:
            logs.append(f"info: {axiom_id}: passed; {result['detail']}")
        else:
            category = "operational guardrail" if result["severity"] == "OPERATOR_ERROR_UNCOMPENSATED" else "physical invariant"
            logs.append(f"error: {category} violated: {result['detail']} [{axiom_id}]")
    for alert in safety_alerts:
        logs.append(f"error: safety guardrail: {alert['type']}; {alert['rule']}; quarantined")
    if physics_results and all(result["passed"] for result in physics_results.values()) and not safety_alerts:
        logs.append("theorem InvariantProof : checksPassed = true := by rfl")
    return logs


def _metadata_maps(document: Mapping[str, Any]) -> tuple[Mapping[str, Any], Mapping[str, Any], Mapping[str, Any]]:
    metadata = document.get("metadata")
    if not isinstance(metadata, Mapping):
        raise ValueError("metadata must be an object")
    metrics, conditions = metadata.get("extracted_metrics", {}), metadata.get("testing_conditions", {})
    if not isinstance(metrics, Mapping) or not isinstance(conditions, Mapping):
        raise ValueError("extracted_metrics and testing_conditions must be objects")
    return metadata, metrics, conditions


def _field(metadata: Mapping[str, Any], values: Mapping[str, Any], key: str) -> Any:
    if key in values:
        if key in metadata and metadata[key] != values[key]:
            raise ValueError(f"conflicting flat and nested {key}")
        return values[key]
    if key in metadata:
        return metadata[key]
    raise ValueError(f"missing required measurement: {key}")


def _columns(document: Mapping[str, Any], *names: str, minimum: int = 2) -> list[list[float]]:
    columns, rows = document.get("columns"), document.get("rows")
    if not isinstance(columns, list) or not all(isinstance(c, str) for c in columns) or len(set(columns)) != len(columns):
        raise ValueError("columns must be unique strings")
    if not isinstance(rows, list) or len(rows) < minimum:
        raise ValueError(f"at least {minimum} data rows are required")
    if any(not isinstance(row, list) or len(row) != len(columns) for row in rows):
        raise ValueError("every row must match the declared columns")
    if any(name not in columns for name in names):
        raise ValueError("missing required columns: " + ", ".join(name for name in names if name not in columns))
    return [[_number(row[columns.index(name)], name) for row in rows] for name in names]


class PhysicalCompiler:
    """Evaluate all applicable rules without discarding independent failures."""

    def verify(self, document: Mapping[str, Any]) -> dict[str, Any]:
        if not isinstance(document, Mapping):
            raise ValueError("scientific slice must be an object")
        safety = check_safety(document)
        results: dict[str, dict[str, Any]] = {}
        analytics: dict[str, Any] = {}

        def record(
            axiom: str, passed: bool, detail: str, *, observed: Any = None,
            allowed: Any = None, severity: str = "PHYSICS_VIOLATION", formula: str = "",
        ) -> None:
            results[axiom] = {
                "axiom_id": axiom, "name": axiom, "passed": bool(passed),
                "status": "pass" if passed else "fail", "detail": detail,
                "observed_value": observed, "allowed_range": allowed,
                "severity": severity, "formula": formula,
            }

        def attempt(axiom: str, operation: Callable[[], None], *, operational: bool = False) -> None:
            try:
                operation()
            except ValueError as error:
                record(axiom, False, str(error), severity="OPERATOR_ERROR_UNCOMPENSATED" if operational else "MISSING_OR_INVALID_INPUT")

        try:
            metadata, metrics, conditions = _metadata_maps(document)
        except ValueError as error:
            metadata, metrics, conditions = {}, {}, {}
            record("INPUT_METADATA", False, str(error), severity="MISSING_OR_INVALID_INPUT")

        def metric(key: str) -> float:
            return _number(_field(metadata, metrics, key), key)

        def condition(key: str) -> Any:
            return _field(metadata, conditions, key)

        domain = document.get("domain")
        if domain == "electrocatalysis":
            def faradaic() -> None:
                reported = metric("faradaic_efficiency")
                raw_keys = [key in metrics or key in metadata for key in ("oxygen_moles", "total_charge_c")]
                calculated = calculate_faradaic_efficiency(metric("oxygen_moles"), metric("total_charge_c")) if any(raw_keys) else reported
                passed = verify_faradaic_efficiency(calculated) and verify_faradaic_efficiency(reported)
                detail = ("Faradaic efficiency is within the conservation interval" if passed else "Faradaic efficiency exceeds theoretical maximum" if max(calculated, reported) > 100 else "Faradaic efficiency cannot be negative")
                record("AXIOM_FARADAIC_EFFICIENCY_MAX", passed, f"{detail}; FE={calculated:.6g}%, reported={reported:.6g}%", observed=calculated, allowed=[0.0, 100.0], formula="FE = 4*n_O2*F/Q_total*100 <= 100%")
                results["AXIOM_FARADAIC_EFFICIENCY_MAX"].update({"basis": "measured_product_and_charge" if all(raw_keys) else "reported_metric", "raw_measurement_verified": all(raw_keys), "benchmark_normal_range": 95 <= calculated <= 100})
                if all(raw_keys):
                    record("AXIOM_FARADAIC_REPORT_CONSISTENCY", abs(calculated - reported) <= 0.05, "Product/charge-derived FE agrees with reported FE within 0.05 percentage points" if abs(calculated - reported) <= .05 else "Reported FE disagrees with product/charge-derived FE", observed=abs(calculated - reported), allowed=[0.0, 0.05])

            attempt("AXIOM_FARADAIC_EFFICIENCY_MAX", faradaic)

            def resistance() -> None:
                value = metric("uncompensated_resistance_ohm")
                record("GUARDRAIL_UNCOMPENSATED_RESISTANCE", verify_uncompensated_resistance(value), f"Uncompensated resistance R_u={value:.6g} Ohm; protocol maximum 15 Ohm", observed=value, allowed=[0.0, 15.0], severity="OPERATOR_ERROR_UNCOMPENSATED", formula="0 <= R_u <= 15 Ohm")

            attempt("GUARDRAIL_UNCOMPENSATED_RESISTANCE", resistance, operational=True)

            def compensation() -> None:
                value = _number(condition("ir_compensation_pct"), "ir_compensation_pct")
                record("GUARDRAIL_IR_COMPENSATION", 85 <= value <= 100, f"Dynamic iR compensation={value:.6g}%", observed=value, allowed=[85.0, 100.0], severity="OPERATOR_ERROR_UNCOMPENSATED")

            attempt("GUARDRAIL_IR_COMPENSATION", compensation, operational=True)

            def ocv() -> None:
                value = _number(condition("ocv_drift_mv"), "ocv_drift_mv")
                duration = _number(condition("ocv_observation_seconds"), "ocv_observation_seconds")
                if duration != 60.0:
                    raise ValueError("OCV drift must be measured over the required 60 s observation")
                record("GUARDRAIL_OCV_DRIFT", abs(value) <= 5.0, f"Absolute pre-scan OCV drift={abs(value):.6g} mV over the protocol's 60 s observation", observed=abs(value), allowed=[0.0, 5.0], severity="OPERATOR_ERROR_UNCOMPENSATED")

            attempt("GUARDRAIL_OCV_DRIFT", ocv, operational=True)

            def oer_arrays() -> tuple[list[float], list[float]]:
                reference = condition("potential_reference")
                if reference not in ("RHE", "SHE"):
                    raise ValueError("potential_reference must be RHE or SHE")
                voltage, current = _columns(document, "potential_v_rhe" if reference == "RHE" else "potential_v_she", "current_density_ma_cm2", minimum=3)
                ph, temperature = _number(condition("ph"), "ph"), _number(metadata.get("temperature_c"), "temperature_c")
                correction = STANDARD_OER_POTENTIAL_V - nernst_potential(ph, temperature)
                if reference == "SHE":
                    voltage = [v + correction for v in voltage]
                return voltage, current

            def monotonicity() -> None:
                voltage, current = oer_arrays()
                largest_drop = max(0.0, -float(np.min(np.diff(current))))
                record("AXIOM_LSV_MONOTONICITY", verify_lsv_monotonicity(voltage, current), "Anodic voltage must increase and current must not fall beyond 1e-6 mA/cm2", observed=largest_drop, allowed=[0.0, 1e-6])

            attempt("AXIOM_LSV_MONOTONICITY", monotonicity)

            def nernst() -> None:
                voltage, current = oer_arrays()
                active = [v for v, j in zip(voltage, current) if j > 0.5]
                if not active:
                    raise ValueError("No net OER region above 0.5 mA/cm2 is available")
                value = min(active)
                record("AXIOM_NERNST_POTENTIAL", value >= STANDARD_OER_POTENTIAL_V, f"Minimum active OER potential={value:.6g} V vs RHE; equilibrium={STANDARD_OER_POTENTIAL_V} V vs RHE", observed=value, allowed=[STANDARD_OER_POTENTIAL_V, None], formula="E_RHE >= 1.229 V when j > 0.5 mA/cm2")

            attempt("AXIOM_NERNST_POTENTIAL", nernst)

            def tafel() -> None:
                voltage, current = oer_arrays()
                analysis = tafel_analysis(voltage, current)
                analytics["tafel"] = analysis
                slope, r_squared = analysis["tafel_slope_mv_dec"], analysis["r_squared"]
                record("AXIOM_TAFEL_CONSISTENCY", 25 <= slope <= 250 and r_squared >= 0.98, f"Tafel slope={slope:.6g} mV/dec, R2={r_squared:.6g} on fixed 1..10 mA/cm2 interval", observed={"slope_mv_dec": slope, "r_squared": r_squared}, allowed={"slope_mv_dec": [25.0, 250.0], "r_squared": [0.98, 1.0]}, formula="eta = a + b*log10(j)")
                if "overpotential_10ma_mv" in metrics or "overpotential_10ma_mv" in metadata:
                    discrepancy = abs(metric("overpotential_10ma_mv") - analysis["overpotential_10ma_mv"])
                    record("AXIOM_OVERPOTENTIAL_REPORT_CONSISTENCY", discrepancy <= 2.0, f"Reported eta10 differs from interpolated trace by {discrepancy:.6g} mV", observed=discrepancy, allowed=[0.0, 2.0])

            attempt("AXIOM_TAFEL_CONSISTENCY", tafel)

            def dta() -> None:
                voltage, current = oer_arrays()
                analysis = differential_tafel_analysis(voltage, current)
                analytics["dta"] = {key: value for key, value in analysis.items() if key not in {"voltage_v", "current_density_ma_cm2", "first_derivative", "second_derivative", "local_tafel_slope_mv_dec"}}
                record("AXIOM_DTA_CONSISTENCY", analysis["kinetic_consistent"], f"Derivative-based Tafel slope={analysis['tafel_slope_mv_dec']:.6g} mV/dec; matched current/derivative fit", observed=analytics["dta"])

            attempt("AXIOM_DTA_CONSISTENCY", dta)

        elif domain == "battery_cycling":
            def battery_arrays() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
                cycle, discharge, charge = _columns(document, "cycle", "discharge_capacity_ah", "charge_capacity_ah", minimum=12)
                arrays = np.asarray(cycle), np.asarray(discharge), np.asarray(charge)
                if np.any(np.diff(arrays[0]) != 1) or np.any(arrays[0] < 1) or np.any(arrays[0] != np.floor(arrays[0])) or np.any(arrays[1] <= 0) or np.any(arrays[2] <= 0):
                    raise ValueError("Cycle numbers must be consecutive positive integers and charge/discharge capacities positive")
                return arrays

            def efficiency() -> None:
                _, discharge, charge = battery_arrays()
                efficiency_values = discharge / charge * 100.0
                # Remove only arithmetic roundoff at the inclusive 98% boundary.
                efficiency_values = np.where(np.isclose(efficiency_values, 98.0, rtol=0.0,
                                                       atol=4 * math.ulp(98.0)), 98.0, efficiency_values)
                record("AXIOM_COULOMBIC_EFFICIENCY_MAX", bool(np.all(efficiency_values <= 100.0)), f"Capacity-derived CE range={efficiency_values.min():.6g}..{efficiency_values.max():.6g}%", observed=[float(efficiency_values.min()), float(efficiency_values.max())], allowed=[0.0, 100.0], formula="CE = Q_discharge/Q_charge*100 <= 100%")
                record("GUARDRAIL_COULOMBIC_NORMAL_RANGE", bool(np.all(efficiency_values >= 98)), "Protocol requires every cycle CE >= 98%", observed=float(efficiency_values.min()), allowed=[98.0, 100.0], severity="OPERATOR_ERROR_UNCOMPENSATED")
                reported = metric("coulombic_efficiency")
                reported_rows = np.asarray(_columns(document, "coulombic_efficiency", minimum=11)[0])
                discrepancy = max(float(np.max(np.abs(efficiency_values - reported_rows))), abs(float(np.mean(efficiency_values)) - reported))
                consistent = discrepancy <= .05 and verify_coulombic_efficiency(reported) and bool(np.all((reported_rows >= 0) & (reported_rows <= 100)))
                record("AXIOM_COULOMBIC_REPORT_CONSISTENCY", consistent, f"Reported and capacity-derived CE difference={discrepancy:.6g} percentage points; reported values must also respect the 100% ceiling", observed=discrepancy, allowed=[0.0, .05])

            attempt("AXIOM_COULOMBIC_EFFICIENCY_MAX", efficiency)

            def decay() -> None:
                cycle, discharge, _ = battery_arrays()
                if condition("closed_cell") is not True or condition("external_lithium_replenishment") is not False:
                    raise ValueError("Frozen decay rule requires a closed cell without external lithium replenishment")
                smooth = np.convolve(discharge, np.ones(10) / 10, mode="valid")
                slope = np.diff(smooth) / np.diff(cycle[9:])
                largest = float(np.max(slope))
                record("AXIOM_CAPACITY_DECAY", largest <= 1e-10, f"Largest 10-cycle moving-average capacity slope={largest:.6g} Ah/cycle", observed=largest, allowed=[None, 0.0], formula="d(mean_10(Q_discharge))/dN <= 0")
                analytics["knee"] = predict_knee_point(cycle.tolist(), discharge.tolist())

            attempt("AXIOM_CAPACITY_DECAY", decay)

            def charge_derivative() -> None:
                if condition("charge_curve_phase") != "charge":
                    raise ValueError("Positive dQ/dV rule requires a charge segment with positive accumulated capacity")
                curve = document.get("charge_curve")
                if not isinstance(curve, Mapping):
                    raise ValueError("An intra-cycle charge_curve is required; cycle summaries cannot supply dQ/dV")
                voltage, capacity = _columns(curve, "voltage_v", "capacity_ah", minimum=7)
                if any(q < 0 for q in capacity):
                    raise ValueError("Accumulated charge capacity must be nonnegative")
                analysis = differential_capacity(voltage, capacity)
                peaks = analysis["peak_voltages_v"]
                positive = analysis["positive"] and all(delta >= 0 for delta in np.diff(capacity))
                record("AXIOM_DIFFERENTIAL_CAPACITY", positive, "Charge dQ/dV must remain positive after Gaussian differentiation; raw capacity may not decrease", observed=min(analysis["dq_dv_ah_v"]), allowed=[0.0, None], formula="dQ/dV > 0 during constant-current charge")
                record("GUARDRAIL_PHASE_TRANSITION_PEAK", bool(peaks), "At least one positive phase-transition peak must be resolved under the benchmark protocol", observed=peaks, severity="OPERATOR_ERROR_UNCOMPENSATED")
                if "LFP" in str(metadata.get("material_name", "")).upper():
                    record("GUARDRAIL_LFP_PEAK_POSITION", any(3.4 <= peak <= 3.45 for peak in peaks), "LFP benchmark requires a resolved 3.40..3.45 V phase peak", observed=peaks, allowed=[3.4, 3.45], severity="OPERATOR_ERROR_UNCOMPENSATED")
                analytics["dq_dv"] = {key: value for key, value in analysis.items() if key not in {"voltage_v", "dq_dv_ah_v"}}

            attempt("AXIOM_DIFFERENTIAL_CAPACITY", charge_derivative)

        elif domain == "hydrothermal_synthesis":
            def failure_record() -> None:
                if metadata.get("data_classification") != "dark_matter_failure" or metadata.get("outcome") != "failed":
                    raise ValueError("Hydrothermal protocol supports explicitly recorded failed crystallization data")
                reason = metadata.get("failure_reason")
                if not isinstance(reason, str) or not reason.strip():
                    raise ValueError("A failure_reason is required")
                fraction = metric("crystallinity_fraction")
                if not 0 <= fraction <= 1:
                    raise ValueError("crystallinity_fraction must be in [0,1]")
                time, temperature, turbidity, phase = _columns(document, "time_h", "temperature_c", "turbidity_ntu", "target_phase_fraction_pct")
                if time[0] < 0 or np.any(np.diff(time) <= 0) or min(temperature) <= -273.15 or min(turbidity) < 0 or min(phase) < 0 or max(phase) > 100:
                    raise ValueError("Hydrothermal observations require increasing nonnegative time, physical temperature, nonnegative turbidity and phase fractions in [0,100]%")
                if abs(phase[-1] / 100 - fraction) > .001:
                    raise ValueError("Reported crystallinity does not agree with the final observation")
                record("DARK_DATA_RECORD_INTEGRITY", True, "Failed crystallization record has observations, explicit outcome and bounded crystallinity; no OER/battery physics theorem is asserted", observed={"crystallinity_fraction": fraction, "observation_count": len(time)})

            attempt("DARK_DATA_RECORD_INTEGRITY", failure_record)
        else:
            record("INPUT_SUPPORTED_DOMAIN", False, "Unsupported scientific domain", severity="MISSING_OR_INVALID_INPUT")

        violations = [result for result in results.values() if not result["passed"]]
        alerts = [alert.model_dump() for alert in safety.alerts]
        valid = not violations and safety.safe and bool(results)
        if not safety.safe:
            status = "REJECTED_SECURITY_ALERT"
        elif any(result["severity"] != "OPERATOR_ERROR_UNCOMPENSATED" for result in violations):
            status = "REJECTED_PHYSICS_VIOLATION"
        elif violations:
            status = "REJECTED_OPERATIONAL_ARTEFACT"
        else:
            status = "FORMAL_PROOF_VALID"
        logs = format_diagnostic_log(results, alerts)
        return {
            "valid": valid, "slice_id": document.get("slice_id"), "compiler_status": status,
            "physics_results": results, "violated_axioms": violations,
            "safety_clearance": safety.model_dump(exclude={"sanitized_content"}),
            "safety_alerts": alerts, "diagnostic_logs": logs, "diagnostic_log": "\n".join(logs),
            "analytics": analytics,
            "verification_scope": "Frozen numerical protocol checks; Lean-style diagnostic rendering only",
        }
