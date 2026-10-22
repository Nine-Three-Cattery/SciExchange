"""Immutable scientific documents, safe catalog summaries and local attestations."""

import hashlib
import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from cryptography.fernet import Fernet
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, object_session

from app.compiler.safety_guardrail import check_safety
from app.core.security import canonical_json, utc_now
from app.models.models import AttestationRecord, DataSlice, ScienceRecord
from app.models.schemas import AttestationReport, CompilerRequest, SliceMetadata


def get_slice(session: Session, slice_id: str) -> DataSlice:
    row = session.get(DataSlice, slice_id)
    if row is None:
        raise HTTPException(404, "Scientific slice not found")
    return row


def read_document(row: DataSlice, cipher: Fernet) -> dict[str, Any]:
    session = object_session(row)
    if session is not None and session.get(ScienceRecord, row.slice_id) is not None:
        from app.services.science_gateway import checked_document
        return checked_document(session, row, cipher)
    return json.loads(cipher.decrypt(row.encrypted_payload))


def store_document(session: Session, document: dict[str, Any], cipher: Fernet) -> DataSlice:
    """A slice ID identifies one immutable payload, including its measurement metadata."""
    if "version" in document:
        raise HTTPException(422, "Versioned scientific inputs must be registered with the manifest importer")
    payload = canonical_json(document).encode()
    existing = session.get(DataSlice, document["slice_id"])
    if existing is not None:
        if cipher.decrypt(existing.encrypted_payload) != payload:
            raise HTTPException(409, "Slice IDs are immutable; use a new ID for revised data")
        return existing
    metadata = document["metadata"]
    base = SliceMetadata.model_validate({
        "slice_id": document["slice_id"], "domain": document["domain"],
        **{key: metadata[key] for key in SliceMetadata.model_fields
           if key not in {"slice_id", "domain"} and key in metadata},
    })
    safety = check_safety(document)
    safe_metadata = safety.sanitized_content["metadata"]
    row = DataSlice(
        slice_id=base.slice_id, domain=base.domain.value,
        title=safe_metadata.get("title", base.material_name), owner_lab_id=base.owner_lab_id,
        data_classification=metadata.get("data_classification", "unclassified"),
        metadata_json=safe_metadata, encrypted_payload=cipher.encrypt(payload),
        price_usdc=base.price_usdc, price_scicredit=base.price_scicredit, accepts_barter=base.accepts_barter,
        is_attested=False, quarantined=not safety.safe, created_at=base.created_at,
    )
    session.add(row)
    session.flush()
    return row


def import_slices(session: Session, directory: Path, cipher: Fernet) -> None:
    try:
        consumed = set()
        if (directory / "manifest.json").exists():
            from app.services.science_gateway import import_scientific_slices
            consumed = import_scientific_slices(session, directory, cipher)
        for path in sorted(directory.glob("*.json")):
            if path.name in consumed:
                continue
            document = CompilerRequest.model_validate_json(path.read_text(encoding="utf-8"))
            if document.metadata is None:
                raise ValueError(f"Seed file {path.name} contains a reference instead of measurements")
            store_document(session, document.model_dump(mode="json", exclude_none=True), cipher)
        session.commit()
    except Exception:
        session.rollback()
        raise


def public_summary(row: DataSlice) -> dict[str, Any]:
    summary = {"slice_id": row.slice_id, "domain": row.domain, "title": row.title,
            "data_classification": row.data_classification, "owner_lab_id": row.owner_lab_id,
            "is_attested": row.is_attested, "attestation_uid": row.attestation_uid,
            "price_scicredit": row.price_scicredit, "price_usdc": row.price_usdc,
            "accepts_barter": row.accepts_barter, "summary": row.metadata_json.get("summary", ""),
            "quarantined": row.quarantined, "provenance": row.metadata_json.get("provenance", {}),
            "verification_kind": "numerical_protocol_checks"}
    session = object_session(row)
    record = session.get(ScienceRecord, row.slice_id) if session is not None else None
    if record is not None:
        from app.services.science_gateway import admission_matches
        approved = row.is_attested and admission_matches(session, record)
        summary.update(version=record.version, compiler_status=record.report["compiler_status"],
                       review_status="approved" if approved else "pending", is_attested=approved,
                       attestation_uid=row.attestation_uid if approved else None,
                       analysis_methods=row.metadata_json.get("analysis_methods", []),
                       verification_kind="versioned_scientific_consistency_checks")
    return check_safety(summary).sanitized_content


def verified_attestation(session: Session, row: DataSlice) -> AttestationRecord:
    if row.quarantined:
        raise HTTPException(403, "The slice is quarantined by scientific safety screening")
    if not row.is_attested:
        raise HTTPException(400, "Compile and attest the slice before exchanging it")
    scientific = session.get(ScienceRecord, row.slice_id)
    if scientific is not None:
        from app.services.science_gateway import admission_matches
        if not admission_matches(session, scientific):
            raise HTTPException(409, "Scientific checks changed; renewed PI admission is required")
    record = session.scalar(select(AttestationRecord).where(AttestationRecord.slice_id == row.slice_id))
    if record is None:
        raise HTTPException(409, "The slice has no matching attestation")
    return record


def issue_report(session: Session, row: DataSlice, document: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    report = {key: result[key] for key in AttestationReport.model_fields if key in result}
    report.setdefault("diagnostic_log", "\n".join(report["diagnostic_logs"]))
    report["instrument_fingerprint"] = {
        "basis": "reported_testing_conditions",
        "testing_conditions": row.metadata_json.get("testing_conditions", {}),
    }
    row.quarantined = not result["safety_clearance"]["safe"]
    row.is_attested = result["valid"]
    if result["valid"]:
        previous = session.scalar(select(AttestationRecord).where(AttestationRecord.slice_id == row.slice_id))
        if previous is not None:
            return previous.report
        now = utc_now()
        # One immutable document is one Merkle leaf; its root is its SHA-256 digest.
        root = hashlib.sha256(canonical_json(document).encode()).hexdigest()
        uid = f"attest_{uuid4().hex}"
        report.update(attestation_uid=uid, merkle_root=root, proof_of_priority={
            "content_sha256": root, "hash_algorithm": "SHA-256", "merkle_leaf_count": 1,
            "issued_at": now, "owner_lab_id": row.owner_lab_id,
            "compiler_version": "SciExchange/v4-runtime-1",
            "verification_kind": "numerical_protocol_checks",
            "timestamp_authority": "local_gateway_clock",
            "attribution_policy": "Preserve source provenance and Apache-2.0 benchmark attribution",
        })
        report = AttestationReport.model_validate(report).model_dump(mode="json")
        row.attestation_uid = uid
        session.add(AttestationRecord(attestation_uid=uid, slice_id=row.slice_id,
                                      merkle_root=root, report=report, created_at=now))
    else:
        report = AttestationReport.model_validate(report).model_dump(mode="json")
    session.commit()
    return report
