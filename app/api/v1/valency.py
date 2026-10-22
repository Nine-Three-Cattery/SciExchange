"""Valency Bond (valency.io) MCP endpoints for literature grounding and scientific agent barter."""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.x402_middleware import envelope
from app.database import get_session
from app.models.models import DataSlice
from app.services.valency_bond import ValencyBondService

router = APIRouter(prefix="/valency", tags=["Valency Bond MCP"])
valency_service = ValencyBondService()


class GroundSliceRequest(BaseModel):
    slice_id: str = Field(..., description="Unique slice identifier")
    domain: str | None = Field(default=None, description="electrocatalysis or battery_cycling")
    metadata: dict[str, Any] | None = Field(default=None, description="Slice metadata and metrics")


class CitationVerificationRequest(BaseModel):
    doi: str = Field(..., description="DOI string to verify")
    title: str | None = Field(default=None, description="Optional paper title")


class FairValueRequest(BaseModel):
    party_a_slice_id: str
    party_b_slice_id: str
    party_a_domain: str | None = None
    party_b_domain: str | None = None


class McpCallRequest(BaseModel):
    method: str = Field(..., description="MCP tool name, e.g. valency_bond_ground_slice")
    params: dict[str, Any] = Field(default_factory=dict, description="Parameters matching tool schema")


@router.post("/ground")
def ground_slice(
    payload: GroundSliceRequest,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Ground a slice against Valency Bond's peer-reviewed literature corpus."""
    slice_dict: dict[str, Any] = {
        "slice_id": payload.slice_id,
        "domain": payload.domain or "",
        "metadata": payload.metadata or {},
    }

    # If domain or metadata not provided, inspect database record if available
    if not payload.domain or not payload.metadata:
        db_slice = session.get(DataSlice, payload.slice_id)
        if db_slice:
            slice_dict["domain"] = db_slice.domain
            slice_dict["metadata"] = db_slice.metadata_json or {}
            slice_dict["is_attested"] = db_slice.is_attested

    result = valency_service.ground_slice(slice_dict)
    return envelope(result)


@router.post("/verify-citation")
def verify_citation(payload: CitationVerificationRequest) -> dict[str, Any]:
    """Verify paper DOI and attribution lineage in Valency Bond's citation graph."""
    result = valency_service.verify_citation(doi=payload.doi, title=payload.title)
    return envelope(result)


@router.post("/fair-value")
def evaluate_fair_value(
    payload: FairValueRequest,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Calculate literature-backed game-theoretic fair-trade exchange ratio for A2A barter."""
    slice_a: dict[str, Any] = {"slice_id": payload.party_a_slice_id, "domain": payload.party_a_domain or ""}
    slice_b: dict[str, Any] = {"slice_id": payload.party_b_slice_id, "domain": payload.party_b_domain or ""}

    db_a = session.get(DataSlice, payload.party_a_slice_id)
    if db_a:
        slice_a["domain"] = db_a.domain
        slice_a["is_attested"] = db_a.is_attested
        slice_a["valency_grounding"] = valency_service.ground_slice({
            "slice_id": db_a.slice_id,
            "domain": db_a.domain,
            "metadata": db_a.metadata_json,
        })

    db_b = session.get(DataSlice, payload.party_b_slice_id)
    if db_b:
        slice_b["domain"] = db_b.domain
        slice_b["is_attested"] = db_b.is_attested
        slice_b["valency_grounding"] = valency_service.ground_slice({
            "slice_id": db_b.slice_id,
            "domain": db_b.domain,
            "metadata": db_b.metadata_json,
        })

    valuation = valency_service.evaluate_barter_fair_value(slice_a, slice_b)
    return envelope(valuation)


@router.get("/mcp-schema")
def get_mcp_schema() -> dict[str, Any]:
    """Expose Valency Bond Model Context Protocol (MCP) server manifest and tool definitions."""
    tools = valency_service.get_mcp_tool_definitions()
    schema = {
        "mcp_version": "2024-11-05",
        "server_info": {
            "name": "valency-bond-sciexchange",
            "version": "1.2.0",
            "provider": "Valency (valency.io) x SciExchange",
            "description": "Scientific literature grounding and citation provenance MCP bridge for materials & chemistry AI agents",
            "sponsor_track": "Valency Bond ($5,000 Prize Track - OSI Hackathon 2026)",
        },
        "tools": tools,
    }
    return envelope(schema)


@router.post("/mcp-call")
def call_mcp_tool(payload: McpCallRequest) -> dict[str, Any]:
    """Execute an MCP tool call through the Valency Bond interface."""
    method = payload.method
    params = payload.params

    if method == "valency_bond_ground_slice":
        result = valency_service.ground_slice(params)
    elif method == "valency_bond_verify_citation":
        doi = params.get("doi", "")
        title = params.get("title")
        result = valency_service.verify_citation(doi, title)
    elif method == "valency_bond_fair_value":
        slice_a = params.get("slice_a", {})
        slice_b = params.get("slice_b", {})
        result = valency_service.evaluate_barter_fair_value(slice_a, slice_b)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown Valency Bond MCP tool: {method}")

    return envelope({"tool": method, "result": result})
