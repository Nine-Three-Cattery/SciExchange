"""Offline science demo: verifies fixtures and writes calculations, never authorizes trades."""
import argparse
import json
from pathlib import Path

from app.agent.matching import assess_barter
from app.services.domain_analytics import analyze
from app.services.physics_compiler import verify
from app.services.science_io import load_slices

ROOT = Path(__file__).resolve().parents[2]


def run(directory):
    slices = load_slices(directory)
    reports = {key: verify(value) for key, value in slices.items()}
    jobs = [("catalysis_nifec_tafel", "tafel_slope", {"current_min": 0.3, "current_max": 10.0}),
            ("battery_b1c5_early", "capacity_fade", {}), ("battery_b1c5_early", "knee_point", {}),
            ("battery_b1c5_lifetime", "knee_point", {})]
    jobs += [(f"battery_b1c5_cycle_{n}", "dq_dv", {}) for n in (10, 50, 100)]
    results = [analyze(slices[key], method, parameters) for key, method, parameters in jobs]

    def offer(key):
        value = slices[key]
        return {k: value[k] for k in ("slice_id", "version", "domain", "columns", "metadata")} | {
            "can_discover": True, "blocking_failure": reports[key]["blocking_failure"],
            "compiler_status": reports[key]["compiler_status"]}

    barter = assess_barter(
        {"domain": "battery_cycling", "equals": {"chemistry": "LFP/graphite"},
         "required_columns": ["discharge_capacity_ah"]}, offer("battery_b1c5_early"),
        {"domain": "electrocatalysis", "equals": {"reaction": "OER"}}, offer("catalysis_nifec_tafel"))
    return {"mode": "offline_science_demo", "platform_delivery_integrated": False,
            "compiler": reports, "analyses": results, "barter_candidate": barter}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=ROOT/"data/slices")
    parser.add_argument("--output", type=Path, default=ROOT/".cache/science_demo/results.json")
    args = parser.parse_args()
    results = run(args.data)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(results, indent=2, ensure_ascii=False, sort_keys=True, allow_nan=False)+"\n")
    print(f"Verified {len(results['compiler'])} slices; completed {len(results['analyses'])} analyses: {args.output}")
