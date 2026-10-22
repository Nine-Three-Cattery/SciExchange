"""Contracts and storage foundations used by every route."""

import pytest
from pydantic import ValidationError
from sqlalchemy import inspect

from app.core.security import canonical_json, load_cipher
from app.database import Base, make_engine
from app.models import models
from app.models.schemas import CompilerRequest, DualSignRequest, SampleTable


def test_database_has_four_protocol_tables():
    engine = make_engine("sqlite://")
    Base.metadata.create_all(engine)
    assert set(inspect(engine).get_table_names()) == {
        "data_slices", "attestation_records", "barter_proposals", "vault_liquidity"}
    engine.dispose()


def test_encryption_survives_restart(tmp_path):
    payload = b"private scientific measurement"
    encrypted = load_cipher(tmp_path).encrypt(payload)
    assert payload not in encrypted
    assert load_cipher(tmp_path).decrypt(encrypted) == payload


@pytest.mark.parametrize("bad", [{"private_key": "never-upload"}, {"signature": 123}, {"signer_role": "admin"}])
def test_dual_sign_rejects_private_keys_and_wrong_types(bad):
    request = {"proposal_id": "p1", "signer_address": "lab_catalysis", "signature": "a"}
    request.update(bad)
    with pytest.raises(ValidationError):
        DualSignRequest.model_validate(request)


@pytest.mark.parametrize("columns,rows", [(["v", "v"], [[1, 2]]), (["v"], [[1, 2]]), (["v"], [[True]]), (["v"], [[float("nan")]])])
def test_invalid_sample_tables(columns, rows):
    with pytest.raises(ValidationError):
        SampleTable(columns=columns, rows=rows)


def test_partial_inline_document_cannot_silently_load_stored_data():
    with pytest.raises(ValidationError):
        CompilerRequest(slice_id="s1", metadata={"faradaic_efficiency": 99.2})
    assert CompilerRequest(slice_id="s1").metadata is None


def test_canonical_serialization_is_order_independent():
    assert canonical_json({"b": 2, "a": 1}) == canonical_json({"a": 1, "b": 2})
