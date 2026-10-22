"""Signed, single-use vault operations and indexed local download entitlements."""

from datetime import datetime, timedelta, timezone
import json
import secrets
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import utc_now, vault_message, verify_signature
from app.models.models import DownloadGrant, VaultChallenge, VaultLiquidity
from app.models.schemas import CreditRedemptionRequest, VaultChallengeRequest, VaultDepositRequest
from app.services.slice_service import get_slice, verified_attestation


def balance(session: Session, address: str) -> int:
    return int(session.scalar(select(func.coalesce(func.sum(VaultLiquidity.remaining_scicredit), 0)).where(
        VaultLiquidity.staker_address == address)) or 0)


def create_challenge(session: Session, request: VaultChallengeRequest, keys: dict[str, str]) -> dict[str, Any]:
    if request.staker_address not in keys:
        raise HTTPException(403, "The signer has no registered PI public key")
    row = get_slice(session, request.slice_id)
    attestation = verified_attestation(session, row)
    if request.action == "deposit" and row.owner_lab_id != request.staker_address:
        raise HTTPException(403, "Only the owning PI can deposit this slice")
    timestamp = utc_now()
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    nonce = secrets.token_hex(32)
    message = vault_message(request.action, row.slice_id, request.staker_address,
                            attestation.merkle_root, row.price_scicredit if request.action == "redeem" else None,
                            nonce=nonce, timestamp=timestamp, expires_at=expires_at)
    session.add(VaultChallenge(nonce=nonce, action=request.action, slice_id=row.slice_id,
                              staker_address=request.staker_address, canonical_message=message,
                              expires_at=expires_at, consumed=False))
    session.flush()
    return {"nonce": nonce, "timestamp": timestamp, "expires_at": expires_at, "canonical_message": message}


def consume_challenge(session: Session, request: VaultDepositRequest | CreditRedemptionRequest,
                      action: str, root: str, price: int | None, keys: dict[str, str]) -> None:
    challenge = session.get(VaultChallenge, request.nonce)
    if challenge is None or challenge.consumed:
        raise HTTPException(403, "The vault challenge is unknown or already consumed")
    if (challenge.action, challenge.slice_id, challenge.staker_address) != (
        action, request.slice_id, request.staker_address
    ):
        raise HTTPException(403, "The vault challenge does not authorize this operation")
    if datetime.fromisoformat(challenge.expires_at) <= datetime.now(timezone.utc):
        raise HTTPException(403, "The vault challenge has expired")
    signed = json.loads(challenge.canonical_message)
    if signed["content_sha256"] != root or signed.get("price_scicredit") != price:
        raise HTTPException(409, "The vault challenge no longer matches the slice or price")
    verify_signature(keys, request.staker_address, request.signature, challenge.canonical_message)
    # The dependency commits this consumption and accounting changes together.
    challenge.consumed = True


def deposit(session: Session, request: VaultDepositRequest, keys: dict[str, str]) -> dict[str, Any]:
    row = get_slice(session, request.slice_id)
    attestation = verified_attestation(session, row)
    if row.owner_lab_id != request.staker_address:
        raise HTTPException(403, "Only the owning PI can deposit this slice")
    if row.data_classification != "dark_matter_failure" or row.metadata_json.get("outcome") != "failed":
        raise HTTPException(400, "The vault accepts documented failed experiments")
    consume_challenge(session, request, "deposit", attestation.merkle_root, None, keys)
    existing = session.scalar(select(VaultLiquidity).where(VaultLiquidity.slice_id == row.slice_id))
    if existing is None:
        existing = VaultLiquidity(deposit_id=f"deposit_{uuid4().hex}", slice_id=row.slice_id,
                                  staker_address=request.staker_address, minted_scicredit=50,
                                  remaining_scicredit=50, redemptions={}, created_at=utc_now())
        session.add(existing)
    session.flush()
    return {"deposit_id": existing.deposit_id, "slice_id": row.slice_id,
            "minted_scicredit": existing.minted_scicredit,
            "staker_balance": balance(session, request.staker_address),
            "vault_pool_total_slices": session.scalar(select(func.count()).select_from(VaultLiquidity)),
            "credit_policy": "50 local SciCredit per unique verified failed-experiment slice"}


def redeem(session: Session, request: CreditRedemptionRequest, keys: dict[str, str]) -> dict[str, Any]:
    row = get_slice(session, request.slice_id)
    attestation = verified_attestation(session, row)
    consume_challenge(session, request, "redeem", attestation.merkle_root, row.price_scicredit, keys)
    grant = session.scalar(select(DownloadGrant).where(
        DownloadGrant.grantee_address == request.staker_address, DownloadGrant.slice_id == row.slice_id))
    if grant is None:
        if balance(session, request.staker_address) < row.price_scicredit:
            raise HTTPException(402, "Insufficient SciCredit balance")
        remaining = row.price_scicredit
        deposits = session.scalars(select(VaultLiquidity).where(
            VaultLiquidity.staker_address == request.staker_address,
            VaultLiquidity.remaining_scicredit > 0).order_by(VaultLiquidity.created_at))
        for entry in deposits:
            used = min(entry.remaining_scicredit, remaining)
            entry.remaining_scicredit -= used
            remaining -= used
            if remaining == 0:
                break
        grant = DownloadGrant(token=secrets.token_urlsafe(32), slice_id=row.slice_id,
                              grantee_address=request.staker_address,
                              expires_at=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat())
        session.add(grant)
    elif grant.expires_at is not None and datetime.fromisoformat(grant.expires_at) <= datetime.now(timezone.utc):
        # A paid entitlement survives token expiry. Fresh PI approval renews it without another debit.
        grant.token = secrets.token_urlsafe(32)
        grant.expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    session.flush()
    return {"slice_id": row.slice_id, "download_token": grant.token, "expires_at": grant.expires_at,
            "staker_balance": balance(session, request.staker_address)}


def import_legacy_grants(session: Session) -> None:
    """Move existing v4 local JSON grants once; keep balances and tokens intact."""
    for deposit_row in session.scalars(select(VaultLiquidity).where(VaultLiquidity.redemptions != {})):
        for slice_id, token in deposit_row.redemptions.items():
            existing = session.scalar(select(DownloadGrant).where(
                DownloadGrant.grantee_address == deposit_row.staker_address,
                DownloadGrant.slice_id == slice_id))
            if existing is None:
                session.add(DownloadGrant(token=token, slice_id=slice_id,
                                          grantee_address=deposit_row.staker_address, expires_at=None))
        deposit_row.redemptions = {}
    session.commit()
