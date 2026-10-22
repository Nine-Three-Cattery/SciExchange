"""The external signing helper preserves canonical bytes and keeps keys local."""

import json
from pathlib import Path
import subprocess
import sys

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat


def test_client_helper_signs_exact_message_and_rejects_wrong_lab(tmp_path):
    key = Ed25519PrivateKey.generate()
    key_path = tmp_path / "client.pem"
    key_path.write_bytes(key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()))
    message = json.dumps({"protocol": "SciExchange/v4", "party_a_lab": "lab_catalysis",
                          "party_b_lab": "lab_battery", "proposal_id": "p1"},
                         separators=(",", ":"), sort_keys=True)
    message_path = tmp_path / "message.txt"
    message_path.write_text(message + "\n")
    script = Path(__file__).resolve().parents[1] / "scripts" / "sign_message.py"
    command = [sys.executable, str(script), "--lab", "lab_catalysis", "--key", str(key_path),
               "--message-file", str(message_path)]
    response = subprocess.run(command, text=True, capture_output=True, check=True)
    signature = bytes.fromhex(response.stdout.strip())
    key.public_key().verify(signature, message.encode())
    assert len(signature) == 64
    assert "PRIVATE KEY" not in response.stdout + response.stderr
    command[3] = "lab_unknown"
    denied = subprocess.run(command, text=True, capture_output=True)
    assert denied.returncode != 0
    assert "not a signer" in denied.stderr
    assert not denied.stdout
