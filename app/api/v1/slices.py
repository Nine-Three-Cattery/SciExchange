"""Public metadata discovery and authorized CSV/JSON delivery."""

import csv
from io import StringIO
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.x402_middleware import envelope
from app.database import get_session
from app.models.models import DataSlice, ScienceRecord
from app.models.schemas import DomainType, Envelope
from app.services.slice_service import get_slice, public_summary, read_document, verified_attestation

router = APIRouter(prefix="/slices", tags=["slices"])


@router.get("", response_model=Envelope)
def catalog(domain: DomainType | None = None, data_classification: str | None = None,
            is_attested: bool | None = None, owner_lab_id: str | None = None,
            include_quarantined: bool = False,
            session: Session = Depends(get_session)) -> dict:
    query = select(DataSlice).order_by(DataSlice.slice_id)
    if not include_quarantined:
        query = query.where(DataSlice.quarantined.is_(False))
    if domain is not None:
        query = query.where(DataSlice.domain == domain.value)
    if data_classification is not None:
        query = query.where(DataSlice.data_classification == data_classification)
    if is_attested is not None:
        query = query.where(DataSlice.is_attested == is_attested)
    if owner_lab_id is not None:
        query = query.where(DataSlice.owner_lab_id == owner_lab_id)
    return envelope([public_summary(row) for row in session.scalars(query)])


@router.get("/{slice_id}/attestation", response_model=Envelope)
def attestation(slice_id: str, session: Session = Depends(get_session)) -> dict:
    """Read an issued report without recompiling or exposing raw measurements."""
    return envelope(verified_attestation(session, get_slice(session, slice_id)).report)


@router.get("/{slice_id}/download")
def download(slice_id: str, request: Request, format: Literal["csv", "json"] = "csv", version: str | None = None,
             session: Session = Depends(get_session)) -> Response:
    row = get_slice(session, slice_id)
    if version is not None:
        record = session.get(ScienceRecord, slice_id)
        if record is None or record.version != version:
            raise HTTPException(409, "Delivered scientific version mismatch")
    if not getattr(request.state, "owner_authorized", False):
        verified_attestation(session, row)
    document = read_document(row, request.app.state.cipher)
    if format == "json":
        from app.core.security import canonical_json
        return Response(canonical_json(document), media_type="application/json",
                        headers={"Content-Disposition": f'attachment; filename="{slice_id}.json"'})
    output = StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(document["columns"])
    writer.writerows(document["rows"])
    return Response(output.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{slice_id}.csv"'})
