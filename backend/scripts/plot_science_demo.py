"""Scientific QA figure from the offline demo output, separate from C's web frontend."""
import argparse
import json
from pathlib import Path

try:
    import matplotlib
except ModuleNotFoundError as error:
    if error.name != "matplotlib":
        raise
    raise SystemExit("Missing optional plotting dependency. Install backend/requirements-plots.txt in this Python environment.") from None
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from app.services.science_io import load_slices

ROOT = Path(__file__).resolve().parents[2]


def render(results_path, data_path, output):
    results = json.loads(results_path.read_text())
    slices = load_slices(data_path)
    analyses = results["analyses"]
    tafel = next(r for r in analyses if r["method"] == "apparent_tafel_ols")
    full_knee = next(r for r in analyses if r["slice_id"] == "battery_b1c5_lifetime")
    fig, axes = plt.subplots(2, 2, figsize=(12, 8.4), layout="constrained")
    ax = axes[0, 0]
    ax.semilogx(tafel["curve"]["current_density_ma_cm2"], tafel["curve"]["potential_v"], "o", label="Source steady-state steps")
    ax.semilogx(10**np.asarray(tafel["fit"]["log10_current_density"]), tafel["fit"]["potential_v"], label="Selected OLS fit")
    ax.set(xlabel="Current density (mA/cm²)", ylabel="Potential vs Ag/AgCl (V)",
           title=f"NiFeC LDH: apparent slope {tafel['tafel_slope_mv_dec']:.1f} mV/dec\nR² = {tafel['r_squared']:.3f}; eta10 unavailable")
    ax.legend(fontsize=8)
    ax = axes[0, 1]
    table = np.array(slices["battery_b1c5_early"]["rows"])
    ax.plot(table[:, 0], 100*table[:, 1]/table[0, 1])
    ax.set(xlabel="Cycle index", ylabel="Capacity / cycle-2 capacity (%)",
           title="b1c5: observed cycles 2–100\nNo qualifying knee detected in this window")
    ax = axes[1, 0]
    table = np.array(slices["battery_b1c5_lifetime"]["rows"])
    ax.plot(table[:, 0], table[:, 1], label="Measured summary")
    for cycle in full_knee.get("isolated_capacity_anomaly_cycles", []):
        row = table[table[:, 0] == cycle][0]
        ax.annotate(f"Retained anomaly: {cycle}", xy=(row[0], row[1]), xytext=(250, 0.925),
                    arrowprops={"arrowstyle": "->", "color": "grey"}, fontsize=8)
    if full_knee["knee_point_cycle_estimated"] is not None:
        ax.plot(full_knee["cycle_index"], full_knee["fitted_capacity_ah"], label="Segmented fit")
        ax.axvline(full_knee["knee_point_cycle_estimated"], ls="--", color="grey", label=f"Candidate cycle {full_knee['knee_point_cycle_estimated']}")
    ax.set(xlabel="Cycle index", ylabel="Discharge capacity (Ah)", title="Full observed lifetime; descriptive breakpoint")
    ax.legend(fontsize=8)
    ax = axes[1, 1]
    for n in (10, 50, 100):
        curve = next(r for r in analyses if r["slice_id"] == f"battery_b1c5_cycle_{n}")
        ax.plot(curve["voltage_v"], curve["dq_dv_ah_v"], label=f"Cycle {n}")
    ax.set(xlabel="Voltage (V)", ylabel="Signed discharge dQ/dV (Ah/V)",
           title="Author-interpolated Q(V), interior 2.3–3.3 V\nGaussian sigma = 1.5 grid points; no mechanism claim")
    ax.legend(fontsize=8)
    for ax in axes.flat:
        ax.grid(alpha=0.2)
    fig.suptitle("SciExchange B · calculations from attributed experimental slices", fontsize=14)
    output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output, dpi=170)
    plt.close(fig)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", type=Path, default=ROOT/".cache/science_demo/results.json")
    parser.add_argument("--data", type=Path, default=ROOT/"data/slices")
    parser.add_argument("--output", type=Path, default=ROOT/".cache/science_demo/science_panels.png")
    args = parser.parse_args()
    render(args.results, args.data, args.output)
    print(args.output)
