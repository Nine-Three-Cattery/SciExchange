# SciExchange frontend

Alan's React/Vite/TypeScript interface now connects to the FastAPI gateway in
this repository. The existing layout, bilingual interface, and explicit offline
mock mode are preserved. Live mode uses actual compiler reports, Ed25519
approvals, SQLite credit accounting, authorized downloads, and numerical analysis.
The backend includes eight manifest-backed slices (seven derived from published
experimental sources and one synthetic fault-injection slice), alongside five
legacy synthetic benchmarks. Source attribution and scientific limitations remain
visible; a live HTTP connection does not turn synthetic data into measurements.

## Run the integrated application

From the repository root, create a Python 3.11 environment, install both backend
and scientific dependencies, then start the backend:

```sh
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt -r backend/requirements-science.txt
python scripts/seed_slices.py
python scripts/setup_demo.py
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

See [the data integration guide](../docs/B_DATA_INTEGRATION.md) for manifest
import, admission, and reproducible scientific demo steps.

From `frontend/`, install with Node.js 22+ and pnpm, then select live mode:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Set `.env.local` to:

```dotenv
VITE_DATA_MODE=live
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
VITE_LAB_ID=lab_synthesis
```

Run `pnpm dev` and open http://127.0.0.1:5173. Vite uses a strict port so it cannot
silently move to an origin not allowed by the backend. If you choose another
port, configure `SCIEXCHANGE_CORS_ORIGINS` on the backend accordingly.
The API explorer is at http://127.0.0.1:8000/docs.

For offline fixtures use `VITE_DATA_MODE=mock` and restart Vite. Mock state and
credits remain visibly simulated. Live mode never falls back to mock success.
Live session reset clears browser workflow state; it does not reset the database,
credit balances or backend attestations.

## Signing without transmitting private keys

Live approvals display a **Sign authorization** dialog showing the exact
server-generated canonical message and the laboratory being asked to sign.
Copy that message to a local text file, review it, and sign it in another terminal
using the client key created by `setup_demo.py`:

```sh
# Run from the repository root, choosing the lab shown in the dialog.
.venv/bin/python frontend/scripts/sign_message.py \
  --lab lab_catalysis --message-file agreement.txt
