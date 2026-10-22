import copy
import json

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.api.analysis import create_router
from app.api.compiler import router
from app.api.science_route import MAX_JSON_BYTES
from app.services.physics_compiler import verify
from app.services.domain_analytics import ScienceError, analyze


@pytest.fixture
def science_client():
    app = FastAPI()
    app.include_router(router)
    app.include_router(create_router())
    return TestClient(app, raise_server_exceptions=False)


@pytest.mark.parametrize("endpoint", ["compiler/verify", "analysis/battery"])
@pytest.mark.parametrize("body", [
    '{"slice_id": NaN}', '{"slice_id": 1e999}', '{"slice_id": "\\ud800"}',
    '[NaN]', '{"metadata":{"notes":"\\udfff"}}', '{bad json}',
])
def test_unserializable_json_never_reaches_error_renderer(science_client, endpoint, body):
    response = science_client.post(f"/api/v1/{endpoint}", content=body, headers={"content-type": "application/json"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Request must be finite UTF-8 JSON"


def test_http_size_and_media_type_limits(science_client):
    assert science_client.post("/api/v1/compiler/verify", content=b" "*(MAX_JSON_BYTES+1),
                               headers={"content-type": "application/json"}).status_code == 413
    assert science_client.post("/api/v1/compiler/verify", content="{}",
                               headers={"content-type": "text/plain"}).status_code == 415


@pytest.mark.parametrize("value", [float("nan"), {}, [], "\ud800", "x"*121])
def test_failed_report_does_not_echo_invalid_identity(tafel_slice, value):
    tafel_slice["slice_id"] = value
    report = verify(tafel_slice)
    assert report["blocking_failure"]
    assert report["slice_id"] is None
    json.dumps(report, ensure_ascii=False, allow_nan=False).encode("utf-8")


def test_invalid_unicode_in_metadata_is_rejected_offline(tafel_slice):
    tafel_slice["metadata"]["notes"] = "\ud800"
    report = verify(tafel_slice)
    assert report["blocking_failure"]
    assert report["safe_metadata"] == {}


def test_declared_bidirectional_sweep_requires_selection(real_slices):
    sample = copy.deepcopy(real_slices["catalysis_nifec_lsv"])
    assert sample["metadata"]["measurement_type"] == "potential_sweep_with_return"
    with pytest.raises(ScienceError, match="single sweep branch"):
        analyze(sample, "tafel_slope", {"current_min": 0.3, "current_max": 10})


def test_knee_is_stable_under_cycle_coordinate_scaling(capacity_slice):
    ordinary = analyze(capacity_slice, "knee_point")
    for row in capacity_slice["rows"]:
        row[0] *= 10**10
    scaled = analyze(capacity_slice, "knee_point")
    assert scaled["knee_point_cycle_estimated"] == ordinary["knee_point_cycle_estimated"]*10**10
    assert scaled["bic_gain"] == pytest.approx(ordinary["bic_gain"])


def test_extreme_capacity_ratio_fails_with_explicit_numeric_error(capacity_slice):
    capacity_slice["rows"][0][1] = 1e-308
    capacity_slice["rows"][1][1] = 1e308
    with pytest.raises(ScienceError) as error:
        analyze(capacity_slice, "knee_point")
    assert error.value.code == "numerical_failure"


def test_cycle_indices_outside_exact_json_numeric_range_fail(capacity_slice):
    for row in capacity_slice["rows"]:
        row[0] *= 10**15
    assert verify(capacity_slice)["blocking_failure"]


def test_finite_fe_inputs_with_overflowing_residual_return_report(science_client, tafel_slice):
    tafel_slice["metadata"].update(product_moles=1e300, charge_coulombs=1,
                                   electron_transfer_number=4, faradaic_efficiency_pct=-1.7e308)
    response = science_client.post("/api/v1/compiler/verify", json=tafel_slice)
    assert response.status_code == 200
    report = response.json()["data"]
    assert report["blocking_failure"]
    assert "FE consistency residual exceeds finite numeric range" in report["diagnostic_log"]


def test_empty_column_name_rejected(tafel_slice):
    tafel_slice["columns"].append("")
    for row in tafel_slice["rows"]:
        row.append(0)
    assert verify(tafel_slice)["blocking_failure"]
