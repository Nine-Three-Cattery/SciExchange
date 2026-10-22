"""Versioned consistency checks with explicit assumptions and coverage."""
from __future__ import annotations

from dataclasses import dataclass
import math

import numpy as np

from .domain_analytics import MAX_CYCLE_INDEX, ScienceError, column, finite_number, input_hash, validate_table, valid_identifier
from .safety_guardrail import screen_metadata

RULE_VERSION = "science-rules-1.0"
FARADAY_C_MOL = 96485.33212


@dataclass(frozen=True)
class RuleProfile:
    """Screening limits, not universal physical laws. Set by server, never untrusted notes."""
    fe_tolerance_percentage_points: float = 0.5
    ce_min_ratio: float = 0.98
    ce_max_ratio: float = 1.005

    def __post_init__(self):
        for name, value in vars(self).items():
            finite_number(value, name)
        if self.fe_tolerance_percentage_points < 0 or not 0 <= self.ce_min_ratio < self.ce_max_ratio:
            raise ValueError("Invalid screening profile")


def format_diagnostic_log(checks: list[dict]) -> str:
    return "\n".join(f"[{item['status'].upper()}] {item['rule_id']}: {item['reason']}" for item in checks)


def verify(payload: dict, profile: RuleProfile | None = None) -> dict:
    profile = profile or RuleProfile()
    checks = []

    def add(rule_id, status, reason, observed=None, allowed_range=None, assumptions=None):
        checks.append({"rule_id": rule_id, "rule_version": RULE_VERSION, "status": status,
                       "reason": reason, "observed_value": observed, "allowed_range": allowed_range,
                       "assumptions": assumptions or []})

    try:
        validate_table(payload)
        add("TABLE_FINITE", "pass", "Distinct columns and rectangular finite numeric measurements")
    except ScienceError as error:
        add("TABLE_FINITE", "fail", str(error))
        return _report(payload, checks, None)
    try:
        safety = screen_metadata(payload.get("metadata", {}))
    except ValueError as error:
        add("METADATA_BOUNDS", "fail", str(error))
        return _report(payload, checks, None)
    metadata = safety["safe_metadata"]
    add("METADATA_SCREEN", "fail" if safety["quarantined"] else "warn" if safety["review_required"] else "pass",
        "Review or quarantine flagged fields" if safety["alerts"] else "No configured pattern matched; this is not a safety guarantee")
    if isinstance(metadata.get("source_url"), str) and metadata["source_url"] and metadata.get("data_origin") in ("experimental", "synthetic", "synthetic_fault_injection"):
        add("PROVENANCE_DECLARED", "pass", "Origin and source are declared; authenticity is not established by this check")
    else:
        add("PROVENANCE_DECLARED", "not_checked", "Source URL or data origin is absent")
    if metadata.get("quality_flags"):
        add("SOURCE_QUALITY_FLAGS", "warn", "Source or adapter declares unresolved quality limitations")

    try:
        domain = payload.get("domain")
        if domain == "electrocatalysis":
            j = column(payload, "current_density_ma_cm2", "mA/cm2")
            add("CURRENT_DENSITY_UNITS", "pass", "Current-density unit is explicit", [float(j.min()), float(j.max())])
            potentials = [c for c in ("overpotential_v", "potential_v_vs_rhe", "potential_v_vs_reference") if c in payload["columns"]]
            if not potentials:
                add("POTENTIAL_REFERENCE", "not_checked", "Potential or overpotential is absent")
            else:
                column(payload, potentials[0], "V")
                stated = potentials[0] != "potential_v_vs_reference" or bool(metadata.get("reference_electrode"))
                add("POTENTIAL_REFERENCE", "pass" if stated else "not_checked", "Reference and unit declared" if stated else "Reference electrode absent")
            raw_keys = ("product_moles", "charge_coulombs", "electron_transfer_number")
            if all(metadata.get(k) is not None for k in raw_keys):
                moles, charge, z = [finite_number(metadata[k], k) for k in raw_keys]
                if moles < 0 or charge <= 0 or z <= 0 or z != int(z):
                    add("FE_INPUTS", "fail", "Require nonnegative product amount, positive charge and integer electron number")
                else:
                    fe = 100*z*FARADAY_C_MOL*moles/charge
                    if not math.isfinite(fe):
                        raise ScienceError("numerical_failure", "FE calculation exceeds finite numeric range")
                    add("FE_MEASURED_RATIO", "warn" if fe > 100+profile.fe_tolerance_percentage_points else "pass",
                        "Computed product-charge ratio; calibration and uncertainty require independent review", fe,
                        [0, 100+profile.fe_tolerance_percentage_points], ["Product and charge cover the same experiment and interval", "Product attributed to the specified electron-transfer reaction"])
                    if metadata.get("faradaic_efficiency_pct") is not None:
                        reported = finite_number(metadata["faradaic_efficiency_pct"], "faradaic_efficiency_pct")
                        difference = abs(reported-fe)
                        if not math.isfinite(difference):
                            raise ScienceError("numerical_failure", "FE consistency residual exceeds finite numeric range")
                        add("FE_REPORTED_CONSISTENCY", "pass" if difference <= profile.fe_tolerance_percentage_points else "warn",
                            "Compare reported FE with recomputed ratio", difference)
            else:
                add("FE_MEASURED_RATIO", "not_checked", "Product amount, integrated charge or electron number missing; LSV alone cannot establish FE")
            if metadata.get("faradaic_efficiency_pct") is not None:
                reported = finite_number(metadata["faradaic_efficiency_pct"], "faradaic_efficiency_pct")
                add("FE_REPORTED_RANGE", "warn" if not 0 <= reported <= 100+profile.fe_tolerance_percentage_points else "pass",
                    "Reported value screening only; outlier is not proof of fraud", reported, [0, 100+profile.fe_tolerance_percentage_points])
            add("OER_EQUILIBRIUM", "not_checked", "No universal potential threshold applied without validated reaction, reference, activities and operating conditions")
            add("INSTRUMENT_CAUSE", "not_checked", "Resistance or drift alone does not identify operator error")
            add("ARRHENIUS_FIT", "not_checked", "No multi-temperature rate series supplied to this rule profile")
        elif domain == "battery_cycling":
            if "discharge_capacity_ah" in payload["columns"]:
                cycles = column(payload, "cycle_index", "1")
                qd = column(payload, "discharge_capacity_ah", "Ah")
                valid_order = bool(np.all(cycles >= 1) and np.all(cycles <= MAX_CYCLE_INDEX) and np.all(cycles == np.floor(cycles)) and np.all(np.diff(cycles) > 0))
                add("CYCLE_ORDER", "pass" if valid_order else "fail", "One cell, positive unique increasing integer cycle indices <= 2^53-1 required")
                add("CAPACITY_POSITIVE", "pass" if np.all(qd > 0) else "fail", "Nonpositive capacities require separate examination")
                if np.any(np.diff(qd) > 0):
                    add("CAPACITY_TREND", "warn", "Capacity recovery observed; not automatically a violation of conservation")
                else:
                    add("CAPACITY_TREND", "pass", "No capacity increase in supplied rows; no mechanistic conclusion")
                if "charge_capacity_ah" in payload["columns"]:
                    qc = column(payload, "charge_capacity_ah", "Ah")
                    if np.any(qc <= 0):
                        add("CE_INPUTS", "fail", "Charge capacity must be positive for ratio calculation")
                    elif metadata.get("cycle_balance_assumption") == "paired_full_cycles":
                        with np.errstate(over="ignore", divide="ignore"):
                            ce = qd/qc
                        if not np.isfinite(ce).all():
                            raise ScienceError("numerical_failure", "CE calculation exceeds finite numeric range")
                        outside = bool(np.any((ce < profile.ce_min_ratio) | (ce > profile.ce_max_ratio)))
                        add("CE_SCREEN", "warn" if outside else "pass", "Protocol-specific ratio screening, not a thermodynamic proof",
                            [float(ce.min()), float(ce.max())], [profile.ce_min_ratio, profile.ce_max_ratio], ["Paired charge and discharge with declared SOC boundaries"])
                    else:
                        add("CE_SCREEN", "not_checked", "Charge/discharge SOC boundary pairing not established")
                else:
                    add("CE_SCREEN", "not_checked", "Charge capacity is absent")
            elif "voltage_v" in payload["columns"]:
                voltage = column(payload, "voltage_v", "V")
                column(payload, "capacity_ah", "Ah")
                limits = metadata.get("voltage_limits_v")
                if isinstance(limits, list) and len(limits) == 2:
                    lo, hi = [finite_number(x, "voltage limit") for x in limits]
                    if lo >= hi:
                        raise ScienceError("invalid_input", "Voltage lower limit must be smaller than upper limit")
                    outside = bool(np.any((voltage < lo) | (voltage > hi)))
                    add("VOLTAGE_PROTOCOL", "warn" if outside else "pass", "Compare with declared protocol limits", [float(voltage.min()), float(voltage.max())], limits)
                else:
                    add("VOLTAGE_PROTOCOL", "not_checked", "Protocol voltage limits absent")
                add("DEGRADATION_MECHANISM", "not_checked", "A voltage-capacity curve alone does not prove a degradation mechanism")
            else:
                add("BATTERY_MEASUREMENTS", "fail", "Need cycle summary or within-cycle voltage-capacity measurements")
        else:
            add("DOMAIN", "fail", "Unsupported domain")
    except ScienceError as error:
        add("MEASUREMENT_REQUIREMENTS", "fail", str(error))
    return _report(payload, checks, safety)


def _report(payload, checks, safety):
    failed = any(c["status"] == "fail" for c in checks)
    review = any(c["status"] in {"warn", "not_checked"} for c in checks)
    status = "REJECTED" if failed else "REVIEW_REQUIRED" if review else "CHECKS_PASSED"
    try:
        digest = input_hash(payload)
    except (ValueError, TypeError, RecursionError):
        digest = None
    slice_id = payload.get("slice_id") if isinstance(payload, dict) else None
    return {"slice_id": slice_id if valid_identifier(slice_id) else None,
            "rule_version": RULE_VERSION, "input_sha256": digest, "compiler_status": status,
            "valid": status == "CHECKS_PASSED", "blocking_failure": failed,
            "checks": checks, "coverage": {s: sum(c["status"] == s for c in checks) for s in ("pass", "warn", "fail", "not_checked")},
            "safety_alerts": safety["alerts"] if safety else [],
            "safe_metadata": safety["safe_metadata"] if safety else {},
            "diagnostic_log": format_diagnostic_log(checks), "formal_proof": False,
            "scope": "Implemented consistency checks only; listing permission belongs to platform policy."}
