"""Read contracts and browser timestamp formats used by the actual frontend."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import event

from app.core.security import owner_access_message


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
