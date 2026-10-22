"""x402 challenge and real local authorization, without accepting fabricated receipts."""

from datetime import datetime, timezone
import re
import secrets

from fastapi import HTTPException, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.core.security import utc_now
from app.models.models import BarterProposal, DataSlice, VaultLiquidity


def envelope(data: object, code: int = 200, message: str = "success") -> dict:
    return {"code": code, "message": message, "data": data, "timestamp": utc_now()}


def authorized(request: Request, session: Session, slice_id: str) -> bool:
    authorization = request.headers.get("authorization", "")
    token = authorization.removeprefix("Bearer ") if authorization.startswith("Bearer ") else request.headers.get("x-payment-receipt", "")
    if not token:
        return False
    proposal = session.scalar(select(BarterProposal).where(or_(
        BarterProposal.proposer_download_token == token, BarterProposal.target_download_token == token)))
    if proposal is not None:
        return (proposal.status == "DUAL_SIGNED_AND_EXECUTED"
                and datetime.fromisoformat(proposal.expires_at) > datetime.now(timezone.utc)
                and ((proposal.proposer_download_token == token and proposal.party_b_slice_id == slice_id)
                     or (proposal.target_download_token == token and proposal.party_a_slice_id == slice_id)))
    # SQLite JSON maps are small local vault grants; no unverified receipt is trusted.
    return any(entry.redemptions.get(slice_id) == token for entry in session.scalars(select(VaultLiquidity)))


def payment_response(row: DataSlice) -> JSONResponse:
    nonce = secrets.token_hex(16)
    headers = {"x402-Version": "1.0", "x402-Price": str(row.price_usdc), "x402-Currency": "USDC",
               "x402-Payee": row.owner_lab_id, "x402-Challenge": nonce,
               "X-Payment-Required": "true", "X-Payment-Address": row.owner_lab_id,
               "X-Payment-Amount": str(row.price_scicredit), "X-Payment-Token": "SciCredit",
               "X-Settlement-Network": "Local-Devnet"}
    return JSONResponse(envelope({"slice_id": row.slice_id,
                                 "accepted_methods": ["scicredit_microtransfer", "barter_swap"],
                                 "challenge_nonce": nonce}, 402,
                                "Payment Required: redeem local SciCredit or complete PI dual-sign barter"),
                        status_code=402, headers=headers)


class X402Middleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        match = re.fullmatch(r"/api/v1/slices/([^/]+)/download", request.url.path)
        if request.method in {"GET", "HEAD"} and match:
            with Session(request.app.state.engine) as session:
                row = session.get(DataSlice, match.group(1))
                if row is None:
                    return JSONResponse(envelope(None, 404, "Scientific slice not found"), status_code=404)
                if row.quarantined:
                    return JSONResponse(envelope(None, 403, "The slice is quarantined"), status_code=403)
                if not authorized(request, session, row.slice_id):
                    return payment_response(row)
                if not row.is_attested:
                    return JSONResponse(envelope(None, 403, "An unverified slice cannot be delivered"), status_code=403)
        return await call_next(request)
