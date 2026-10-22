# Adversarial review of wiring integration

Baseline: merge `92761f4` on `wiring`. This review examines the merge resolution
and the integrated frontend's trust boundaries, rather than assuming that the
previous successful demo proves those boundaries correct.

## Invariants derived from the workflow

1. A scientific result must describe the selected slice, domain, version and
   analysis method. Sending a pinned request does not prove that a response is pinned.
2. A PI's signature authorizes one concrete operation and context. A server
   challenge is untrusted input until its purpose and identity fields are checked.
3. Explicit blocking evidence takes priority over a weaker summary label.
   `REVIEW_REQUIRED` must not neutralize a failed check or quarantine alert.
4. Cached evidence is historical. It must not override a newer server revocation.
5. Settlement belongs to one proposal and requires consistent bilateral
   confirmation. Another proposal's status or contradictory flags are insufficient.
6. Retry repeats the failed operation, preserving the user's intent.

## Reproduced findings and fixes

| Priority | Finding and reproducible trigger | Consequence | Resolution |
| --- | --- | --- | --- |
| P1 | Admission challenge carries another slice, version, owner, action, protocol or expiry. The client previously forwarded it to the signing dialog. | User could be asked to sign a message unrelated to the selected admission. A healthy backend still rejects the mismatched submission; no private-key access or server bypass was demonstrated. | Validate the documented challenge envelope and canonical JSON context, digest shapes and rule identifier before presenting a signature request. Send the original canonical bytes unchanged. |
| P1 | Cache an approved report, then fetch a catalog with the same data version but revoked admission. | Both the API attestation cache and Dashboard result overlay could continue showing approval and enabling an acquisition attempt. The server still enforces current authorization. | Invalidate cached attestations when eligibility, UID or version changes. Drop versioned Dashboard reports that disagree with the newer catalog's trust fields. |
| P1 | Report says `REVIEW_REQUIRED` and claims admission while also containing failed checks, violated invariants or a quarantine alert. | The summary status could win over blocking details and make the frontend treat the data as eligible. | Blocking evidence wins; clear the derived admission/attestation state, refuse to cache a blocking report as an attestation, and reject it as successful human admission. Warnings and unchecked scientific conditions alone remain distinct from rejection. |
| P1 | Status response refers to another proposal, or says execution completed while one PI flag is false. | The frontend could mark the current exchange settled despite contradictory or unrelated evidence. | Check proposal identity in live signing, public polling and authenticated polling. Reject contradictory completion before caching grants. The UI reducer independently ignores another proposal and refuses contradictory completion. |
| P2 | Return an analysis for the correct slice/method but omit or change the response version. | Wrong-version metrics could appear under the selected version's metadata. | Preserve and compare the response version. Also reject a delivered document whose scientific domain differs from the selected catalog record. |
| P2 | Admission fails, then user clicks the inline retry button. | Retry invoked compilation instead of admission, changing the requested operation. | Track the failed operation and retry admission or verification accordingly. |

These findings group related counterexamples; they are not 22 independent bugs.
The first 15 counterexamples produced 14 failures before their fixes. Four
additional settlement counterexamples all failed before the settlement fix.
Three further regressions cover blocked attestation caching, wrong-domain
payloads and contradictory admission confirmation. All 22 now pass.

## Regression coverage and executed verification

`tests/wiring-adversarial.test.tsx` exercises these cases through the live API
adapter, Dashboard, compiler interaction and settlement state reducer. These
negative HTTP fixtures deliberately simulate incorrect or stale responses; they
are separate from the browser tests against a real gateway.

Two earlier positive fixtures were corrected to match the real backend contract:
scientific admission challenges now include the actual protocol/context fields;
scientific analysis responses include their version. The dual-sign route fixture
now includes its proposal ID and returns a fresh Response object for the ensuing
status query. Those changes do not weaken assertions or alter backend contracts.

Final verification:

- 175 frontend tests in 18 files, including the 22 adversarial regressions.
- TypeScript checking, ESLint and production build.
- 363 gateway/scientific module tests (isolated fixtures, no backend edits).
- 12 mock desktop/mobile browser tests.
- 5 live gateway desktop/mobile tests; 1 existing intentional mobile skip.
- 1 scientific browser workflow using real FastAPI, versioned data, PI admission,
  independent exchange signatures and authorized scientific analysis.

Only `frontend/**` was changed. Existing styling, backend implementation, shared
scientific data/specifications, `main`, `frontend` and the source science branch
were preserved. Test dependencies, generated keys, databases and browser evidence
remain under ignored frontend directories in the managed wiring worktree.

## Limits

The 22 new unit/component cases demonstrate client behavior under deliberately
bad responses; they do not establish that the healthy gateway emits them.
The revocation fix takes effect when a newer catalog is fetched; no push-based
revocation protocol exists here, and cached downloaded files are not remotely
erased. The backend remains responsible for every actual authorization,
cryptographic check and data release. This review does not claim scientific
truth, Lean proof, production security or external payment settlement.

No reproduced finding above remains open. Backend tests retain the upstream
Starlette/httpx TestClient deprecation warning. Broader scientific validation and
production service review remain outside this frontend merge audit.

## Overview admission refresh follow-up

The follow-up against `4e27567` reproduced one remaining entrypoint mismatch:
the full analysis page refreshed admission before analysis, but Overview's
compact chart did not. A second session could approve a slice while the first
kept a valid owner credential; Overview Retry remained locked against its cached
pending state. Both live views now refresh the catalog before analysis.

The three refresh-order tests now cover both compact and full views (six cases).
Two existing tests count the required new catalog read relative to the operation,
instead of assuming that only Dashboard reads the catalog. The real science E2E
now reads raw data in one session, admits it in a second, and verifies that the
first Overview retry renders 76.11 mV/dec without another owner signature.

Final frontend verification: **181 tests passed**, default ESLint, TypeScript and
production build passed, and the real scientific browser workflow passed.
The existing `.vite/` generated cache is excluded from frontend Git/ESLint scans;
no generated dependency code was edited or deleted.

The ordinary local gateway was started with the existing command to load the
merged scientific modules. Health and admission endpoints are available, with
13 slices including eight versioned records. Direct before/after comparison
confirmed that the original five slice states, balances, attestation counts and
transaction counts were preserved. Backend source and shared scientific files
were not modified by this follow-up.

## Cross-page catalog and narrow-screen follow-up

The subsequent interaction stress review at `4c2e69f` confirmed two remaining
frontend defects. Both are repaired with local changes:

- Analysis refresh previously updated only its own catalog and the API cache.
  Dashboard now shares its existing catalog-update and stale-report cleanup
  callback with both analysis views. A fresh admission or revocation therefore
  updates catalog labels, marketplace eligibility and barter candidates together.
- The scientific warning text now allows flex shrinking and long-word wrapping.
  The actual backend warning identifier remains visible without expanding a
  390px page beyond its viewport. No warning is suppressed or shortened.

Four new client/Dashboard regressions cover new admission and revoked admission
from Overview and full analysis, including removal of an older approved report.
The real science browser test performs all admissions in a second window, then
checks the first window's catalog, purchase button and successful exchange
without recompilation. It also measures document and warning boundaries at
390px after the existing responsive transition settles.

Validation: **185 frontend tests passed**; default ESLint, TypeScript and the
production build passed; **1 real scientific browser workflow passed**. Its
`science-mobile-warning-wrapped.png` screenshot records the corrected narrow
layout. The ordinary 5173 frontend and 8000 gateway both remained healthy.
Backend code, scientific data, dependencies and API routes were unchanged.
