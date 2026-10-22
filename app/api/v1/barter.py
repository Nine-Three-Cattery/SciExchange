"""Negotiation and human PI approval endpoints."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.x402_middleware import envelope
from app.database import get_session, get_write_session
from app.models.schemas import DualSignRequest, Envelope, NegotiateRequest
from app.services.barter_service import dual_sign, negotiate, proposal_status

router = APIRouter(prefix="/barter", tags=["barter"])


@router.post("/negotiate", response_model=Envelope)
def negotiate_route(payload: NegotiateRequest, request: Request, session: Session = Depends(get_write_session)) -> dict:
    return envelope(negotiate(session, payload, request.app.state.pi_public_keys))


@router.post("/dual-sign", response_model=Envelope)
def sign_route(payload: DualSignRequest, request: Request, session: Session = Depends(get_write_session)) -> dict:
    return envelope(dual_sign(session, payload, request.app.state.pi_public_keys))


@router.get("/proposals/{proposal_id}", response_model=Envelope)
def status_route(proposal_id: str, request: Request, session: Session = Depends(get_session)) -> dict:
    return envelope(proposal_status(session, proposal_id, request.app.state.pi_public_keys,
                                    request.headers.get("x-pi-address"), request.headers.get("x-pi-signature")))
