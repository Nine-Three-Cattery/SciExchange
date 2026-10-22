"""Reference-electrode consistency across compilation, exchange and analysis."""

import copy

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
import pytest

from app.compiler.formal_engine import STANDARD_OER_POTENTIAL_V, nernst_potential


@pytest.mark.parametrize("reference", ["RHE", "SHE"])
def test_authorized_electrocatalysis_analysis_uses_compiler_reference_convention(
    client: TestClient, documents: dict[str, dict],
    pi_keys: dict[str, Ed25519PrivateKey], reference: str,
) -> None:
    document = copy.deepcopy(documents["slice_oer_valid"])
    slice_id = f"inline_oer_{reference.lower()}"
    document["slice_id"] = slice_id
    conditions = document["metadata"]["testing_conditions"]
    conditions["potential_reference"] = reference
    if reference == "SHE":
        voltage_index = document["columns"].index("potential_v_rhe")
        document["columns"][voltage_index] = "potential_v_she"
        shift = STANDARD_OER_POTENTIAL_V - nernst_potential(
            conditions["ph"], document["metadata"]["temperature_c"]
        )
        for sample in document["rows"]:
            sample[voltage_index] -= shift
    compiled = client.post("/api/v1/compiler/verify", json=document)
    assert compiled.status_code == 200, compiled.text
    assert compiled.json()["data"]["valid"], compiled.text
    battery = client.post("/api/v1/compiler/verify", json={"slice_id": "slice_battery_valid"})
    assert battery.status_code == 200 and battery.json()["data"]["valid"]
    proposal_response = client.post("/api/v1/barter/negotiate", json={
        "party_a_lab": "lab_catalysis", "party_a_slice_id": slice_id,
        "party_b_lab": "lab_battery", "party_b_slice_id": "slice_battery_valid",
    })
    assert proposal_response.status_code == 200, proposal_response.text
    proposal = proposal_response.json()["data"]
    analysis_request = {"slice_id": slice_id, "analysis_type": "tafel_slope"}
    assert client.post("/api/v1/analysis", json=analysis_request).status_code == 402
    for role, lab in (("pi_proposer", "lab_catalysis"), ("pi_target", "lab_battery")):
        signed = client.post("/api/v1/barter/dual-sign", json={
            "proposal_id": proposal["proposal_id"], "signer_role": role,
            "signer_address": lab,
            "signature": pi_keys[lab].sign(proposal["canonical_agreement"].encode()).hex(),
        })
        assert signed.status_code == 200, signed.text
    token = signed.json()["data"]["download_token"]
    headers = {"Authorization": f"Bearer {token}"}
    fitted = client.post("/api/v1/analysis", json=analysis_request, headers=headers)
    assert fitted.status_code == 200, fitted.text
    result = fitted.json()["data"]["result"]
    assert result["overpotential_10ma_mv"] == pytest.approx(240.0, abs=0.1)
    assert result["tafel_slope_mv_dec"] == pytest.approx(42.5, abs=0.1)
    assert result["potential_10ma_v"] == pytest.approx(1.469, abs=0.0001)
    differentiated = client.post(
        "/api/v1/analysis", json={"slice_id": slice_id, "analysis_type": "dta"}, headers=headers,
    )
    assert differentiated.status_code == 200, differentiated.text
    dta = differentiated.json()["data"]["result"]
    assert dta["kinetic_consistent"]
    assert dta["tafel_slope_mv_dec"] == pytest.approx(42.5, abs=0.5)
    assert min(dta["voltage_v"]) == pytest.approx(1.2)
    assert max(dta["voltage_v"]) == pytest.approx(1.7)
