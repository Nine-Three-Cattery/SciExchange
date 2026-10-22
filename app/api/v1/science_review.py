"""Signed admission of versioned scientific inputs; no automatic approval."""
from fastapi import APIRouter, Depends, Request
from pydantic import Field
from sqlalchemy.orm import Session

from app.core.x402_middleware import envelope
from app.database import get_write_session
from app.models.schemas import Contract, Identifier
from app.services.science_review import approve, challenge

router = APIRouter(prefix="/compiler", tags=["scientific admission"])


class ReviewChallenge(Contract):
    slice_id: Identifier
    version: Identifier


class ReviewRequest(ReviewChallenge):
    signer_address: Identifier
    signature: str = Field(min_length=1, max_length=256)
    expires_at: str = Field(min_length=1, max_length=80)


@router.post("/review-challenge")
def review_challenge(body: ReviewChallenge, request: Request, session: Session = Depends(get_write_session)):
    return envelope(challenge(session, body.slice_id, body.version,
                              request.app.state.cipher, request.app.state.pi_public_keys))


@router.post("/review")
def review(body: ReviewRequest, request: Request, session: Session = Depends(get_write_session)):
    return envelope(approve(session, body, request.app.state.cipher, request.app.state.pi_public_keys))
