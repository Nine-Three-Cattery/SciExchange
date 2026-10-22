"""Compile a stored slice or register and compile a complete immutable document."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.compiler.formal_engine import PhysicalCompiler
from app.compiler.safety_guardrail import check_safety
from app.core.x402_middleware import envelope
from app.database import get_session
from app.models.schemas import AttestationReport, CompilerRequest, Envelope
from app.services.slice_service import get_slice, issue_report, read_document, store_document

router = APIRouter(prefix="/compiler", tags=["compiler"])


@router.post("/verify", response_model=Envelope)
def verify(payload: CompilerRequest, request: Request, session: Session = Depends(get_session)) -> dict:
    if payload.metadata is None:
        row = get_slice(session, payload.slice_id)
        document = read_document(row, request.app.state.cipher)
    else:
        document = payload.model_dump(mode="json", exclude_none=True)
        try:
            row = store_document(session, document, request.app.state.cipher)
        except ValidationError as error:
            # The frozen API includes a minimal negative example with metrics
            # but no catalog identity. It can be diagnosed without being listed.
            result = PhysicalCompiler().verify(document)
            if not result["valid"]:
                report = {key: result[key] for key in AttestationReport.model_fields if key in result}
                sanitized = check_safety(document).sanitized_content
                report["instrument_fingerprint"] = {
                    "basis": "reported_testing_conditions",
                    "testing_conditions": sanitized["metadata"].get("testing_conditions", {}),
                }
                return envelope(AttestationReport.model_validate(report).model_dump(mode="json"))
            raise HTTPException(422, "Inline documents require complete ownership and measurement metadata") from error
    result = PhysicalCompiler().verify(document)
    return envelope(issue_report(session, row, document, result))
