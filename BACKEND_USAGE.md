# SciExchange local gateway

This implementation follows the user's root-level layout and latest endpoint
names. The frozen design files are preserved. The integrated science environment uses Python 3.11,
SQLite and local cryptographic identities; no hosted database or model API is
required. Code uses Apache-2.0; attributed experimental-source slices retain their
own CC-BY-4.0 license and attribution. See [the scientific integration guide](docs/B_DATA_INTEGRATION.md)
for signed admission, versioned analysis, and the experimental-data demonstration.

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt -r backend/requirements-science.txt
python3 scripts/setup_demo.py
python -m pytest --import-mode=importlib tests backend/tests -q
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another terminal with the same virtual environment activated:

```bash
python3 scripts/demo_exchange.py
```

The demo checks positive and negative compilation, the HTTP 402 challenge,
single-signature blocking, both PI signatures, and both actual downloads.
Interactive API documentation is at `http://127.0.0.1:8000/docs`.

## Data and scientific meaning

`data/slices/` contains eight manifest-backed scientific slices (seven from
experimental sources and one synthetic fault-injection case), plus five legacy
synthetic benchmarks. Startup imports both into the same SQLite database.
Scientific slices preserve missing values and use `CHECKS_PASSED`,
`REVIEW_REQUIRED`, or `REJECTED`; PI admission is a separate signed record.
The seven experimental slices remain `REVIEW_REQUIRED` even after admission.
Their rules and source limitations are documented in [the science handoff](docs/B_SCIENCE_HANDOFF.md).

The following numerical protocol describes the five legacy benchmarks only,
each with a JSON document and CSV table. The battery dataset also contains
an independent within-cycle charge curve, in JSON and in a separate CSV.
They are realistic mathematical simulations, **not experimental records
downloaded from OC22 or Severson**. The metadata states the model, units,
seed, and provenance. Generated values must not be reported as experimental
findings or evidence for a universal 10/90 publication ratio.

The OER benchmark uses 1.229 V versus RHE, yielding approximately 240 mV at
10 mA/cm². The SHE Nernst model uses
`1.229 - 0.0591 * ((temperature_c + 273.15) / 298.15) * pH`;
the pH term is not applied twice to RHE measurements. FE and CE have a
strict 100% ceiling. The fixed scientific-quality thresholds belong to this
benchmark protocol. Raw product amount/charge and charge/discharge capacities
are recomputed where available; a reported-only FE is explicitly labeled.

