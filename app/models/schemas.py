"""Public v4 contracts; private keys never cross the gateway boundary."""

from enum import Enum
import math
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue, StringConstraints, model_validator

Identifier = Annotated[str, StringConstraints(min_length=1, max_length=160, pattern=r"^[A-Za-z0-9_.:-]+$")]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class DomainType(str, Enum):
    ELECTROCATALYSIS = "electrocatalysis"
    BATTERY_CYCLING = "battery_cycling"
    HYDROTHERMAL_SYNTHESIS = "hydrothermal_synthesis"


class CompilerStatus(str, Enum):
    FORMAL_PROOF_VALID = "FORMAL_PROOF_VALID"
    REJECTED_PHYSICS_VIOLATION = "REJECTED_PHYSICS_VIOLATION"
    REJECTED_SECURITY_ALERT = "REJECTED_SECURITY_ALERT"
    REJECTED_OPERATIONAL_ARTEFACT = "REJECTED_OPERATIONAL_ARTEFACT"


class SliceMetadata(Contract):
    slice_id: Identifier
    domain: DomainType = Field(strict=False)
    reaction_or_chemistry: str
    material_name: str
    temperature_c: float
    testing_conditions: dict[str, JsonValue]
    extracted_metrics: dict[str, JsonValue]
    price_usdc: float = Field(default=0.05, ge=0)
    accepts_barter: bool = True
    owner_lab_id: Identifier
    created_at: str


class SampleTable(Contract):
    columns: list[str]
    rows: list[list[float | str]]

    @model_validator(mode="after")
    def rectangular_finite_table(self) -> "SampleTable":
        if len(set(self.columns)) != len(self.columns):
            raise ValueError("sample columns must be unique")
        for row in self.rows:
            if len(row) != len(self.columns):
                raise ValueError("sample row width does not match columns")
            if any(isinstance(value, float) and not math.isfinite(value) for value in row):
                raise ValueError("samples must be finite")
        return self


class CompilerRequest(Contract):
    slice_id: Identifier
    domain: DomainType | None = Field(default=None, strict=False)
    metadata: dict[str, JsonValue] | None = None
    columns: list[str] | None = None
    rows: list[list[float | str]] | None = None
    charge_curve: SampleTable | None = None

    @model_validator(mode="after")
    def complete_document_or_reference(self) -> "CompilerRequest":
        supplied = [self.domain is not None, self.metadata is not None,
                    self.columns is not None, self.rows is not None]
        if any(supplied) and not all(supplied):
            raise ValueError("inline verification requires domain, metadata, columns and rows")
        if self.columns is not None:
            SampleTable(columns=self.columns, rows=self.rows or [])
        if not any(supplied) and self.charge_curve is not None:
            raise ValueError("a charge curve requires an inline document")

        def finite(value: JsonValue) -> None:
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError("metadata numbers must be finite")
            if isinstance(value, dict):
                for child in value.values():
                    finite(child)
            elif isinstance(value, list):
                for child in value:
                    finite(child)

        if self.metadata is not None:
            finite(self.metadata)
        return self


class AttestationReport(Contract):
    attestation_uid: str | None = None
    slice_id: str
    compiler_status: CompilerStatus = Field(strict=False)
    valid: bool
    proof_of_priority: dict[str, JsonValue] = Field(default_factory=dict)
    instrument_fingerprint: dict[str, JsonValue] = Field(default_factory=dict)
    physics_results: dict[str, JsonValue]
    safety_clearance: dict[str, JsonValue]
    diagnostic_logs: list[str]
    diagnostic_log: str
    violated_axioms: list[dict[str, JsonValue]] = Field(default_factory=list)
    safety_alerts: list[dict[str, JsonValue]] = Field(default_factory=list)
    merkle_root: str | None = None
    analytics: dict[str, JsonValue] = Field(default_factory=dict)
    verification_scope: str = "Frozen numerical protocol checks; Lean-style diagnostic rendering only"


class BarterProposal(Contract):
    proposal_id: str
    party_a_lab: str
    party_a_slice_id: str
    party_b_lab: str
    party_b_slice_id: str
    status: str = "PENDING_DUAL_SIGNATURE"
    created_at: str
    canonical_agreement: str


class NegotiateRequest(Contract):
    party_a_lab: Identifier
    party_a_slice_id: Identifier
    party_b_lab: Identifier
    party_b_slice_id: Identifier


class DualSignRequest(Contract):
    proposal_id: Identifier
    signer_role: Literal["pi_proposer", "pi_target"] = "pi_proposer"
    signer_address: Identifier
    signature: Annotated[str, StringConstraints(min_length=1, max_length=256)]
    human_notes: str | None = Field(default="Approved by PI", max_length=2000)


class VaultDepositRequest(Contract):
    slice_id: Identifier
    staker_address: Identifier
    signature: Annotated[str, StringConstraints(min_length=1, max_length=256)]


class CreditRedemptionRequest(Contract):
    slice_id: Identifier
    staker_address: Identifier
    signature: Annotated[str, StringConstraints(min_length=1, max_length=256)]


class AnalysisRequest(Contract):
    slice_id: Identifier
    analysis_type: Literal["tafel_slope", "dta", "dq_dv", "knee_point"]
    parameters: dict[str, JsonValue] | None = None


class Envelope(Contract):
    code: int
    message: str
    data: Any
    timestamp: str
