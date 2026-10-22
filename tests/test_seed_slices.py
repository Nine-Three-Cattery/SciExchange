"""Scientific and serialization contracts of the reproducible seed fixtures."""

from __future__ import annotations

import csv
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

from scripts.seed_slices import FARADAY_CONSTANT, INJECTION_SENTINEL, generate_slices


@pytest.fixture()
def slices(tmp_path: Path) -> dict[str, dict]:
    return {path.stem: json.loads(path.read_text()) for path in generate_slices(tmp_path)}


def test_five_deterministic_json_csv_datasets(tmp_path: Path) -> None:
    paths = generate_slices(tmp_path)
    assert {p.stem for p in paths} == {
        "slice_oer_valid", "slice_oer_violation", "slice_battery_valid",
        "slice_cwc_poison", "slice_dark_reaction",
    }
    first = {path.name: path.read_bytes() for path in tmp_path.iterdir()}
    generate_slices(tmp_path)
    assert first == {path.name: path.read_bytes() for path in tmp_path.iterdir()}
    for path in paths:
        document = json.loads(path.read_text())
        assert document["metadata"]["provenance"]["source_type"] == "synthetic_benchmark"
        assert document["metadata"]["provenance"]["experimental_measurement"] is False
        with path.with_suffix(".csv").open(newline="") as handle:
            table = list(csv.reader(handle))
        assert table[0] == document["columns"]
        assert table[1:] == [[str(cell) for cell in row] for row in document["rows"]]


def test_oer_benchmark_has_requested_physics(slices: dict[str, dict]) -> None:
    document = slices["slice_oer_valid"]
    voltage, current = np.asarray([row[:2] for row in document["rows"]]).T
    assert (voltage[0], voltage[-1]) == (1.2, 1.7)
    assert np.all(np.diff(current) >= 0)
    eta10_mv = (np.interp(10.0, current, voltage) - 1.229) * 1000
    assert eta10_mv == pytest.approx(240, abs=0.2)
    kinetic = (current >= 1) & (current <= 10)
    x, y = np.log10(current[kinetic]), voltage[kinetic]
    fit = np.polyfit(x, y, 1)
    r_squared = 1 - np.sum((y - np.polyval(fit, x)) ** 2) / np.sum((y - y.mean()) ** 2)
    assert fit[0] * 1000 == pytest.approx(42.5, abs=0.1)
    assert r_squared >= 0.98
    metrics = document["metadata"]["extracted_metrics"]
    fe = 4 * metrics["oxygen_moles"] * FARADAY_CONSTANT / metrics["total_charge_c"] * 100
    assert fe == pytest.approx(99.2)
    assert metrics["uncompensated_resistance_ohm"] == 4.2


def test_oer_negative_control_contains_all_three_failures(slices: dict[str, dict]) -> None:
    document = slices["slice_oer_violation"]
    metrics = document["metadata"]["extracted_metrics"]
    assert metrics["faradaic_efficiency"] == 108.5
    fe = 4 * metrics["oxygen_moles"] * FARADAY_CONSTANT / metrics["total_charge_c"] * 100
    assert fe == pytest.approx(108.5)
    assert metrics["uncompensated_resistance_ohm"] == 124.5
    assert np.min(np.diff([row[1] for row in document["rows"]])) < 0
    assert any(row[2] == INJECTION_SENTINEL for row in document["rows"])


def test_battery_summary_and_independent_charge_curve(slices: dict[str, dict]) -> None:
    document = slices["slice_battery_valid"]
    rows = np.asarray(document["rows"])
    assert list(rows[:, 0]) == list(range(1, 101))
    assert np.all(np.diff(rows[:, 1]) < 0)
    assert np.allclose(rows[:, 1] / rows[:, 2] * 100, 99.8)
    voltage, capacity = np.asarray(document["charge_curve"]["rows"]).T
    assert len(voltage) > 100
    assert np.all(np.diff(voltage) > 0)
    dq_dv = np.gradient(capacity, voltage)
    assert np.all(dq_dv > 0)
    assert 3.40 <= voltage[np.argmax(dq_dv)] <= 3.45
    assert capacity[-1] == pytest.approx(rows[0, 2])


def test_safety_sentinel_and_failed_experiment_are_explicit(slices: dict[str, dict]) -> None:
    poison = slices["slice_cwc_poison"]
    assert "Novichok agent" in poison["metadata"]["title"]
    assert poison["metadata"]["data_classification"] == "negative_control"
    dark = slices["slice_dark_reaction"]
    assert dark["metadata"]["data_classification"] == "dark_matter_failure"
    assert dark["metadata"]["testing_conditions"]["outcome"] == "failed_crystallization"
    assert dark["metadata"]["extracted_metrics"]["target_phase_fraction_pct"] < 5
    assert len(dark["rows"]) == 25


def test_seed_cli_works_outside_repository(tmp_path: Path) -> None:
    script = Path(__file__).resolve().parents[1] / "scripts" / "seed_slices.py"
    result = subprocess.run(
        [sys.executable, str(script), "--output-dir", str(tmp_path / "output")],
        cwd=tmp_path, capture_output=True, text=True, check=True,
    )
    assert "Generated 5 synthetic scientific datasets" in result.stdout
    assert len(list((tmp_path / "output").glob("*.json"))) == 5