DTA computes current derivatives and compares matched logarithmic slopes,
following [Corva et al. (2022)](https://doi.org/10.1021/acscatal.2c03581).
The derivative window selection is a documented deterministic implementation.
The knee model fits continuous bilinear capacity decay inside the observed
range. A flat early-life trajectory does not identify a future knee; the
result then contains `identified=false` and `knee_cycle=null`.

`FORMAL_PROOF_VALID` is the frozen wire status for passed numerical checks.
Lean-style logs are explicitly labeled as diagnostics; no Lean kernel was
invoked. SHA-256 attestation commits to the complete immutable JSON document.
A single-document Merkle tree has one leaf, so its root is that digest.
The priority timestamp is a local gateway timestamp, not an external timestamp
authority or a legal priority determination.

## API flow

All ordinary API responses use `code`, `message`, `data`, and `timestamp`.
Downloads return actual CSV or JSON. Malformed requests return 422;
scientific rejection returns 200 with `data.valid=false` and all failed rules.

1. `GET /api/v1/slices` lists safe summaries, with `domain`,
   `data_classification`, `is_attested`, and `owner_lab_id` filters.
   An explicit `include_quarantined=true` inspection view also lists sanitized
   summaries of blocked fixtures. It does not unlock their data. The combined
   FE/injection negative control remains intact for the compiler demonstration.
   Every summary includes `quarantined`, `provenance` and `verification_kind`,
   so the frontend can label synthetic data and numerical checks accurately.
   Inline metadata may set a nonnegative integer `price_scicredit` (default 50);
   catalog prices, payment challenges and actual debits use that same value.
2. `POST /api/v1/compiler/verify` accepts `{"slice_id":"slice_oer_valid"}`
   for a stored document, or a complete inline document using the generated
   JSON shape. Reusing an ID with changed contents returns 409. A new version
   requires a new slice ID. Minimal negative examples containing scientific
   metrics can still receive a rejection report without catalog ownership
   metadata; they are not registered or issued an attestation.
   `GET /api/v1/slices/{id}/attestation` reads an already issued report without
   recompiling the document or exposing its raw measurement table.
3. `POST /api/v1/barter/negotiate` accepts `party_a_lab`, `party_a_slice_id`,
   `party_b_lab`, and `party_b_slice_id`. Both documents must be attested,
   nonquarantined and offered by their declared owner. Both owners need distinct
   preconfigured PI public keys. The proposed pair expresses reciprocal demand;
   this endpoint performs deterministic eligibility checks, not an LLM chat.
4. Each PI signs the exact UTF-8 `canonical_agreement` string with Ed25519
   on the client. Submit `proposal_id`, `signer_role` (`pi_proposer` or
   `pi_target`), `signer_address` (registered lab ID), and hex `signature`
   to `POST /api/v1/barter/dual-sign`. Private-key fields are rejected.
5. One signature leaves the proposal pending. Both signatures commit
   `DUAL_SIGNED_AND_EXECUTED` and reciprocal grants in one SQLite transaction.
   Each response releases only that signer's `download_token`.
   Poll `GET /api/v1/barter/proposals/{proposal_id}` for current status,
   `proposer_signed`, `target_signed`, and `expired`. Anonymous polling never
   returns signatures or download tokens. An approved PI can retrieve its own
   grant through this GET using `X-PI-Address` and `X-PI-Signature`, reusing its
   signature over the original `canonical_agreement`; no new approval is made.
   Agreement and tokens expire one hour after negotiation.
6. Download the other side's slice using
   `GET /api/v1/slices/{id}/download` with `Authorization: Bearer <download_token>`
   or `X-Payment-Receipt: <download_token>`. `?format=json` includes the battery
   charge curve. Tokens are scoped to their specific slice; knowing a slice ID
   or signing only one side does not authorize access.
7. `POST /api/v1/analysis` accepts `slice_id` and `analysis_type`
   (`tafel_slope`, `dta`, `dq_dv`, or `knee_point`), with the same download
   authorization. Numerical parameters are fixed for legacy benchmarks.
   For manifest-backed slices, `version` is required, `capacity_fade` is also
   supported, and `parameters` is passed to the scientific method. Use the
   catalog's `analysis_methods` to select an applicable method. Scientific
   slices must first complete `/compiler/review-challenge` and `/compiler/review`;
   compilation alone does not grant admission.

Owners may read their own safe slices without purchasing them. The registered
PI signs `owner_access_message(slice_id, lab_id, expires_at)` from
`app.core.security`, choosing a UTC expiry no more than five minutes ahead,
and sends `X-PI-Address`, `X-PI-Signature`, and `X-PI-Expires-At`. This bounded
read credential is reusable during its lifetime and is bound to one slice.
Owner download supports safe uncompiled data; scientific analysis still
requires an active attestation (including separate PI admission for versioned scientific slices). Quarantine blocks owner downloads too.

The x402 response includes both architecture `x402-*` headers and
API-contract `X-Payment-*` headers. Settlement is **Local-Devnet**:
only grants issued by completed barter or actual local SciCredit redemption
are accepted. Arbitrary receipt strings are rejected. No on-chain USDC
transfer or external payment verification is represented as completed.

## Failed-data vault

Compile `slice_dark_reaction`, then request a server challenge:

```json
POST /api/v1/vault/challenge
{
  "action": "deposit",
  "slice_id": "slice_dark_reaction",
  "staker_address": "lab_synthesis"
}
```

The response contains `nonce`, `timestamp`, `expires_at`, and
`canonical_message`. The message binds the operation, signer, immutable slice
digest and redemption price, and expires after five minutes. Sign its exact
UTF-8 bytes with the client's Ed25519 key. Submit `slice_id`, `staker_address`,
`nonce`, and hex `signature` to `POST /api/v1/vault/deposit`. Each unique verified
failed-experiment slice earns 50 local SciCredit. The server derives eligibility
from the stored data; it accepts no caller-provided quality score for minting.

For a purchase, obtain a challenge with `action="redeem"` for the target slice
and submit the signed fields to `POST /api/v1/vault/redeem`. The challenge is
consumed in the same write transaction as the balance change. A consumed,
expired, unknown, or mismatched challenge returns 403; a challenge from a
different gateway database cannot authorize an operation. Old static vault
signatures without a nonce are no longer accepted.

To retry after a successful operation or a lost response, request a new challenge.
The unique deposit or purchased entitlement is reused without minting or
charging again. Download tokens expire after one hour; a fresh signed redemption
renews an expired paid grant at no additional cost. Token authorization queries
the indexed `download_grants` table instead of reading every deposit's JSON.

`GET /api/v1/vault/balance?address=lab_synthesis` returns the current aggregate
`staker_balance`, without exposing deposit records, signatures, or download grants.
Balances are public aggregate protocol state, consistent with the catalog's
public lab identities.

## Configuration and local state

- `SCIEXCHANGE_STATE_DIR`: SQLite, storage key and public-key registry
  (default `.sciexchange/`, ignored by Git).
- `SCIEXCHANGE_DATA_DIR`: seed documents (default `data/slices/`).
- `SCIEXCHANGE_PI_PUBLIC_KEYS`: optional JSON map of lab IDs to hex Ed25519
  public keys. Alternatively use `pi_public_keys.json` in the state directory.
- `SCIEXCHANGE_CORS_ORIGINS`: comma-separated frontend origins; defaults to
  `http://localhost:5173,http://127.0.0.1:5173`.

The demo key utility creates fresh local identities and refuses to overwrite
an existing identity. Client private keys remain under `.sciexchange/client_keys/`;
the server reads only the public registry. Encrypted database payloads use a
locally generated Fernet storage key. Keep the database and its storage key
together when retaining local state. Tests use temporary directories,
independent SQLite databases and ephemeral PI keys.

Existing local databases are preserved: startup creates the challenge/grant
tables and moves old JSON redemption entries into the grant table once, then
clears those entries. Existing balances and tokens are retained; old grants
keep their original unlimited lifetime. New grants use the bounded lifetime
above. This is a targeted import of the first local release's records, not a
general database migration framework.

CORS allows the actual payment and PI signature headers, irrespective of header
case. It exposes the x402 challenge and payment address to browser JavaScript.
Origins remain explicitly configured; arbitrary extra request headers are not
needed by this interface.

The CWC screen covers the named agent families and representative Schedule
1/2/3 terms and CAS identifiers; it is not an exhaustive chemical classifier.
Recognized instruction-like text is replaced with a quarantine marker.
There is no evaluator, shell execution, or LLM context concatenation in the
scientific-data processing path.
