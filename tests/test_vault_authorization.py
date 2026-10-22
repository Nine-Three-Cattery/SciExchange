"""Vault signatures authorize one operation; entitlements survive safe retries."""

import copy
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.main import create_app
from app.models.models import DownloadGrant, VaultChallenge, VaultLiquidity

OER = "slice_oer_valid"
BATTERY = "slice_battery_valid"
DARK = "slice_dark_reaction"
LAB = "lab_synthesis"


def _verify(client: TestClient, slice_id: str) -> dict:
    response = client.post("/api/v1/compiler/verify", json={"slice_id": slice_id})
    assert response.status_code == 200, response.text
    report = response.json()["data"]
    assert report["valid"], report
    return report


def _signed_operation(client: TestClient, keys: dict[str, Ed25519PrivateKey], action: str,
                      slice_id: str, address: str = LAB) -> dict:
    response = client.post("/api/v1/vault/challenge", json={
        "action": action, "slice_id": slice_id, "staker_address": address,
    })
    assert response.status_code == 200, response.text
    challenge = response.json()["data"]
    message = json.loads(challenge["canonical_message"])
    assert message["action"] == action
    assert message["slice_id"] == slice_id
    assert message["staker_address"] == address
    assert message["nonce"] == challenge["nonce"]
    assert message["timestamp"] == challenge["timestamp"]
    assert message["expires_at"] == challenge["expires_at"]
    assert datetime.fromisoformat(challenge["expires_at"]) > datetime.fromisoformat(challenge["timestamp"])
    return {"slice_id": slice_id, "staker_address": address, "nonce": challenge["nonce"],
            "signature": keys[address].sign(challenge["canonical_message"].encode()).hex()}


def _submit(client: TestClient, action: str, payload: dict) -> dict:
    response = client.post(f"/api/v1/vault/{action}", json=payload)
    assert response.status_code == 200, response.text
    return response.json()["data"]


def _deposit(client: TestClient, keys: dict[str, Ed25519PrivateKey]) -> dict:
    _verify(client, DARK)
    return _submit(client, "deposit", _signed_operation(client, keys, "deposit", DARK))


def _balance(client: TestClient, address: str = LAB) -> int:
    response = client.get("/api/v1/vault/balance", params={"address": address})
    assert response.status_code == 200
    return response.json()["data"]["staker_balance"]


def _download(client: TestClient, slice_id: str, token: str):
    return client.get(f"/api/v1/slices/{slice_id}/download", headers={"Authorization": f"Bearer {token}"})


@pytest.mark.parametrize("action,slice_id", [("deposit", DARK), ("redeem", OER)])
def test_vault_challenge_is_single_use_even_when_operation_is_idempotent(client, pi_keys, action, slice_id):
    _verify(client, slice_id)
    if action == "redeem":
        _deposit(client, pi_keys)
    payload = _signed_operation(client, pi_keys, action, slice_id)
    first = _submit(client, action, payload)
    balance_after_first = _balance(client)
    assert client.post(f"/api/v1/vault/{action}", json=payload).status_code == 403
    assert _balance(client) == balance_after_first
    with Session(client.app.state.engine) as session:
        assert session.get(VaultChallenge, payload["nonce"]).consumed is True
    fresh = _signed_operation(client, pi_keys, action, slice_id)
    assert fresh["nonce"] != payload["nonce"]
    repeated = _submit(client, action, fresh)
    assert _balance(client) == balance_after_first
    if action == "deposit":
        assert repeated["deposit_id"] == first["deposit_id"]
        assert repeated["vault_pool_total_slices"] == 1
    else:
        assert repeated["download_token"] == first["download_token"]


def test_expired_challenge_is_rejected_without_credit_changes(client, pi_keys):
    _verify(client, DARK)
    payload = _signed_operation(client, pi_keys, "deposit", DARK)
    with Session(client.app.state.engine) as session:
        challenge = session.get(VaultChallenge, payload["nonce"])
        challenge.expires_at = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        session.commit()
    response = client.post("/api/v1/vault/deposit", json=payload)
    assert response.status_code == 403
    assert _balance(client) == 0


