"""Isolated gateway fixtures; ephemeral private keys remain on the client side."""

from __future__ import annotations

from collections.abc import Iterator
import json
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from fastapi.testclient import TestClient
import pytest

from app.core.config import Settings
from scripts.seed_slices import generate_slices


@pytest.fixture()
def pi_keys() -> dict[str, Ed25519PrivateKey]:
    return {
        lab: Ed25519PrivateKey.generate()
        for lab in ("lab_catalysis", "lab_battery", "lab_synthesis")
    }


@pytest.fixture()
def settings(tmp_path: Path, pi_keys: dict[str, Ed25519PrivateKey]) -> Settings:
    data_dir = tmp_path / "slices"
    generate_slices(data_dir)
    return Settings(
        state_dir=tmp_path / "state",
        data_dir=data_dir,
        database_url=f"sqlite:///{tmp_path / 'gateway.sqlite3'}",
        pi_public_keys={
            lab: key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw).hex()
            for lab, key in pi_keys.items()
        },
        cors_origins=["http://localhost:5173"],
    )


@pytest.fixture()
def documents(settings: Settings) -> dict[str, dict]:
    return {
        path.stem: json.loads(path.read_text())
        for path in settings.data_dir.glob("*.json")
    }


@pytest.fixture()
def client(settings: Settings) -> Iterator[TestClient]:
    from app.main import create_app

    with TestClient(create_app(settings)) as active:
        yield active
