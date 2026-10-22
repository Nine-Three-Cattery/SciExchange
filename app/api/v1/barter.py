"""Negotiation and human PI approval endpoints."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.x402_middleware import envelope
from app.database import get_session
from app.models.schemas import DualSignRequest, Envelope, NegotiateRequest
from app.services.barter_service import dual_sign, negotiate

router = APIRouter(prefix="/barter", tags=["barter"])


@router.post("/negotiate", response_model=Envelope)
def negotiate_route(payload: NegotiateRequest, request: Request, session: Session = Depends(get_session)) -> dict:
    return envelope(negotiate(session, payload, request.app.state.pi_public_keys))


@router.post("/dual-sign", response_model=Envelope)
def sign_route(payload: DualSignRequest, request: Request, session: Session = Depends(get_session)) -> dict:
    return envelope(dual_sign(session, payload, request.app.state.pi_public_keys))
