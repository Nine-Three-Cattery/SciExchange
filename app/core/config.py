"""Local configuration: the server knows PI public keys, never PI private keys."""

from dataclasses import dataclass, field
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


@dataclass
class Settings:
    state_dir: Path = field(default_factory=lambda: Path(os.environ.get("SCIEXCHANGE_STATE_DIR", str(ROOT / ".sciexchange"))))
    data_dir: Path = field(default_factory=lambda: Path(os.environ.get("SCIEXCHANGE_DATA_DIR", str(ROOT / "data" / "slices"))))
    database_url: str | None = None
    pi_public_keys: dict[str, str] | None = None
    cors_origins: list[str] = field(default_factory=lambda: os.environ.get("SCIEXCHANGE_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","))

    def public_keys(self) -> dict[str, str]:
        if self.pi_public_keys is not None:
            return self.pi_public_keys
        configured = os.environ.get("SCIEXCHANGE_PI_PUBLIC_KEYS")
        path = self.state_dir / "pi_public_keys.json"
        value = json.loads(configured) if configured else (json.loads(path.read_text()) if path.exists() else {})
        if not isinstance(value, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in value.items()):
            raise ValueError("PI public keys must map lab IDs to hexadecimal Ed25519 public keys")
        return value
