"""Two independent Ed25519 approvals unlock the reciprocal documents atomically."""

from datetime import datetime, timedelta, timezone
import secrets
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import canonical_json, utc_now, verify_signature
from app.models.models import BarterProposal
from app.models.schemas import DualSignRequest, NegotiateRequest
from app.services.slice_service import get_slice, verified_attestation


def proposal_view(row: BarterProposal) -> dict[str, Any]:
    return {"proposal_id": row.proposal_id, "party_a_lab": row.party_a_lab,
            "party_a_slice_id": row.party_a_slice_id, "party_b_lab": row.party_b_lab,
            "party_b_slice_id": row.party_b_slice_id, "status": row.status,
            "created_at": row.created_at, "expires_at": row.expires_at,
            "canonical_agreement": row.canonical_agreement}


def negotiate(session: Session, request: NegotiateRequest, keys: dict[str, str]) -> dict[str, Any]:
    first, second = get_slice(session, request.party_a_slice_id), get_slice(session, request.party_b_slice_id)
    first_attest, second_attest = verified_attestation(session, first), verified_attestation(session, second)
    if (first.owner_lab_id, second.owner_lab_id) != (request.party_a_lab, request.party_b_lab):
        raise HTTPException(403, "The proposed laboratories must own the offered slices")
    if request.party_a_lab == request.party_b_lab or request.party_a_slice_id == request.party_b_slice_id:
        raise HTTPException(400, "Barter requires two different laboratories and slices")
    if not first.accepts_barter or not second.accepts_barter:
        raise HTTPException(400, "Both slices must explicitly accept barter")
    if any(lab not in keys for lab in (request.party_a_lab, request.party_b_lab)):
        raise HTTPException(403, "Both laboratories require registered PI public keys")
    if keys[request.party_a_lab] == keys[request.party_b_lab]:
        raise HTTPException(403, "Independent PI public keys are required for dual signing")
    now = utc_now()
    proposal_id = f"barter_{uuid4().hex}"
    expiry = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    agreement = {"protocol": "SciExchange/v4", "action": "reciprocal_slice_exchange",
                 "proposal_id": proposal_id, **request.model_dump(), "created_at": now,
                 "expires_at": expiry, "party_a_content_sha256": first_attest.merkle_root,
                 "party_b_content_sha256": second_attest.merkle_root,
                 "party_a_pi_public_key": keys[request.party_a_lab],
                 "party_b_pi_public_key": keys[request.party_b_lab]}
    row = BarterProposal(proposal_id=proposal_id, **request.model_dump(),
                         status="PENDING_DUAL_SIGNATURE", canonical_agreement=canonical_json(agreement),
                         created_at=now, expires_at=expiry)
    session.add(row)
    session.commit()
    return proposal_view(row)


def dual_sign(session: Session, request: DualSignRequest, keys: dict[str, str]) -> dict[str, Any]:
    # SQLite serializes the read-modify-write step so independent signers cannot lose an approval.
    session.execute(text("BEGIN IMMEDIATE"))
    row = session.get(BarterProposal, request.proposal_id)
    if row is None:
        raise HTTPException(404, "Barter proposal not found")
    if datetime.fromisoformat(row.expires_at) <= datetime.now(timezone.utc):
        raise HTTPException(403, "The PI agreement has expired")
    proposer = request.signer_role == "pi_proposer"
    expected = row.party_a_lab if proposer else row.party_b_lab
    if request.signer_address != expected:
        raise HTTPException(403, "The signer does not own this side of the agreement")
    import json
    agreement = json.loads(row.canonical_agreement)
    if (keys.get(row.party_a_lab), keys.get(row.party_b_lab)) != (
        agreement["party_a_pi_public_key"], agreement["party_b_pi_public_key"]
    ):
        raise HTTPException(403, "Registered PI keys changed; negotiate a new agreement")
    verify_signature(keys, request.signer_address, request.signature, row.canonical_agreement)
    for identifier, expected_root in (
        (row.party_a_slice_id, agreement["party_a_content_sha256"]),
        (row.party_b_slice_id, agreement["party_b_content_sha256"]),
    ):
        if verified_attestation(session, get_slice(session, identifier)).merkle_root != expected_root:
            raise HTTPException(409, "The agreement no longer matches the slice attestation")
    if proposer:
        row.proposer_signature = request.signature
    else:
        row.target_signature = request.signature
    if row.proposer_signature and row.target_signature:
        row.status = "DUAL_SIGNED_AND_EXECUTED"
        if row.proposer_download_token is None:
            row.proposer_download_token = secrets.token_urlsafe(32)
            row.target_download_token = secrets.token_urlsafe(32)
    else:
        row.status = "PENDING_SECOND_PI_SIGNATURE"
    session.commit()
    result = proposal_view(row)
    if row.status == "DUAL_SIGNED_AND_EXECUTED":
        result.update(download_token=row.proposer_download_token if proposer else row.target_download_token,
                      downloaded_slice_id=row.party_b_slice_id if proposer else row.party_a_slice_id)
    return result
