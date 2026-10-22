"""The four persistent entities in the scientific exchange protocol."""

from typing import Any

from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DataSlice(Base):
    __tablename__ = "data_slices"

    slice_id: Mapped[str] = mapped_column(String, primary_key=True)
    domain: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[str] = mapped_column(String)
    owner_lab_id: Mapped[str] = mapped_column(String, index=True)
    data_classification: Mapped[str] = mapped_column(String)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    encrypted_payload: Mapped[bytes] = mapped_column(LargeBinary)
    price_usdc: Mapped[float] = mapped_column(Float, default=0.05)
    price_scicredit: Mapped[int] = mapped_column(Integer, default=50)
    accepts_barter: Mapped[bool] = mapped_column(Boolean, default=True)
    is_attested: Mapped[bool] = mapped_column(Boolean, default=False)
    quarantined: Mapped[bool] = mapped_column(Boolean, default=False)
    attestation_uid: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String)


class AttestationRecord(Base):
    __tablename__ = "attestation_records"

    attestation_uid: Mapped[str] = mapped_column(String, primary_key=True)
    slice_id: Mapped[str] = mapped_column(ForeignKey("data_slices.slice_id"), unique=True)
    merkle_root: Mapped[str] = mapped_column(String(64))
    report: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(String)


class BarterProposal(Base):
    __tablename__ = "barter_proposals"

    proposal_id: Mapped[str] = mapped_column(String, primary_key=True)
    party_a_lab: Mapped[str] = mapped_column(String)
    party_a_slice_id: Mapped[str] = mapped_column(ForeignKey("data_slices.slice_id"))
    party_b_lab: Mapped[str] = mapped_column(String)
    party_b_slice_id: Mapped[str] = mapped_column(ForeignKey("data_slices.slice_id"))
    status: Mapped[str] = mapped_column(String, default="PENDING_DUAL_SIGNATURE")
    canonical_agreement: Mapped[str] = mapped_column(Text)
    proposer_signature: Mapped[str | None] = mapped_column(String, nullable=True)
    target_signature: Mapped[str | None] = mapped_column(String, nullable=True)
    proposer_download_token: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    target_download_token: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    expires_at: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String)


class VaultLiquidity(Base):
    __tablename__ = "vault_liquidity"
    __table_args__ = (UniqueConstraint("slice_id"),)

    deposit_id: Mapped[str] = mapped_column(String, primary_key=True)
    slice_id: Mapped[str] = mapped_column(ForeignKey("data_slices.slice_id"))
    staker_address: Mapped[str] = mapped_column(String, index=True)
    minted_scicredit: Mapped[int] = mapped_column(Integer)
    remaining_scicredit: Mapped[int] = mapped_column(Integer)
    # Each redemption is slice-bound and returned only after PI signature verification.
    redemptions: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    created_at: Mapped[str] = mapped_column(String)
