"""Public metadata discovery and authorized CSV/JSON delivery."""

import csv
from io import StringIO
from typing import Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.x402_middleware import envelope
from app.database import get_session
from app.models.models import DataSlice
from app.models.schemas import DomainType, Envelope
from app.services.slice_service import get_slice, public_summary, read_document, verified_attestation

router = APIRouter(prefix="/slices", tags=["slices"])


@router.get("", response_model=Envelope)
def catalog(domain: DomainType | None = None, data_classification: str | None = None,
            is_attested: bool | None = None, owner_lab_id: str | None = None,
            session: Session = Depends(get_session)) -> dict:
    query = select(DataSlice).where(DataSlice.quarantined.is_(False)).order_by(DataSlice.slice_id)
    if domain is not None:
        query = query.where(DataSlice.domain == domain.value)
    if data_classification is not None:
        query = query.where(DataSlice.data_classification == data_classification)
    if is_attested is not None:
        query = query.where(DataSlice.is_attested == is_attested)
    if owner_lab_id is not None:
        query = query.where(DataSlice.owner_lab_id == owner_lab_id)
    return envelope([public_summary(row) for row in session.scalars(query)])


@router.get("/{slice_id}/download")
def download(slice_id: str, request: Request, format: Literal["csv", "json"] = "csv",
             session: Session = Depends(get_session)) -> Response:
    row = get_slice(session, slice_id)
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
