"""Local SciCredit accounting backed by unique, verified failed-experiment deposits."""

import secrets
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.security import utc_now, vault_message, verify_signature
from app.models.models import VaultLiquidity
from app.models.schemas import CreditRedemptionRequest, VaultDepositRequest
from app.services.slice_service import get_slice, verified_attestation


def balance(session: Session, address: str) -> int:
    return int(session.scalar(select(func.coalesce(func.sum(VaultLiquidity.remaining_scicredit), 0)).where(
        VaultLiquidity.staker_address == address)) or 0)


def deposit(session: Session, request: VaultDepositRequest, keys: dict[str, str]) -> dict[str, Any]:
    session.execute(text("BEGIN IMMEDIATE"))
    row = get_slice(session, request.slice_id)
    attestation = verified_attestation(session, row)
    if row.owner_lab_id != request.staker_address:
        raise HTTPException(403, "Only the owning PI can deposit this slice")
    if row.data_classification != "dark_matter_failure" or row.metadata_json.get("outcome") != "failed":
        raise HTTPException(400, "The vault accepts documented failed experiments")
    verify_signature(keys, request.staker_address, request.signature,
                     vault_message("deposit", row.slice_id, request.staker_address, attestation.merkle_root))
    existing = session.scalar(select(VaultLiquidity).where(VaultLiquidity.slice_id == row.slice_id))
    if existing is None:
        existing = VaultLiquidity(deposit_id=f"deposit_{uuid4().hex}", slice_id=row.slice_id,
                                  staker_address=request.staker_address, minted_scicredit=50,
                                  remaining_scicredit=50, redemptions={}, created_at=utc_now())
        session.add(existing)
        session.flush()
    result = {"deposit_id": existing.deposit_id, "slice_id": row.slice_id,
              "minted_scicredit": existing.minted_scicredit,
              "staker_balance": balance(session, request.staker_address),
              "vault_pool_total_slices": session.scalar(select(func.count()).select_from(VaultLiquidity)),
              "credit_policy": "50 local SciCredit per unique verified failed-experiment slice"}
    session.commit()
    return result


def redeem(session: Session, request: CreditRedemptionRequest, keys: dict[str, str]) -> dict[str, Any]:
    session.execute(text("BEGIN IMMEDIATE"))
    row = get_slice(session, request.slice_id)
    attestation = verified_attestation(session, row)
    verify_signature(keys, request.staker_address, request.signature,
                     vault_message("redeem", row.slice_id, request.staker_address,
                                   attestation.merkle_root, row.price_scicredit))
    deposits = list(session.scalars(select(VaultLiquidity).where(
        VaultLiquidity.staker_address == request.staker_address).order_by(VaultLiquidity.created_at)))
    token = next((entry.redemptions[row.slice_id] for entry in deposits if row.slice_id in entry.redemptions), None)
    if token is None:
        if sum(entry.remaining_scicredit for entry in deposits) < row.price_scicredit:
            raise HTTPException(402, "Insufficient SciCredit balance")
        remaining = row.price_scicredit
        for entry in deposits:
            used = min(entry.remaining_scicredit, remaining)
            entry.remaining_scicredit -= used
            remaining -= used
        token = secrets.token_urlsafe(32)
        deposits[0].redemptions = {**deposits[0].redemptions, row.slice_id: token}
    session.flush()
    result = {"slice_id": row.slice_id, "download_token": token,
              "staker_balance": balance(session, request.staker_address)}
    session.commit()
    return result
