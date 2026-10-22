"""Import attributed scientific slices without confusing checks with admission."""
from __future__ import annotations

import json
from pathlib import Path

from cryptography.fernet import InvalidToken
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.security import canonical_json, utc_now
from app.models.models import AttestationRecord, DataSlice, ScienceAdmission, ScienceRecord
from app.services.domain_analytics import input_hash, valid_identifier, validate_table
from app.services.physics_compiler import RULE_VERSION, verify
from app.services.science_io import load_slices


def analysis_methods(document: dict) -> list[str]:
    columns = document["columns"]
    if document["domain"] == "electrocatalysis":
        return [] if document["metadata"].get("measurement_type") == "potential_sweep_with_return" else ["tafel_slope"]
    if "cycle_index" in columns:
        return ["capacity_fade", "knee_point"]
    return ["dq_dv"] if "voltage_v" in columns and "capacity_ah" in columns else []


def get_record(session: Session, row: DataSlice, version: str | None = None) -> ScienceRecord:
    record = session.get(ScienceRecord, row.slice_id)
    if record is None:
        raise HTTPException(404, "This slice is not a versioned scientific record")
    if version is not None and version != record.version:
        raise HTTPException(409, "Scientific slice version mismatch")
    return record


def checked_document(session: Session, row: DataSlice, cipher) -> dict:
    record = get_record(session, row)
    try:
        document = json.loads(cipher.decrypt(row.encrypted_payload))
        matching = (document["slice_id"] == row.slice_id and document["version"] == record.version
                    and input_hash(document) == record.input_sha256)
    except (InvalidToken, ValueError, TypeError, KeyError, RecursionError) as error:
        raise HTTPException(409, "Stored scientific content failed integrity verification") from error
    if not matching:
        raise HTTPException(409, "Stored scientific content does not match its immutable version")
    return document


def admission_matches(session: Session, record: ScienceRecord) -> bool:
    admission = session.get(ScienceAdmission, (record.slice_id, input_hash(record.report)))
    return bool(admission and not record.report["blocking_failure"]
                and record.report["rule_version"] == RULE_VERSION
                and admission.version == record.version
                and admission.input_sha256 == record.input_sha256
                and admission.rule_version == record.report["rule_version"]
                and admission.report_sha256 == input_hash(record.report))


def check_science(session: Session, row: DataSlice, cipher) -> ScienceRecord:
    record = get_record(session, row)
    record.report = verify(checked_document(session, row, cipher))
    record.checked_at = utc_now()
    row.quarantined = record.report["blocking_failure"]
    if not admission_matches(session, record):
        row.is_attested = False
        row.attestation_uid = None
        # Keep the signed admission as historical evidence; its binding no longer matches.
        old = session.query(AttestationRecord).filter_by(slice_id=row.slice_id).one_or_none()
        if old is not None:
            session.delete(old)
    session.flush()
    return record


def science_report(session: Session, row: DataSlice) -> dict:
    record = get_record(session, row)
    report = dict(record.report)
    approved = bool(row.is_attested and admission_matches(session, record))
    report.update(version=record.version, is_attested=approved, quarantined=row.quarantined,
                  review_status="approved" if approved else "pending",
                  attestation_uid=row.attestation_uid if approved else None,
                  merkle_root=record.input_sha256 if approved else None,
                  proof_of_priority={}, instrument_fingerprint={"basis": "declared_metadata_not_authenticated"},
                  physics_results={"checks": report["checks"], "coverage": report["coverage"]},
                  safety_clearance={"safe": not report["blocking_failure"], "scope": "bounded_checks_only"},
                  diagnostic_logs=report["diagnostic_log"].splitlines(),
                  violated_axioms=[{"axiom_id": check["rule_id"], "name": check["reason"],
                                    "formula": "", "observed_value": check["observed_value"],
                                    "allowed_range": check["allowed_range"], "severity": "error"}
                                   for check in report["checks"] if check["status"] == "fail"],
                  verification_scope="Versioned consistency checks; PI admission is separate and is not a proof of truth.")
    if approved:
        admission = session.get(ScienceAdmission, (row.slice_id, input_hash(record.report)))
        report["admission"] = {key: getattr(admission, key) for key in (
            "version", "input_sha256", "rule_version", "report_sha256", "signer_address",
            "signer_public_key", "signature", "canonical_message", "approved_at")}
        report["proof_of_priority"] = {
            "content_sha256": record.input_sha256, "version": record.version,
            "issued_at": admission.approved_at, "timestamp_authority": "local_gateway_clock",
            "scope": "Content commitment and PI admission; no priority or truth adjudication",
            "attribution_policy": row.metadata_json.get("license"),
            "attribution": row.metadata_json.get("attribution"),
        }
    return report


def import_scientific_slices(session: Session, directory: Path, cipher) -> set[str]:
    """Stage one manifest atomically; the caller owns commit/rollback.

    Local demo identities are custodians, not the dataset authors or source labs.
    A slice ID remains immutable, including its explicitly stored version.
    """
    documents = load_slices(directory)  # Check every source/CSV/metadata hash before writing.
    for identifier, document in documents.items():
        validate_table(document)
        if not valid_identifier(document.get("version"), version=True):
            raise ValueError("Scientific slices require a bounded version identifier")
        digest = input_hash(document)
        existing = session.get(DataSlice, identifier)
        if existing is not None:
            record = get_record(session, existing, document["version"])
            if record.input_sha256 != digest or checked_document(session, existing, cipher) != document:
                raise HTTPException(409, "Slice IDs and versions are immutable; import a new ID for revisions")
            check_science(session, existing, cipher)
            continue
        report = verify(document)
        metadata = dict(report["safe_metadata"])
        metadata.update(
            summary="Attributed experimental slice" if metadata.get("data_origin") == "experimental" else "Synthetic fault-injection test",
            analysis_methods=analysis_methods(document),
            catalog_owner_scope="Local demo custodian; does not identify or represent the source authors",
            provenance={"source_type": metadata.get("data_origin"),
                        "experimental_measurement": metadata.get("data_origin") == "experimental",
                        **{key: metadata.get(key) for key in ("source_url", "source_doi", "paper_doi", "license", "attribution", "transformation")}},
        )
        owner = "lab_catalysis" if document["domain"] == "electrocatalysis" else "lab_battery"
        row = DataSlice(slice_id=identifier, domain=document["domain"], title=identifier,
                        owner_lab_id=owner, data_classification="experimental_reference" if metadata.get("data_origin") == "experimental" else "synthetic_fault_injection",
                        metadata_json=metadata, encrypted_payload=cipher.encrypt(canonical_json(document).encode()),
                        price_usdc=0.05, price_scicredit=50, accepts_barter=True, is_attested=False,
                        quarantined=report["blocking_failure"], created_at=utc_now())
        session.add(row)
        session.flush()
        session.add(ScienceRecord(slice_id=identifier, version=document["version"], input_sha256=digest,
                                  report=report, checked_at=utc_now()))
        session.flush()
    manifest = json.loads((directory / "manifest.json").read_text())
    return {"manifest.json", *(entry["metadata_file"] for entry in manifest["entries"])}
