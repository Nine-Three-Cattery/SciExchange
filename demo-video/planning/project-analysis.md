# Project understanding and evidence

SciExchange is a scientific data exchange workspace for catalysis, battery research and scientific AI. It combines numerical scientific screening, provenance records, reciprocal exchange, independent PI consent and internal data-access credit. Its intended users need evidence beyond published successes without losing attribution or control over access.

Primary story source: `docs/presentation/index.html` (nine-slide English/bilingual deck). The user explicitly selected HTML, so no PowerPoint is required. Recording source: the existing React application with `VITE_DATA_MODE=mock`, not reconstructed mock screens.

| Claim | Classification and evidence |
| --- | --- |
| Compiler rejection, injection quarantine | Demonstrable simulated fixture: `frontend/src/mocks/fixtures.ts`, `frontend/e2e/workspace.spec.ts` |
| Attestation inspection | Demonstrable simulated records; mock field FORMAL_PROOF_VALID is a legacy fixture label, not proof of Lean execution |
| Proposal, one PI locked, two PI settlement | Demonstrable existing UI and mock adapter; clearly label simulated approval/settlement |
| Live Ed25519 verification and grants | Implemented: `app/core/security.py`, `app/services/barter_service.py`; explain architecture, do not claim this demo invokes live signing |
| Numerical scientific rules | `app/services/physics_compiler.py`, `docs/PHYSICS_RULES.md`; passing checks does not establish authenticity |
| Tafel and battery analytics | Real chart components, synthetic demo values, explicit units and confounder warning |
| Vault and marketplace | Demonstrable simulated internal credit, challenge, purchase and actual fixture-file download |
| Lean theorem proof / chain-anchored priority / causal discovery | Not demonstrated; do not claim |
| Valency, Marimo, Adaption | No verified integration found in inspected implementation; omit track claims |
| Presentation test totals | Historical acceptance records; not rerun for this production, omit numeric claims |

Architecture: React/Vite client, typed mock/live adapters, FastAPI gateway, SQLite transactions, numerical science services and local signature workflow. Demo requires only the frontend. The production Vite config redirects generated cache into `demo-video/.local/` and selects a separate port. No parent source edits, shared database writes or signing-key exposure.

Demo flow: catalog → reject synthetic adversarial slice → compile eligible fixture → provenance → propose → PI A lock → PI B simulated settlement → catalysis → battery range → causal warning → vault credit → marketplace challenge/purchase/download.

Presentation deviations: avoid the unsupported global 90/10 statistic; describe a file-drawer problem qualitatively. Do not treat resistance as a universal physical invariant. Do not call checks completed Lean proofs. A future independent deployment and stronger provenance integrations are explicitly future work.

Target production duration: 229 seconds, based on measured normal-rate narration plus reading pauses. All narration, graphics and subtitles English. Keep demo labels visible. No publication or competition submission is authorized by this request.
