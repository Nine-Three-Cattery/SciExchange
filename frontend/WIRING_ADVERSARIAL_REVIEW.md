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
