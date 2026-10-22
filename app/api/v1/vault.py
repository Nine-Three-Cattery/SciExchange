"""Deposit failed experiments and spend earned local credits on a scientific slice."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.x402_middleware import envelope
from app.database import get_session, get_write_session
from app.models.schemas import CreditRedemptionRequest, Envelope, VaultChallengeRequest, VaultDepositRequest
from app.services.vault_service import balance, create_challenge, deposit, redeem

router = APIRouter(prefix="/vault", tags=["vault"])


@router.post("/deposit", response_model=Envelope)
def deposit_route(payload: VaultDepositRequest, request: Request, session: Session = Depends(get_write_session)) -> dict:
    return envelope(deposit(session, payload, request.app.state.pi_public_keys))


@router.post("/redeem", response_model=Envelope)
def redeem_route(payload: CreditRedemptionRequest, request: Request, session: Session = Depends(get_write_session)) -> dict:
    return envelope(redeem(session, payload, request.app.state.pi_public_keys))


@router.post("/challenge", response_model=Envelope)
def challenge_route(payload: VaultChallengeRequest, request: Request, session: Session = Depends(get_write_session)) -> dict:
    return envelope(create_challenge(session, payload, request.app.state.pi_public_keys))


@router.get("/balance", response_model=Envelope)
def balance_route(address: str, session: Session = Depends(get_session)) -> dict:
    return envelope({"address": address, "staker_balance": balance(session, address)})
