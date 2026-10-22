"""Canonical agreement signing and encrypted payload storage."""

from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi import HTTPException


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def load_cipher(state_dir: Path) -> Fernet:
    state_dir.mkdir(parents=True, exist_ok=True)
    key_path = state_dir / "storage.key"
    try:
        with key_path.open("xb") as handle:
            os.chmod(key_path, 0o600)
            handle.write(Fernet.generate_key())
    except FileExistsError:
        pass
    return Fernet(key_path.read_bytes())


def verify_signature(public_keys: dict[str, str], address: str, signature: str, message: str) -> None:
    key = public_keys.get(address)
    if key is None:
        raise HTTPException(403, "The signer has no registered PI public key")
    try:
        key_bytes = bytes.fromhex(key.removeprefix("0x"))
        signature_bytes = bytes.fromhex(signature.removeprefix("0x"))
        Ed25519PublicKey.from_public_bytes(key_bytes).verify(signature_bytes, message.encode("utf-8"))
    except (ValueError, InvalidSignature) as error:
        raise HTTPException(403, "Invalid Ed25519 signature for this agreement and PI") from error


def vault_message(action: str, slice_id: str, address: str, content_root: str, price: int | None = None,
                  *, nonce: str, timestamp: str, expires_at: str) -> str:
    value: dict[str, str | int] = {"protocol": "SciExchange/v4", "action": action,
                                "slice_id": slice_id, "staker_address": address,
                                "content_sha256": content_root, "nonce": nonce,
                                "timestamp": timestamp, "expires_at": expires_at}
    if price is not None:
        value["price_scicredit"] = price
    return canonical_json(value)


def owner_access_message(slice_id: str, address: str, expires_at: str) -> str:
    """A bounded read credential, deliberately reusable for download and analysis."""
    return canonical_json({"protocol": "SciExchange/v4", "action": "owner_read",
                           "slice_id": slice_id, "owner_lab_id": address, "expires_at": expires_at})
