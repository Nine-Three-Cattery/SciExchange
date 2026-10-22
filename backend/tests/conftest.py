from pathlib import Path

import numpy as np
import pytest

from app.services.science_io import load_slices

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def tafel_slice():
    j = np.geomspace(1, 100, 21)
    return {"slice_id": "synthetic_tafel", "version": "1", "domain": "electrocatalysis",
            "columns": ["current_density_ma_cm2", "overpotential_v"],
            "rows": np.column_stack([j, 0.2+0.0425*np.log10(j)]).tolist(),
            "metadata": {"data_origin": "synthetic", "source_url": "local:test_fixture",
                         "units": {"current_density_ma_cm2": "mA/cm2", "overpotential_v": "V"},
                         "ir_correction_applied": True}}


@pytest.fixture
def capacity_slice():
    cycles = np.arange(1, 121)
    q = 1.1-0.0001*cycles-0.002*np.maximum(cycles-80, 0)
    return {"slice_id": "synthetic_capacity", "version": "1", "domain": "battery_cycling",
            "columns": ["cycle_index", "discharge_capacity_ah"],
            "rows": np.column_stack([cycles, q]).tolist(),
            "metadata": {"data_origin": "synthetic", "source_url": "local:test_fixture",
                         "units": {"cycle_index": "1", "discharge_capacity_ah": "Ah"}}}


@pytest.fixture(scope="session")
def real_slices():
    return load_slices(ROOT/"data/slices")
