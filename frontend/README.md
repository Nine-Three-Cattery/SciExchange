# SciExchange frontend

A bilingual (English / Simplified Chinese) Minimal Scientific Dashboard for Member C. React 18, Vite, TypeScript, Lucide, Recharts and Zod. Deliberately restrained dark panels, clear typography and muted scientific accents. Responsive navigation, native modal focus containment, keyboard controls and reduced-motion support are included. CSS is local; optional Google Fonts use system font fallbacks offline.

## Run

Use Node.js 22+ and pnpm. All commands run from `frontend/`:

```sh
pnpm install
pnpm dev
```

Open http://127.0.0.1:5173. No backend is needed in the default **mock** mode. All demo curves, metrics, attestations, timestamps, priority hashes, credits and authorization outcomes are simulated fixtures, not extracted benchmark measurements or cryptographic proofs. No signing key is collected or generated.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Tests live in `frontend/tests/` and `frontend/e2e/`; they never modify backend source or shared datasets. Browser tests cover desktop and mobile, complete scientific exchange flow, modal Escape, chart SVGs, responsive overflow, language selection and persistence, and full reset. Screenshots/traces are written into ignored `test-results/`.

## Operation modes

Copy `.env.example` to `.env.local` if needed. Default: `VITE_DATA_MODE=mock`. For integration:

```dotenv
VITE_DATA_MODE=live
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Restart Vite after changing environment values. The legacy `VITE_USE_MOCK=true|false` is supported when `VITE_DATA_MODE` is absent. Invalid mode configuration fails visibly. Live mode never falls back to simulated success. The configured API must permit the Vite origin through CORS. The sidebar reports configuration, not an unverified health claim.

## Workflow

1. Overview: filter/search metadata and inspect attestations.
2. Physics compiler: select fixture C and compile to show FE 108.2% rejection, resistance diagnostic and quarantined injection text. Compile A/B to inspect successful demo records. Full JSON submission is available for live verification; the browser validates input structure, not physics.
3. Provenance: select one of four record nodes and inspect source, slice, compiler or priority fields. The graph is a semantic view of the attestation record, not a fabricated instrument processing history. Rejected slices have no attestation chain.
4. Exchange: propose a reciprocal exchange, review its ID and exact slices, approve each Human PI separately. Release remains locked until the adapter returns `SWAP_COMPLETED`. Reopening the modal preserves authorization and settlement state.
5. Analytics: switch domains, hover for tooltips, toggle legend series, and use the chart brush for range selection. Every fixture series is labeled simulated. Units, metadata and a causal/confounder warning accompany the plots.
6. Vault and project overview: stake the eligible demo failure-data slice, inspect simulated credits, and view the repository and architecture. The six-scene walkthrough is accessible from any page. Reset clears the demo adapter and workflow.

## Contract boundaries and integration dependencies

This checkout contains design documents only; there is no backend implementation to validate against. `docs/API_CONTRACTS.md` takes precedence over conflicting endpoint examples elsewhere. Protected documents remain untouched.

| Operation        | Adapter behavior                                                                                                                                                                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog          | `GET /slices`, validates the frozen catalog shape.                                                                                                                                                                                                                                                                    |
| Compiler         | `POST /compiler/verify`, sends complete `slice_id`, `domain`, `metadata`, `columns`, `rows`. Renders violations and safety alerts as escaped text. Valid-success response requires confirmation of its diagnostics arrays and optional `attestation_uid`.                                                             |
| Attestation      | `GET /slices/{id}/attestation`, provisional response shape uses `AttestationReport` from `docs/BACKEND_ARCHITECTURE.md`; Member A must confirm the schema. Missing/mismatched records fail visibly.                                                                                                                   |
| Proposal         | `POST /barter/propose`, exact frozen fields; priority hash comes from the offered slice's returned attestation. Assumes at least `{proposal_id, status}` in the response; Member A must confirm. No agent signatures are inferred.                                                                                    |
| Human signatures | `POST /barter/{proposal_id}/dual-sign`, `{signer_role, signer_address, signature}`. Adapter supports an externally supplied signature, but live UI signing is disabled until a secure provider and agreement-bound signing payload are agreed. Never sends the private-key request shown in older architecture notes. |
| Settlement       | Only exact backend status `SWAP_COMPLETED` permits the confirmed UI state. Neither one approval nor two local approval flags unlock it. No data or keys are released by the browser.                                                                                                                                  |
| Analysis         | Live results intentionally unavailable until Member B confirms response schemas and the authorized-input flow. The frontend-only `Analytics` type is a normalized presentation interface, not a claimed backend contract. No speculative requests are sent.                                                           |
| Vault            | `POST /vault/stake-failure-data`, follows the frozen request and response; live mode requires user-supplied row count, quality score and staker address rather than fixture metrics.                                                                                                                                  |
| Reset            | `POST /demo/reset` is listed in the handover; its response data is unspecified. Requires a standard successful envelope. A failure leaves workflow state intact.                                                                                                                                                      |

The shared documents disagree about `/download` vs bare slice delivery, `/barter/dual-sign` vs proposal-specific signing, and `/vault/deposit` vs `/vault/stake-failure-data`. This implementation uses the proposal-specific signing and failure-data staking routes from the frozen API contract. It does not attempt protected delivery or invent receipt authentication. Health responses, rejection/cancellation endpoints, complete agent-signature records, secure signing provider, live analytics and backend E2E remain integration dependencies.

The HTTP layer validates response envelopes and payloads and handles network failures, a 12-second timeout, malformed JSON, 400/401/402/403/404/409/422 and 5xx errors. HTTP 402 is an access challenge, never data delivery. Compiler logs and metadata are rendered through React text nodes.

## Ownership

All implementation, dependencies, fixtures, tests, build configuration and documentation are contained in `frontend/`. No backend, data, shared contracts, root package files, Git configuration or other branch was modified. Existing untracked `AGENTS.md` is user-owned and preserved.

## Language selection

Use the language selector in the top bar to choose **English** or **中文**. English remains the default. The selection is saved under `sciexchange.language` in local storage, survives reload and demo reset, and falls back safely when storage is unavailable. Switching languages does not remount the workspace or reset protocol state. `html.lang`, the page title, navigation, dialogs, charts, accessible labels and local error copy update together.

Translations live in `src/i18n/zh.ts` and are applied only to presentation text. Backend diagnostics, JSON records, slice IDs, signatures, hashes, scientific units and unknown external text retain their original content. Chart legends translate their display formatter while keeping series identity intact for toggling. No API payload or endpoint changes with the selected language.