```

Paste the returned hex signature into **Signature (hex)** and submit it. Use
`--key /absolute/path/to/client.pem` for a different local Ed25519 client key.
The helper signs the message bytes without JSON reserialization; only an editor's
trailing newline is removed. The browser receives a signature, never a private
key. Keys and download grants are not stored in local storage. The language
preference is the only persistent browser setting.

For barter, each PI signs the same `canonical_agreement` under its own identity.
A single approval does not unlock data. Both signatures must be accepted by the
backend, whose completed status is `DUAL_SIGNED_AND_EXECUTED`. Read-only proposal
polling retrieves the current state and each approved signer's scoped grant.
If an approval response is lost, the client retains the submitted proof for
authenticated recovery; only a server-confirmed approval changes the UI state.

For vault deposits and credit redemption, the frontend requests a fresh
`/vault/challenge`, displays its `canonical_message`, and submits the nonce and
signature to `/vault/deposit` or `/vault/redeem`. Challenges expire after five
minutes and can be consumed only once. A new challenge can safely retry a
completed operation without duplicate minting or charging.

## Live workflow

1. **Physics compiler:** select the combined OER violation and compile it. The
   backend reports FE 108.5%, resistance/current anomalies and injection alerts.
   The inspection catalog includes sanitized quarantined summaries; their data
   remains blocked. Compile the valid OER, battery, and dark-reaction slices.
2. **Provenance:** inspect the issued report through the read-only attestation
   endpoint. Scientific checks are numerical Python checks with Lean-style logs,
   not proofs executed by a Lean kernel.
3. **Data exchange:** review or change **Offered slice / Requested slice** before
   negotiating, then approve both PI roles through the signing dialog. The
   default pair has different owners. If a lab has not registered its PI key,
   choose another pair after the backend rejects it. Ownership comes from the
   real catalog. After switching laboratories, a participating PI can use
   **Restore exchange access** on a settled agreement to recover its own grant.
4. **Scientific analytics:** after obtaining access, view actual authorized
   samples and backend-computed Tafel/DTA or battery dQ/dV/knee results. A missing
   grant stays visibly locked. The supplied 100-cycle trajectory does not identify
   a future knee; the UI must not invent one.
5. **Data vault:** choose a compiled record from **Eligible failure-data slice**
   and deposit it as its owning lab. Each unique accepted failed experiment earns
   50 local SciCredit. Multiple eligible records can be deposited in turn; the
   displayed receipt belongs to the selected slice, while the wallet shows the
   lab's current server balance.
6. **Buy data:** request access, review the actual 402 price, and confirm redemption.
   Sign the server challenge to spend SciCredit. A successful payload must arrive
   before download is enabled. JSON deliveries preserve the original columns,
   text notes, and battery within-cycle samples.

Confirmed SciCredit debits update the ledger even if file delivery fails. Use
**Refresh access challenge** to retry delivery with the saved grant; the balance
is reconciled with the backend. For an owner's cached dataset, **Refresh owner
authorization** obtains a fresh short-lived signature without discarding the
download. Use it when owner-authorized server analysis has expired.
For a purchased cached file, **Refresh data authorization** checks server access.
If access has expired, **Renew data access** signs a fresh redemption challenge;
an existing paid entitlement renews without another debit. A file originally
obtained through barter is not itself a paid entitlement, so the dialog retains
the backend quote and explains that the quoted price may apply.
If a balance read fails after a confirmed deposit, the receipt remains recorded.
Use **Retry balance** in the vault or marketplace wallet to retry only the balance
query; this does not submit another deposit or request another PI signature.

The API base includes `/api/v1`. The live adapter uses `/slices`,
`/slices/{id}/attestation`, `/compiler/verify`, `/barter/negotiate`,
`/barter/dual-sign`, `/barter/proposals/{id}`, `/vault/challenge`, `/vault/deposit`,
`/vault/redeem`, `/vault/balance`, `/slices/{id}/download`, and `/analysis`.
See [the backend guide](../BACKEND_USAGE.md) for exact protocol semantics.

## Experimental source slices

The manifest-backed slices keep their original version, source attribution, units,
and missing values. `REVIEW_REQUIRED` is a scientific result, separate from human
admission. Select the owning demo lab, compile the slice, then use **Approve
admission** to sign the server challenge. The approved slice remains
`REVIEW_REQUIRED`; admission does not prove authenticity. Quarantined slices
cannot be admitted or exchanged.

Use the exchange selectors to choose `catalysis_nifec_tafel` and
`battery_b1c5_early`. After signing both exchange approvals, select either in
**Scientific analytics**. The Tafel panel retains the reported Ag/AgCl reference
and displays unavailable overpotential as **Not calculated**. The early-cycle
panel does not invent a knee or fitted breakpoint. Within-cycle battery slices
request only signed dQ/dV; cycle summaries request capacity and knee analysis.
An owner may also explicitly authorize a raw read before viewing an admitted
slice's analysis.

## Validation

All frontend commands run from `frontend/`:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:e2e:live
pnpm test:e2e:science
```

The live and science suites default to `../.venv/bin/python`. For an isolated
worktree, set `SCIEXCHANGE_E2E_PYTHON` to its Python executable; both the
backend launcher and the grant-expiry regression use this same interpreter.
For example: `SCIEXCHANGE_E2E_PYTHON=.cache/venv/bin/python pnpm test:e2e:live`.

The original E2E suite verifies offline demo behavior. The live suite launches
real FastAPI and Vite processes with isolated SQLite data and ephemeral PI keys.
The test process signs the exact displayed messages, pastes only signatures into
the browser, and checks real compiler, dual-sign, download, analytics and vault
results. It also deliberately loses a committed approval's response and
interrupts a post-redemption download to test recovery; no synthetic success
responses replace the gateway. Shared data and user keys are
not modified by the test harness. Artifacts remain in ignored frontend test and
cache directories.

The science suite adds the eight manifest slices only to its disposable test
state and checks signed admission, exchange, and experimental-source plots.
Its temporary client keys automate the signature protocol for testing; this is
not evidence of a human scientific review.

[ADVERSARIAL_REVIEW.md](ADVERSARIAL_REVIEW.md) records the earlier frontend-only
review before live integration; its statements about missing backend endpoints
are historical. This README describes the integrated behavior.
See [ADVERSARIAL_FIXES.md](ADVERSARIAL_FIXES.md) for the subsequent eight-finding
integration repair and its regression evidence.
