"""Deposit failed experiments and spend earned local credits on a scientific slice."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.x402_middleware import envelope
from app.database import get_session
from app.models.schemas import CreditRedemptionRequest, Envelope, VaultDepositRequest
from app.services.vault_service import deposit, redeem

router = APIRouter(prefix="/vault", tags=["vault"])


@router.post("/deposit", response_model=Envelope)
def deposit_route(payload: VaultDepositRequest, request: Request, session: Session = Depends(get_session)) -> dict:
    return envelope(deposit(session, payload, request.app.state.pi_public_keys))


@router.post("/redeem", response_model=Envelope)
def redeem_route(payload: CreditRedemptionRequest, request: Request, session: Session = Depends(get_session)) -> dict:
    return envelope(redeem(session, payload, request.app.state.pi_public_keys))
