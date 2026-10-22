# Interactive browser and desktop review — 2026-10-22

Baseline: `23272de` on `codex/feat-live-wiring`.

This review used the locally installed `playwright` and `practice-cognition`
skills, native Chrome mouse/keyboard input through computer use, and live
browser locators, accessibility snapshots, screenshots, and developer input
controls. It did not substitute HTTP mocks for the manual workflows.

A separate FastAPI instance on port 8767 and Vite on 5175 used generated
scientific fixtures, a separate SQLite database and ephemeral PI keys under
`frontend/.cache/interactive-*`. The ordinary preview's database was not reset.
Only signatures entered the browser; signing keys stayed in the local helper.

## Confirmed defects and repairs

1. **Keyboard activation:** the four Overview pipeline cards accepted mouse
   clicks but ignored Enter and Space. They now use native buttons. Both keys
   were retested on the actual page.
2. **Stale editor proof:** switching from a verified catalog slice to JSON or
   editing an already verified JSON document left the previous Verified badge
   and attestation visible, even beside an invalid-JSON error. The editor now
   binds results to the exact successful submission and clears its local
   result when the input or mode changes. Existing catalog records are retained.
3. **Stale lab analysis:** switching Active lab cleared credentials but left the
   prior laboratory's chart visible. Analysis components now remount by lab
   identity; the old chart disappears and the new identity is checked again.
4. **Equivalent browser JSON rejected:** submitting an unchanged seed document
   through the browser changed JSON number spellings such as `25.0` to `25`,
   causing a false immutable-ID conflict. Existing documents now compare JSON
   values with exact structure and scalar semantics, allowing equal int/float
   numbers while distinguishing booleans and strings. Compilation and receipts
   use the saved document, preserving the original downloaded bytes' canonical
   SHA-256 root. True data changes still return 409.
5. **Incomplete network recovery:** after a real QA backend stop, Clear session
   and Retry restored the catalog but left the wallet unavailable. Explicit
   catalog reload now refreshes the wallet too; background compiler refreshes
   avoid redundant wallet reads. A second actual stop/restart recovered all
   three attestations and the real 50-credit balance with one Retry.
6. **Live copy used a mock value:** the Overview checkpoint claimed 108.2% in
   live mode despite the actual 108.5% negative control. Live text now describes
   the conservation check without inventing a submitted measurement.
7. **Incomplete Chinese labels:** live node states, accessibility labels,
   signature purposes and several pipeline labels were untranslated. App-owned
   labels are translated; laboratory identifiers, protocol messages and original
   scientific records remain unchanged.
8. **Warning after completed purchase:** spending the last 50 credits showed
   both delivery success and an insufficient-balance warning. The warning now
   applies only before delivery; it still appears for an unfunded new request.

## Actual interaction coverage

- Enter/Space versus native mouse activation, then post-fix keyboard navigation.
- Combined FE=108.5%/resistance/current/injection rejection and CWC rejection.
- Successful OER, battery and failed-hydrothermal compilation.
- JSON parse failure, immutable-content conflict, unchanged browser JSON
  resubmission, and preservation of the original attestation UID.
- Signature cancellation with Escape, malformed signature input, cryptographically
  invalid signatures, retry, independent valid PI approvals and server settlement.
- Owner-signed reading of battery measurements without spending credit.
- Actual browser downloads: battery JSON contains 100 cycle rows and 401
  within-cycle rows; OER JSON contains 501 rows with text Notes preserved.
- Real Tafel and dQ/dV rendering; hover reported 3.425 V and 26.174 Ah/V;
  dragging the cycle brush changed the visible range from 1–100 to 28–100;
  clicking the legend hid and restored the phase curve.
- Lab switching removes the previous chart immediately after the fix.
- Live vault deposit raised balance from 0 to 50; redemption returned it to 0.
  Reloading then signing a fresh challenge recovered the paid entitlement at
  zero balance without another debit.
- Chinese/English switching during workflows, search and domain filtering,
  empty-search recovery, mobile navigation, and 390px/768px/default desktop
  viewports. Temporary viewport overrides were reset afterward.
- Real backend shutdown and restart, explicit error display, Retry recovery and
  persistence of credits and attestations. No mock fallback was observed.

## Regression results

- TypeScript, ESLint and production build: passed.
- Frontend unit tests: 121 passed.
- Python backend plus local-signing helper tests: 188 passed.
- Offline browser suite: 12 passed, using a temporary alternate-port config so
  the ordinary preview on 5173 stayed available.
- Live browser suite: 3 passed; one intentionally duplicated full-flow mobile
  case skipped. Full protocol ran on desktop; desktop and mobile layout cases ran.
- Existing Starlette/httpx and Playwright color-environment notices remain;
  there were no final assertion failures.

## Local evidence

Screenshots are local, ignored artifacts under `frontend/output/playwright/`:

- `stale-json-before.png` and `json-edit-fixed.png`
- `stale-lab-chart-before.png` and `lab-switch-fixed.png`
- `browser-json-roundtrip-fixed.png`
- `backend-offline.png` and `network-wallet-recovered.png`
- `interactive-battery-chart.png`
- `mobile-purchase-fixed.png` and `mobile-marketplace-zh.png`
- `interactive-final-analytics.png`

The manual exercise used synthetic benchmark data. Numerical protocol checks,
local credit settlement and browser interaction results are not claims of a
Lean-kernel proof, real experimental provenance or universal security coverage.
