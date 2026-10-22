"""The offline regeneration path must not re-label modified caches as source data."""
import importlib.util
from pathlib import Path
import shutil

import numpy as np
import pytest


ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def preparation():
    spec = importlib.util.spec_from_file_location("prepare_science_data", ROOT/"backend/scripts/prepare_science_data.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def verified_arrays():
    # The checked-in complete source extracts are sufficient; never rely on a
    # developer's ignored cache or the availability of the remote data service.
    source = ROOT/"data/slices/sources"
    summary = np.loadtxt(source/"severson_b1c5_summary.csv", delimiter=",", skiprows=1)
    arrays = dict(zip(("cycle", "QDischarge", "QCharge", "Tavg"), summary.T))
    for cycle in (10, 50, 100):
        voltage, capacity = np.loadtxt(source/f"severson_b1c5_qdlin_{cycle}.csv",
                                       delimiter=",", skiprows=1).T
        arrays["Vdlin"] = voltage
        arrays[f"Qdlin_{cycle}"] = capacity
    return arrays


def populate_cache(directory, arrays):
    directory.mkdir()
    for name in ("Figure 3.csv", "Figure 4.csv"):
        shutil.copy2(ROOT/"data/slices/sources"/name, directory/name)
    np.savez(directory/"severson_b1c5.npz", **arrays)
    return directory


def test_canonical_digest_ignores_archive_format_and_unused_arrays(preparation, verified_arrays, tmp_path):
    one, two = tmp_path/"one.npz", tmp_path/"two.npz"
    np.savez(one, **verified_arrays)
    np.savez_compressed(two, unused=np.array([999.]), **dict(reversed(list(verified_arrays.items()))))
    assert one.read_bytes() != two.read_bytes()
    loaded = [preparation.load_battery_cache(path) for path in (one, two)]
    assert tuple(loaded[0]) == preparation.BATTERY_ARRAY_KEYS
    for key in preparation.BATTERY_ARRAY_KEYS:
        assert np.array_equal(loaded[0][key], loaded[1][key])


def test_modified_capacity_cache_is_rejected_before_output(preparation, verified_arrays, tmp_path):
    verified_arrays["QDischarge"] *= 2
    cache = populate_cache(tmp_path/"cache", verified_arrays)
    with pytest.raises(ValueError, match="checksum mismatch"):
        preparation.build(cache, tmp_path/"output")
    assert not (tmp_path/"output").exists()
    # --fetch must not silently bless an existing modified extraction either.
    with pytest.raises(ValueError, match="checksum mismatch"):
        preparation.fetch(cache)


@pytest.mark.parametrize("case", ["missing", "shape", "cycle", "nonfinite"])
def test_invalid_extraction_schema_is_rejected(preparation, verified_arrays, case):
    if case == "missing":
        del verified_arrays["Qdlin_50"]
    elif case == "shape":
        verified_arrays["Qdlin_10"] = verified_arrays["Qdlin_10"][:-1]
    elif case == "cycle":
        verified_arrays["cycle"][9] = 50
    else:
        verified_arrays["Tavg"][1] = np.nan
    with pytest.raises(ValueError, match="Battery extraction"):
        preparation.validate_battery_arrays(verified_arrays)


def test_digest_is_bound_to_source_policy(preparation, verified_arrays, monkeypatch):
    monkeypatch.setattr(preparation, "BATTERY_EXTRACTION",
                        preparation.BATTERY_EXTRACTION | {"charge_policy": "3.6C"})
    with pytest.raises(ValueError, match="checksum mismatch"):
        preparation.validate_battery_arrays(verified_arrays)


def test_verified_cache_rebuild_preserves_committed_data(preparation, verified_arrays, tmp_path):
    cache = populate_cache(tmp_path/"cache", verified_arrays)
    output = tmp_path/"output"
    preparation.build(cache, output)
    for path in output.rglob("*"):
        if path.is_file():
            assert path.read_bytes() == (ROOT/"data/slices"/path.relative_to(output)).read_bytes()
