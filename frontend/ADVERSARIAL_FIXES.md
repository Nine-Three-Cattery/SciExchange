# Integration review repairs — 2026-10-22

Baseline: `094309f`, branch `codex/feat-live-wiring`. This follow-up fixes the eight
confirmed integration findings without changing API routes, adding dependencies,
or introducing a new authentication or migration framework.

| Finding | Repair | Formal regression |
| --- | --- | --- |
| Nullable display metadata breaks the whole catalog | Validate title, summary, provenance and classification before persistence; reject invalid values with 422 and preserve absent-field defaults | `tests/test_frontend_integration.py`: invalid submissions leave catalog/DB unchanged and can be corrected using the same ID |
| Inspect opens another slice | Pass the clicked ID into the compiler and clear it on session reset | `tests/selection-binding.test.tsx`: cold and subsequent Inspect; live browser cold Inspect |
| Automatic barter chooses same-owner slices | Select an eligible complementary pair with different known owners | `tests/selection-binding.test.tsx`: skip the invalid first candidate; no proposal when no legal pair exists |
| Proposal cards drift after catalog refresh | Render existing agreement.offered/requested | `tests/selection-binding.test.tsx`: new earlier-sorting data cannot change existing cards |
| Lost PI POST response loses access recovery proof | Retain the sent proof on ambiguous failures, remove explicitly rejected proofs, recover grants using authenticated polling | `tests/recovery-regressions.test.tsx`; live E2E commits a real approval, drops its response, then verifies both domains are accessible |
| Debit succeeds but failed download leaves stale balance | Record the confirmed debit before file delivery, reconcile wallet on failure and successful retry | `tests/recovery-regressions.test.tsx`: wallet online/offline cases; live E2E interrupts the post-debit download and recovers at zero balance |
| Cached owner file hides reauthorization | Add Refresh owner authorization, forcing a fresh signature while retaining the file | `tests/recovery-regressions.test.tsx`: before/after expiry; live E2E signs a new canonical message despite a cached file |
| Derived 100% FE fails due to floating roundoff | Normalize only derived results within four ulps of 100; directly reported excess remains strict | `tests/test_compiler.py`: four charge magnitudes, real derived excess and the smallest representable reported excess |

## Validation

- Seed CLI: all five deterministic benchmark datasets regenerated; no data diff.
- Python backend and local signing helper: **203 passed** (202 backend + 1 helper).
- Frontend unit/component tests: **131 passed**, including 10 new regressions.
- Backend includes 15 new regression cases, for 25 new cases across both stacks.
- TypeScript, ESLint and production build: passed.
- Offline Playwright: **12 passed**, desktop and mobile. Used an ignored
  alternate-port configuration on 5180 so the ordinary preview on 5173 remained available.
- Live Playwright: **3 passed, 1 skipped**. The skip is the existing duplicate
  mobile full-protocol flow; desktop executes the protocol and both sizes execute
  responsive live-catalog checks.

The live E2E uses real FastAPI, SQLite, Ed25519 signatures, compiler outputs and
accounting. Fault injection drops a real approval response and fails a download;
it does not supply fake success data. An initial fault-injection matcher omitted
the download's `?format=json` query and therefore failed to inject the failure.
It was corrected to match the pathname and the workflow reran successfully.

Manual computer/browser interaction used a separate gateway on 8767 and Vite on
5175, with fresh synthetic fixtures, SQLite state and temporary PI keys under
ignored `frontend/.cache/adversarial-fixes/`. The user's ordinary database and
keys were not changed. Native clicks and browser controls confirmed:

- Cold Inspect opens and compiles the selected battery.
- The JSON editor rejects `summary:null`; correcting the same ID succeeds.
- A product/charge-derived FE of exactly 100% passes with a matching diagnostic.
- An earlier-sorting OER owned by the battery lab is skipped when proposing.
- Uploading another OER after negotiation leaves both proposal cards unchanged.
- An owner credential naturally expired at 10:37:37 UTC during this session.
  Battery analysis became locked; the cached file remained available. Refresh
  owner authorization obtained a new signature, and real dQ/dV and 100-cycle
  capacity analysis returned without reloading or clearing the session.

Local screenshot evidence is in ignored `frontend/output/playwright/`.
`fixes-proposal-bound.png` shows stable agreement cards;
`fixes-owner-expiry-recovered.png` shows restored analysis after natural expiry.
The skills used were the installed `practice-cognition` and `playwright`
workflows, with evidence-first review from `investigation-first` and
`criticism-self-criticism`. Existing dependency deprecation/color-environment
notices do not represent assertion failures. The fixtures remain synthetic,
and the compiler continues to report numerical checks rather than Lean-kernel proofs.

## Round two repairs

