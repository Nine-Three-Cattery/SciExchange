"""Create local PI demo identities; private keys stay in local client files.

Usage: python3 scripts/setup_demo.py [--state-dir .sciexchange]
Run before starting the gateway, whose configuration reads only public keys.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat, PublicFormat, load_pem_private_key

ROOT = Path(__file__).resolve().parents[1]
LABS = ("lab_catalysis", "lab_battery", "lab_synthesis")


def setup_identities(state_dir: Path) -> dict[str, str]:
    directory = state_dir / "client_keys"
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    public_path = state_dir / "pi_public_keys.json"
    registered = json.loads(public_path.read_text()) if public_path.exists() else {}
    public_keys = dict(registered)
    for lab in LABS:
        path = directory / f"{lab}.pem"
        if path.exists():
            key = load_pem_private_key(path.read_bytes(), password=None)
            if not isinstance(key, Ed25519PrivateKey):
                raise ValueError(f"The client key for {lab} is not Ed25519")
        else:
            if lab in registered:
                raise ValueError(f"{lab} is already registered but its local client key is absent; refusing key rotation")
            key = Ed25519PrivateKey.generate()
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()))
        public_key = key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw).hex()
        if lab in registered and registered[lab] != public_key:
            raise ValueError(f"The registered public key for {lab} does not match its local client key")
        public_keys[lab] = public_key
    public_path.write_text(json.dumps(public_keys, indent=2) + "\n")
    return public_keys


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-dir", type=Path, default=ROOT / ".sciexchange")
    args = parser.parse_args()
    public_keys = setup_identities(args.state_dir)
    print(f"Registered {len(public_keys)} public PI identities at {args.state_dir / 'pi_public_keys.json'}")
    print(f"Client private keys remain in {args.state_dir / 'client_keys'}; never upload these files.")


if __name__ == "__main__":
    main()
