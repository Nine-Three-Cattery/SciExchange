"""Real attributed inputs through persistence, PI admission and authorized exchange."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import shutil

from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from fastapi import HTTPException
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import canonical_json, load_cipher, owner_access_message
from app.database import Base, make_engine
from app.main import create_app
from app.models.models import AttestationRecord, DataSlice, ScienceAdmission, ScienceRecord
from app.services.domain_analytics import input_hash
from app.services.science_io import load_slices
from app.services.slice_service import import_slices, read_document

ROOT = Path(__file__).resolve().parents[1]
TAFEL, BATTERY, CURVE = "catalysis_nifec_tafel", "battery_b1c5_early", "battery_b1c5_cycle_10"


@pytest.fixture
def science_settings(tmp_path, pi_keys):
    return Settings(state_dir=tmp_path / "state", data_dir=ROOT / "data/slices",
                    database_url=f"sqlite:///{tmp_path / 'science.sqlite'}",
                    pi_public_keys={lab: key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw).hex()
                                    for lab, key in pi_keys.items()})


@pytest.fixture
def science_client(science_settings):
    with TestClient(create_app(science_settings)) as client:
        yield client


def review_body(client, keys, identifier, owner):
    response = client.post("/api/v1/compiler/review-challenge", json={"slice_id": identifier, "version": "1"})
    assert response.status_code == 200, response.text
    challenge = response.json()["data"]
    return {"slice_id": identifier, "version": "1", "signer_address": owner,
            "expires_at": challenge["expires_at"],
            "signature": keys[owner].sign(challenge["canonical_message"].encode()).hex()}


def admit(client, keys, identifier=TAFEL, owner="lab_catalysis"):
    response = client.post("/api/v1/compiler/review", json=review_body(client, keys, identifier, owner))
    assert response.status_code == 200, response.text
    return response.json()["data"]


def owner_headers(keys, identifier, owner):
    expiry = (datetime.now(timezone.utc) + timedelta(minutes=4)).isoformat()
    return {"X-PI-Address": owner, "X-PI-Expires-At": expiry,
            "X-PI-Signature": keys[owner].sign(owner_access_message(identifier, owner, expiry).encode()).hex()}


def test_manifest_import_preserves_originals_and_independent_review_state(science_client):
    expected = load_slices(ROOT / "data/slices")
    with Session(science_client.app.state.engine) as session:
        assert session.scalar(select(func.count()).select_from(ScienceRecord)) == 8
        for identifier, payload in expected.items():
            row = session.get(DataSlice, identifier)
            record = session.get(ScienceRecord, identifier)
            assert read_document(row, science_client.app.state.cipher) == payload
            assert record.input_sha256 == input_hash(payload)
            assert record.version == "1"
            assert not row.is_attested
            assert row.quarantined == (identifier == "synthetic_fault_injection")
        original = read_document(session.get(DataSlice, TAFEL), science_client.app.state.cipher)
        assert original["metadata"]["temperature_c"] is None
        assert original["metadata"]["license"] == "CC-BY-4.0"
        assert "owner_lab_id" not in original["metadata"]
    catalog = {item["slice_id"]: item for item in science_client.get("/api/v1/slices").json()["data"]}
    assert catalog[TAFEL]["compiler_status"] == "REVIEW_REQUIRED"
    assert catalog[TAFEL]["review_status"] == "pending"
    assert catalog[BATTERY]["analysis_methods"] == ["capacity_fade", "knee_point"]
    assert catalog[CURVE]["analysis_methods"] == ["dq_dv"]
    assert "synthetic_fault_injection" not in catalog


def test_signed_admission_is_idempotent_and_not_a_scientific_pass(science_client, pi_keys):
    body = review_body(science_client, pi_keys, TAFEL, "lab_catalysis")
    first = science_client.post("/api/v1/compiler/review", json=body).json()["data"]
    again = science_client.post("/api/v1/compiler/review", json=body).json()["data"]
    assert first == again
    assert first["is_attested"] and first["review_status"] == "approved"
    assert first["compiler_status"] == "REVIEW_REQUIRED" and first["valid"] is False
    assert first["formal_proof"] is False
    assert first["proof_of_priority"]["attribution_policy"] == "CC-BY-4.0"
    approval = first["admission"]
    pi_keys["lab_catalysis"].public_key().verify(bytes.fromhex(approval["signature"]), approval["canonical_message"].encode())
    with Session(science_client.app.state.engine) as session:
        assert session.scalar(select(func.count()).select_from(ScienceAdmission)) == 1
        record = session.get(ScienceRecord, TAFEL)
        assert approval["report_sha256"] == input_hash(record.report)
    checked = science_client.post("/api/v1/compiler/verify", json={"slice_id": TAFEL, "version": "1"}).json()["data"]
    assert checked["is_attested"] and checked["attestation_uid"] == first["attestation_uid"]


def test_rule_update_revokes_admission_and_preserves_signed_history(science_client, pi_keys, monkeypatch):
    from app.services import physics_compiler, science_gateway

    first = admit(science_client, pi_keys)
    stale_signature = review_body(science_client, pi_keys, TAFEL, "lab_catalysis")
    monkeypatch.setattr(physics_compiler, "RULE_VERSION", "science-rules-next")
    monkeypatch.setattr(science_gateway, "RULE_VERSION", "science-rules-next")
    # Even before rechecking, a previous rule version cannot authorize analysis.
    headers = owner_headers(pi_keys, TAFEL, "lab_catalysis")
    request = {"slice_id": TAFEL, "version": "1", "analysis_type": "tafel_slope"}
    assert science_client.post("/api/v1/analysis", json=request, headers=headers).status_code == 409
    checked = science_client.post("/api/v1/compiler/verify", json={"slice_id": TAFEL, "version": "1"}).json()["data"]
    assert checked["review_status"] == "pending" and not checked["is_attested"]
    assert checked["attestation_uid"] is None
    assert science_client.post("/api/v1/compiler/review", json=stale_signature).status_code == 403
    with Session(science_client.app.state.engine) as session:
        assert session.scalar(select(func.count()).select_from(ScienceAdmission)) == 1
        assert session.get(AttestationRecord, first["attestation_uid"]) is None
    second = admit(science_client, pi_keys)
    assert second["admission"]["rule_version"] == "science-rules-next"
    assert second["attestation_uid"] != first["attestation_uid"]
    with Session(science_client.app.state.engine) as session:
        history = session.scalars(select(ScienceAdmission).where(ScienceAdmission.slice_id == TAFEL)).all()
        assert len(history) == 2
        assert {entry.report_sha256 for entry in history} == {
            first["admission"]["report_sha256"], second["admission"]["report_sha256"]}
        for entry in history:
            assert input_hash(entry.report) == entry.report_sha256
            pi_keys["lab_catalysis"].public_key().verify(bytes.fromhex(entry.signature), entry.canonical_message.encode())


@pytest.mark.parametrize("change,expected", [
    ({"signer_address": "lab_battery"}, 403), ({"signature": "00" * 64}, 403),
    ({"expires_at": "2000-01-01T00:00:00+00:00"}, 403),
    ({"expires_at": "not-a-date"}, 403), ({"version": "2"}, 409),
])
def test_invalid_pi_approvals_never_grant_access(science_client, pi_keys, change, expected):
    body = review_body(science_client, pi_keys, TAFEL, "lab_catalysis")
    body.update(change)
    assert science_client.post("/api/v1/compiler/review", json=body).status_code == expected
    with Session(science_client.app.state.engine) as session:
        assert not session.get(DataSlice, TAFEL).is_attested
        assert session.scalar(select(func.count()).select_from(ScienceAdmission)) == 0


def test_quarantined_fault_cannot_be_approved_or_delivered(science_client, pi_keys):
    identifier = "synthetic_fault_injection"
    assert science_client.post("/api/v1/compiler/review-challenge", json={"slice_id": identifier, "version": "1"}).status_code == 403
    assert science_client.get(f"/api/v1/slices/{identifier}/download",
                             headers=owner_headers(pi_keys, identifier, "lab_catalysis")).status_code == 403


def test_real_data_exchange_and_analysis_share_exact_authorized_version(science_client, pi_keys):
    for identifier, owner in ((TAFEL, "lab_catalysis"), (BATTERY, "lab_battery")):
        admit(science_client, pi_keys, identifier, owner)
    proposal = science_client.post("/api/v1/barter/negotiate", json={
        "party_a_lab": "lab_catalysis", "party_a_slice_id": TAFEL,
        "party_b_lab": "lab_battery", "party_b_slice_id": BATTERY}).json()["data"]
    bodies = [{"proposal_id": proposal["proposal_id"], "signer_role": role, "signer_address": lab,
               "signature": pi_keys[lab].sign(proposal["canonical_agreement"].encode()).hex()}
              for role, lab in (("pi_proposer", "lab_catalysis"), ("pi_target", "lab_battery"))]
    first = science_client.post("/api/v1/barter/dual-sign", json=bodies[0]).json()["data"]
    assert first["status"] == "PENDING_SECOND_PI_SIGNATURE" and "download_token" not in first
    assert science_client.get(f"/api/v1/slices/{TAFEL}/download").status_code == 402
    second = science_client.post("/api/v1/barter/dual-sign", json=bodies[1]).json()["data"]
    assert second["status"] == "DUAL_SIGNED_AND_EXECUTED"
    headers = {"Authorization": f"Bearer {second['download_token']}"}
    delivered = science_client.get(f"/api/v1/slices/{TAFEL}/download?format=json&version=1", headers=headers)
    assert delivered.status_code == 200
    assert delivered.json() == load_slices(ROOT / "data/slices")[TAFEL]
    assert science_client.get(f"/api/v1/slices/{TAFEL}/download?version=2", headers=headers).status_code == 409
    assert science_client.get(f"/api/v1/slices/{BATTERY}/download", headers=headers).status_code == 402
    body = {"slice_id": TAFEL, "version": "1", "analysis_type": "tafel_slope", "parameters": {"current_min": 0.3, "current_max": 10}}
    assert science_client.post("/api/v1/analysis", json=body).status_code == 402
    analysis = science_client.post("/api/v1/analysis", json=body, headers=headers)
    assert analysis.status_code == 200, analysis.text
    result = analysis.json()["data"]["result"]
    assert result["input_sha256"] == input_hash(delivered.json())
    assert result["tafel_slope_mv_dec"] == pytest.approx(76.11055846211742)
    assert result["overpotential_at_target_mv"] is None
    assert science_client.post("/api/v1/analysis", json=body | {"version": "2"}, headers=headers).status_code == 409
    del body["version"]
    assert science_client.post("/api/v1/analysis", json=body, headers=headers).status_code == 422


def test_signed_discharge_analysis_and_integrity_check(science_client, pi_keys):
    admit(science_client, pi_keys, CURVE, "lab_battery")
    headers = owner_headers(pi_keys, CURVE, "lab_battery")
    body = {"slice_id": CURVE, "version": "1", "analysis_type": "dq_dv"}
    result = science_client.post("/api/v1/analysis", json=body, headers=headers).json()["data"]["result"]
    assert min(result["dq_dv_ah_v"]) < -1
    assert result["parameters"]["derivative_sign"] == "signed_dQ_dV"
    with Session(science_client.app.state.engine) as session:
        row = session.get(DataSlice, CURVE)
        document = read_document(row, science_client.app.state.cipher)
        document["rows"][0][1] += 1
        row.encrypted_payload = science_client.app.state.cipher.encrypt(canonical_json(document).encode())
        session.commit()
    assert science_client.post("/api/v1/analysis", json=body, headers=headers).status_code == 409
    assert science_client.get(f"/api/v1/slices/{CURVE}/download", headers=headers).status_code == 409


def test_import_and_signed_admission_survive_restart(science_settings, pi_keys):
    with TestClient(create_app(science_settings)) as client:
        approved = admit(client, pi_keys)
    with TestClient(create_app(science_settings)) as client:
        result = client.get(f"/api/v1/slices/{TAFEL}/attestation")
        assert result.status_code == 200
        assert result.json()["data"] == approved
        with Session(client.app.state.engine) as session:
            assert session.scalar(select(func.count()).select_from(ScienceRecord)) == 8


def test_new_version_cannot_replace_existing_slice(science_client, tmp_path):
    directory = tmp_path / "changed"
    shutil.copytree(ROOT / "data/slices", directory)
    path = directory / f"{TAFEL}.json"
    value = json.loads(path.read_text())
    value["version"] = "2"
    path.write_text(json.dumps(value))
    manifest = json.loads((directory / "manifest.json").read_text())
    next(item for item in manifest["entries"] if item["slice_id"] == TAFEL)["metadata_sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    (directory / "manifest.json").write_text(json.dumps(manifest))
    with Session(science_client.app.state.engine) as session:
        with pytest.raises(HTTPException) as error:
            import_slices(session, directory, science_client.app.state.cipher)
        assert error.value.status_code == 409
        assert session.get(ScienceRecord, TAFEL).version == "1"


@pytest.mark.parametrize("broken", ["csv", "late_legacy_document"])
def test_failed_import_leaves_no_partial_database(tmp_path, broken):
    directory = tmp_path / "data"
    shutil.copytree(ROOT / "data/slices", directory)
    if broken == "csv":
        (directory / f"{TAFEL}.csv").write_text("tampered")
    else:
        (directory / "zzz_invalid.json").write_text('{"not_a_slice": true}')
    engine = make_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        with pytest.raises(ValueError):
            import_slices(session, directory, load_cipher(tmp_path / "keys"))
        assert session.scalar(select(func.count()).select_from(DataSlice)) == 0
        assert session.scalar(select(func.count()).select_from(ScienceRecord)) == 0
    engine.dispose()