The subsequent review found six additional reachable cases. These are fixed on
top of the first eight repairs, preserving the existing page structure and API
routes. No new dependencies or CSS redesign were introduced.

| Finding | Repair | Regression evidence |
| --- | --- | --- |
| Lab round trip erases settled exchange grants | Participant-only Restore exchange access uses the current PI's saved proof with the existing status endpoint | `access-renewal.test.tsx`; full live protocol switches labs and restores battery access |
| Second failed experiment cannot be deposited | Native failure-slice selector and per-slice deposit results | `multi-slice-workflows.test.tsx`; real desktop/mobile flows independently deposit two records |
| Paid cached file has no access-renewal entry | Refresh data authorization displays the current challenge while retaining the file; Renew data access uses existing redemption | `access-renewal.test.tsx` checks expiry and rejected-signature retry; desktop/mobile real gateway renews an expired grant without another debit |
| Prototype-name ID crashes compiler | Both result lookups use existing getOwn | `compiler-identifiers.test.tsx`; browser compiles backend-accepted constructor ID in a fresh session |
| Unregistered PI candidate blocks other pairs | Offered/requested selectors allow changing the rejected pair before negotiation | Component regression plus real 403 then successful negotiation on desktop/mobile |
| Derived CE=98% rejected by roundoff | Normalize only derived values within four ulps of 98 | Three Python cases cover both calculation directions and true CE=97.999% rejection |

Final round-two verification:

- Seed CLI: five datasets generated, no data changes in Git.
- Python backend plus signing helper: **206 passed** (205 + 1).
- Frontend unit/component suite: **139 passed**.
- Offline desktop/mobile browser suite: **12 passed**.
- Live browser suite: **5 passed, 1 skipped**. The new repeated-use workflow runs
  on both desktop and mobile. The pre-existing duplicate mobile full-protocol
  case remains intentionally skipped.
- TypeScript, ESLint and production build: passed.
- Round two adds 11 unit/component cases and the two new live browser cases.

The paid-renewal E2E backdates only its test grant in the isolated SQLite fixture;
the real gateway rejects that expired token, verifies a fresh Ed25519-signed
challenge, rotates the token, and returns the unchanged balance. It does not wait
an hour or substitute a fabricated renewal response. Unit tests additionally
advance the client clock past its expiry and verify analysis recovery.

Native browser interaction against a separate gateway/Vite pair also confirmed
unregistered-pair rejection followed by successful reselection, deposits raising
the wallet from 0 to 50 to 100, per-slice receipts after switching selections, and
Chinese labels with workflow state preserved. The new evidence screenshot is
`frontend/output/playwright/round2-vault-two-deposits-zh.png`.

During test development, two RTL queries used an unsupported Playwright-only
option, and an exact-text E2E locator included the adjacent Retry button. Both
test issues were corrected and the affected checks rerun successfully. The
ordinary preview, database and keys were not used for these tests.
After validation, the ordinary port-8000 gateway was restarted to load the Python
fixes. Its health check passed, and direct before/after comparison confirmed that
all five catalog records and three laboratory balances were preserved.

## Bounded third review and final closure

The third review was limited to object/state correspondence, failure recovery,
and two complete demos on the same version and database. No new demo-blocking
issue was confirmed. Two consecutive real-browser runs preserved all three
attestation UIDs, created two different settled proposals, and kept the number
of vault deposits and paid grants at one each. Total minted credit stayed at 50:
balances were 0→50→0 on run one and 0→0→0 on run two. Both downloads contained
501 OER rows and both domains' analytics succeeded.

The one low-priority finding was a successful deposit followed by a failed
balance GET leaving no direct wallet retry. It is now fixed: confirmed deposits
remain successful, and an unavailable live wallet exposes **Retry balance** in
both the vault and marketplace. Read failures stay local to the wallet; retry
does not repeat the deposit or its signature challenge.

Final checks for this small frontend change:

- Three new `wallet-retry.test.tsx` regressions cover vault retry, marketplace
  retry, and repeated read failure before recovery. Each asserts one deposit,
  one challenge, one signature, and one ledger entry; retry sends only balance GETs.
- Frontend suite: **142 passed**; ESLint, TypeScript and production build passed.
- The real gateway protocol E2E now deliberately interrupts the balance GET
  after an actual successful deposit, then uses Retry balance to recover 50 SC
  while asserting exactly one deposit POST. Targeted run: **1 passed**.
- Backend code was unchanged by this final patch, so the previously verified
  206 Python tests were not repeated. The earlier full browser results remain
  recorded above; this last run is not presented as a rerun of those suites.

The repeated-demo result is retained locally under ignored
`frontend/.cache/round3-demo/results.json`. The ordinary preview and its database
were not used for fault injection. No additional broad audit was started.