@pytest.mark.parametrize("mismatch", ["action", "slice", "address"])
def test_challenge_is_bound_to_operation_slice_and_pi(client, pi_keys, mismatch):
    _deposit(client, pi_keys)
    _verify(client, OER)
    _verify(client, BATTERY)
    original = _signed_operation(client, pi_keys, "redeem", OER)
    body = dict(original)
    endpoint = "redeem"
    if mismatch == "action":
        # A deposit challenge has a valid dark-data target for either endpoint.
        original = _signed_operation(client, pi_keys, "deposit", DARK)
        body = dict(original)
    elif mismatch == "slice":
        body["slice_id"] = BATTERY
    else:
        body["staker_address"] = "lab_battery"
    assert client.post(f"/api/v1/vault/{endpoint}", json=body).status_code == 403
    assert _balance(client) == 50
    with Session(client.app.state.engine) as session:
        assert session.get(VaultChallenge, original["nonce"]).consumed is False


def test_invalid_signature_does_not_consume_challenge(client, pi_keys):
    _verify(client, DARK)
    payload = _signed_operation(client, pi_keys, "deposit", DARK)
    invalid = {**payload, "signature": "00" * 64}
    assert client.post("/api/v1/vault/deposit", json=invalid).status_code == 403
    with Session(client.app.state.engine) as session:
        assert session.get(VaultChallenge, payload["nonce"]).consumed is False
    assert _submit(client, "deposit", payload)["staker_balance"] == 50


def test_accounting_failure_rolls_back_challenge_consumption(client, pi_keys):
    _verify(client, OER)
    payload = _signed_operation(client, pi_keys, "redeem", OER)
    assert client.post("/api/v1/vault/redeem", json=payload).status_code == 402
    with Session(client.app.state.engine) as session:
        assert session.get(VaultChallenge, payload["nonce"]).consumed is False
        assert session.scalar(select(DownloadGrant)) is None
    _deposit(client, pi_keys)
    result = _submit(client, "redeem", payload)
    assert result["staker_balance"] == 0
    assert _download(client, OER, result["download_token"]).status_code == 200


def test_challenge_from_another_database_is_unknown_even_with_same_pi_keys(
    client, pi_keys, settings: Settings, tmp_path: Path,
):
    _verify(client, DARK)
    payload = _signed_operation(client, pi_keys, "deposit", DARK)
    other_settings = replace(settings, state_dir=tmp_path / "other_state",
                             database_url=f"sqlite:///{tmp_path / 'other_gateway.sqlite'}")
    with TestClient(create_app(other_settings)) as other:
        _verify(other, DARK)
        assert other.post("/api/v1/vault/deposit", json=payload).status_code == 403
        assert _balance(other) == 0
    assert _submit(client, "deposit", payload)["staker_balance"] == 50


def test_configured_twenty_credit_price_is_quoted_and_debited(client, pi_keys, documents):
    _deposit(client, pi_keys)
    document = copy.deepcopy(documents[OER])
    document["slice_id"] = "slice_oer_twenty_credit"
    document["metadata"]["price_scicredit"] = 20
    response = client.post("/api/v1/compiler/verify", json=document)
    assert response.status_code == 200, response.text
    assert response.json()["data"]["valid"] is True
    catalog = client.get("/api/v1/slices").json()["data"]
    assert next(item for item in catalog if item["slice_id"] == document["slice_id"])["price_scicredit"] == 20
    challenge_response = client.post("/api/v1/vault/challenge", json={
        "action": "redeem", "slice_id": document["slice_id"], "staker_address": LAB,
    })
    assert challenge_response.status_code == 200
    challenge = challenge_response.json()["data"]
    assert json.loads(challenge["canonical_message"])["price_scicredit"] == 20
    payload = {"slice_id": document["slice_id"], "staker_address": LAB, "nonce": challenge["nonce"],
               "signature": pi_keys[LAB].sign(challenge["canonical_message"].encode()).hex()}
    result = _submit(client, "redeem", payload)
    assert result["staker_balance"] == 30
    assert _balance(client) == 30
    assert _download(client, document["slice_id"], result["download_token"]).status_code == 200


