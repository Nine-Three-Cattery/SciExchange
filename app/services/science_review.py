"""Explicit PI admission binds the immutable scientific content and full report."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.security import canonical_json, utc_now, verify_signature
from app.models.models import AttestationRecord, ScienceAdmission
from app.services.domain_analytics import input_hash
from app.services.science_gateway import admission_matches, check_science, get_record, science_report
from app.services.slice_service import get_slice


def review_message(row, record, expires_at: str) -> str:
    return canonical_json({
        "protocol": "SciExchange/scientific-admission/1", "action": "scientific_admission",
        "slice_id": row.slice_id, "version": record.version, "owner_lab_id": row.owner_lab_id,
        "input_sha256": record.input_sha256, "rule_version": record.report["rule_version"],
        "report_sha256": input_hash(record.report), "expires_at": expires_at,
        "scope": "Permit exchange after reviewing recorded limitations; does not certify scientific truth.",
    })


def _reviewable(session, identifier, version, cipher):
    row = get_slice(session, identifier)
    get_record(session, row, version)
    record = check_science(session, row, cipher)
    if record.report["blocking_failure"]:
        raise HTTPException(403, "A blocking scientific or metadata failure cannot be approved")
    return row, record


def challenge(session: Session, identifier: str, version: str, cipher, keys: dict) -> dict:
    row, record = _reviewable(session, identifier, version, cipher)
    if row.owner_lab_id not in keys:
        raise HTTPException(403, "The owning laboratory needs a registered PI public key")
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=4)).isoformat()
    return {"slice_id": identifier, "version": version,
            "canonical_message": review_message(row, record, expires_at), "expires_at": expires_at}


def approve(session: Session, body, cipher, keys: dict) -> dict:
    row = get_slice(session, body.slice_id)
    if body.signer_address != row.owner_lab_id:
        raise HTTPException(403, "Only the owning PI can admit this scientific slice")
    try:
        end = datetime.fromisoformat(body.expires_at.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        if end.tzinfo is None or not now < end <= now + timedelta(minutes=5):
            raise ValueError("Invalid review expiry")
    except ValueError as error:
        raise HTTPException(403, "Scientific admission signature is expired or has an invalid expiry") from error
    row, record = _reviewable(session, body.slice_id, body.version, cipher)
    message = review_message(row, record, body.expires_at)
    verify_signature(keys, body.signer_address, body.signature, message)
    if row.is_attested and admission_matches(session, record):
        return science_report(session, row)
    digest = input_hash(record.report)
    admission = session.get(ScienceAdmission, (row.slice_id, digest))
    if admission is None:
        admission = ScienceAdmission(
            slice_id=row.slice_id, version=record.version, input_sha256=record.input_sha256,
            rule_version=record.report["rule_version"], report_sha256=digest, report=record.report,
            signer_address=body.signer_address, signer_public_key=keys[body.signer_address],
            signature=body.signature, canonical_message=message, approved_at=utc_now())
        session.add(admission)
    row.is_attested = True
    row.attestation_uid = f"attest_{uuid4().hex}"
    session.flush()
    result = science_report(session, row)
    session.add(AttestationRecord(attestation_uid=row.attestation_uid, slice_id=row.slice_id,
                                 merkle_root=record.input_sha256, report=result, created_at=utc_now()))
    session.flush()
    return result
