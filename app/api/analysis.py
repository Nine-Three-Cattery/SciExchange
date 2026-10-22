"""Analysis requires A to inject an authorized, version-pinned delivery resolver."""
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from app.services.domain_analytics import ScienceError, analyze
from app.services.physics_compiler import verify
from .science_route import ScienceJSONRoute

Resolver = Callable[[Request, str, str], Awaitable[dict]]


class ScienceAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slice_id: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9_-]+$")
    version: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    analysis_type: Literal["tafel_slope", "capacity_fade", "dq_dv", "knee_point"]
    parameters: dict[str, Any] = Field(default_factory=dict)


def create_router(resolve_authorized_slice: Resolver | None = None) -> APIRouter:
    router = APIRouter(prefix="/api/v1/analysis", tags=["science analysis"], route_class=ScienceJSONRoute)

    async def execute(body: ScienceAnalysisRequest, request: Request, domain: str):
        if resolve_authorized_slice is None:
            raise HTTPException(503, "Authorized delivery resolver is not configured")
        # Must authenticate and authorize this request even if results/data were cached earlier.
        payload = await resolve_authorized_slice(request, body.slice_id, body.version)
        if not isinstance(payload, dict) or payload.get("slice_id") != body.slice_id or payload.get("version") != body.version:
            raise HTTPException(409, "Delivered slice identity/version mismatch")
        if payload.get("domain") != domain:
            raise HTTPException(422, "Slice domain does not match this endpoint")
        report = await run_in_threadpool(verify, payload)
        if report["blocking_failure"]:
            raise HTTPException(422, "Delivered slice has blocking validation failures")
        try:
            result = await run_in_threadpool(analyze, payload, body.analysis_type, body.parameters)
        except ScienceError as error:
            raise HTTPException(422, {"error": error.code, "message": str(error)}) from error
        result["screening"] = {"compiler_status": report["compiler_status"], "coverage": report["coverage"]}
        return {"code": 200, "message": "Analysis completed", "data": result,
                "timestamp": datetime.now(timezone.utc).isoformat()}

    @router.post("/catalysis")
    async def catalysis(body: ScienceAnalysisRequest, request: Request):
        return await execute(body, request, "electrocatalysis")

    @router.post("/battery")
    async def battery(body: ScienceAnalysisRequest, request: Request):
        return await execute(body, request, "battery_cycling")

    return router


# Safe default: mounting this without the resolver returns 503, never local fixture data.
router = create_router()
