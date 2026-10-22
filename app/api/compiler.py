"""B's stateless upload verification endpoint; does not publish or authorize a slice."""
from datetime import datetime, timezone

from fastapi import APIRouter, Body
from starlette.concurrency import run_in_threadpool

from app.services.physics_compiler import verify
from .science_route import ScienceJSONRoute

router = APIRouter(prefix="/api/v1/compiler", tags=["science compiler"], route_class=ScienceJSONRoute)


@router.post("/verify")
async def verify_slice(payload: dict = Body(...)):
    report = await run_in_threadpool(verify, payload)
    return {"code": 200, "message": "Scientific screening completed", "data": report,
            "timestamp": datetime.now(timezone.utc).isoformat()}
