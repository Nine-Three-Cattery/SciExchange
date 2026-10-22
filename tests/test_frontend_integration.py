"""Read contracts and browser timestamp formats used by the actual frontend."""

from datetime import datetime, timedelta, timezone
import copy
import hashlib

import pytest
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.security import canonical_json, owner_access_message
from app.models.models import DataSlice
from app.services.slice_service import read_document


def _browser_numbers(value):
    if isinstance(value, dict):
        return {key: _browser_numbers(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_browser_numbers(item) for item in value]
    if type(value) is float and value.is_integer():
        return int(value)
    return value


def test_browser_number_spellings_reuse_original_document_and_attestation(client, documents, pi_keys):
    identifier = "slice_oer_valid"
    with Session(client.app.state.engine) as session:
        row = session.get(DataSlice, identifier)
        stored = read_document(row, client.app.state.cipher)
        encrypted_before = row.encrypted_payload
    browser_document = _browser_numbers(documents[identifier])
    assert canonical_json(browser_document) != canonical_json(stored)
    response = client.post("/api/v1/compiler/verify", json=browser_document)
    assert response.status_code == 200, response.text
    report = response.json()["data"]
    assert report["valid"] is True
    assert report["merkle_root"] == hashlib.sha256(canonical_json(stored).encode()).hexdigest()
    expiry = (datetime.now(timezone.utc) + timedelta(minutes=4)).isoformat()
    address = "lab_catalysis"
    headers = {"X-PI-Address": address, "X-PI-Expires-At": expiry,
               "X-PI-Signature": pi_keys[address].sign(
                   owner_access_message(identifier, address, expiry).encode()).hex()}
    delivered = client.get(f"/api/v1/slices/{identifier}/download?format=json", headers=headers)
    assert delivered.status_code == 200
    assert canonical_json(delivered.json()) == canonical_json(stored)
    with Session(client.app.state.engine) as session:
        assert session.get(DataSlice, identifier).encrypted_payload == encrypted_before
    repeated = client.post("/api/v1/compiler/verify", json=documents[identifier]).json()["data"]
    assert repeated["attestation_uid"] == report["attestation_uid"]
    assert repeated["merkle_root"] == report["merkle_root"]


@pytest.mark.parametrize("field,value", [("accepts_barter", 1), ("temperature_c", "25"), ("temperature_c", 26)])
def test_browser_resubmission_still_rejects_type_or_measurement_changes(client, documents, field, value):
    identifier = "slice_oer_valid"
    original = client.post("/api/v1/compiler/verify", json={"slice_id": identifier}).json()["data"]
    with Session(client.app.state.engine) as session:
        encrypted_before = session.get(DataSlice, identifier).encrypted_payload
    changed = copy.deepcopy(documents[identifier])
    changed["metadata"][field] = value
    response = client.post("/api/v1/compiler/verify", json=changed)
    assert response.status_code == 409
    with Session(client.app.state.engine) as session:
        assert session.get(DataSlice, identifier).encrypted_payload == encrypted_before
    assert client.get(f"/api/v1/slices/{identifier}/attestation").json()["data"] == original


def test_attestation_read_has_no_write_and_returns_the_issued_report(client):
    identifier = "slice_oer_valid"
    url = f"/api/v1/slices/{identifier}/attestation"
    assert client.get(url).status_code == 400
    report = client.post("/api/v1/compiler/verify", json={"slice_id": identifier}).json()["data"]
    statements = []

    def capture(_connection, _cursor, statement, _parameters, _context, _many):
        statements.append(statement.lstrip().upper())

    event.listen(client.app.state.engine, "before_cursor_execute", capture)
    try:
        response = client.get(url)
    finally:
        event.remove(client.app.state.engine, "before_cursor_execute", capture)
    assert response.status_code == 200
    assert response.json()["data"] == report
    assert not any(statement.startswith(("INSERT", "UPDATE", "DELETE")) for statement in statements)
    assert "rows" not in response.json()["data"]
    assert client.get("/api/v1/slices/missing/attestation").status_code == 404
    assert client.get("/api/v1/slices/slice_cwc_poison/attestation").status_code == 403


def test_browser_z_timestamp_preserves_exact_signed_owner_message(client, pi_keys):
    expiry = (datetime.now(timezone.utc) + timedelta(minutes=4)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    address = "lab_catalysis"
    message = owner_access_message("slice_oer_valid", address, expiry)
    headers = {"X-PI-Address": address, "X-PI-Expires-At": expiry,
               "X-PI-Signature": pi_keys[address].sign(message.encode()).hex()}
    assert client.get("/api/v1/slices/slice_oer_valid/download", headers=headers).status_code == 200
    # An equivalent parsed time has different signed bytes, so cannot replace the header.
    headers["X-PI-Expires-At"] = expiry.replace("Z", "+00:00")
    assert client.get("/api/v1/slices/slice_oer_valid/download", headers=headers).status_code == 402