def test_zero_price_redemption_does_not_require_a_deposit_record(client, pi_keys, documents):
    document = copy.deepcopy(documents[OER])
    document["slice_id"] = "slice_oer_free"
    document["metadata"]["price_scicredit"] = 0
    response = client.post("/api/v1/compiler/verify", json=document)
    assert response.status_code == 200, response.text
    result = _submit(client, "redeem", _signed_operation(client, pi_keys, "redeem", document["slice_id"]))
    assert result["staker_balance"] == 0
    with Session(client.app.state.engine) as session:
        assert session.scalar(select(VaultLiquidity)) is None
    assert _download(client, document["slice_id"], result["download_token"]).status_code == 200


def test_expired_paid_grant_is_renewed_with_fresh_pi_approval_without_double_debit(client, pi_keys):
    _deposit(client, pi_keys)
    _verify(client, OER)
    first = _submit(client, "redeem", _signed_operation(client, pi_keys, "redeem", OER))
    old_token = first["download_token"]
    with Session(client.app.state.engine) as session:
        grant = session.get(DownloadGrant, old_token)
        grant.expires_at = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        session.commit()
    assert _download(client, OER, old_token).status_code == 402
    renewed = _submit(client, "redeem", _signed_operation(client, pi_keys, "redeem", OER))
    assert renewed["download_token"] != old_token
    assert renewed["staker_balance"] == 0
    assert _download(client, OER, old_token).status_code == 402
    assert _download(client, OER, renewed["download_token"]).status_code == 200


def test_download_uses_indexed_grant_lookup_without_reading_vault_records(client, pi_keys):
    _deposit(client, pi_keys)
    _verify(client, OER)
    token = _submit(client, "redeem", _signed_operation(client, pi_keys, "redeem", OER))["download_token"]
    statements = []

    def record_statement(_connection, _cursor, statement, _parameters, _context, _many):
        statements.append(statement.lower())

    event.listen(client.app.state.engine, "before_cursor_execute", record_statement)
    try:
        response = _download(client, OER, token)
    finally:
        event.remove(client.app.state.engine, "before_cursor_execute", record_statement)
    assert response.status_code == 200
    assert not any("vault_liquidity" in statement for statement in statements)
    assert any("download_grants" in statement and "where" in statement and "token =" in statement
               and "slice_id =" in statement for statement in statements)


def test_restart_imports_legacy_grants_without_losing_balance_or_tokens(client, settings: Settings):
    _verify(client, DARK)
    _verify(client, OER)
    legacy_token = "legacy-local-download-token"
    with Session(client.app.state.engine) as session:
        session.add(VaultLiquidity(deposit_id="legacy_deposit", slice_id=DARK, staker_address=LAB,
                                  minted_scicredit=50, remaining_scicredit=30,
                                  redemptions={OER: legacy_token}, created_at=datetime.now(timezone.utc).isoformat()))
        session.commit()
    with TestClient(create_app(settings)) as restarted:
        assert _balance(restarted) == 30
        assert _download(restarted, OER, legacy_token).status_code == 200
        with Session(restarted.app.state.engine) as session:
            assert session.get(VaultLiquidity, "legacy_deposit").redemptions == {}
            grant = session.get(DownloadGrant, legacy_token)
            assert grant.grantee_address == LAB
            assert grant.slice_id == OER
    with TestClient(create_app(settings)) as second_restart:
        assert _balance(second_restart) == 30
        assert _download(second_restart, OER, legacy_token).status_code == 200
