# Wiring merge review

Integration branch: `wiring`, in an isolated managed worktree.

Parents: `main` at `62683f3a49d97c4a85cea152a8e95f5284f80e08` and
`origin/codex/b-data-integration` at `de19589bb47d7c245f79e9c431573e7dda309a14`.
Existing local branches and source remote branches were not changed.

## Conflict decisions and regression risks

- **BarterNegotiationCard:** retain main's different-owner filtering, selection
  recovery, and immutable display of an existing proposal. Apply the scientific
  branch's `isEligible` predicate so versioned records require human admission
  even when they have an attestation flag. Keep one pair of dataset selectors;
  combining both implementations verbatim would duplicate selectors and leave
  incompatible `offered`/`offers` variables. Update the science browser test to
  use the retained labels. A new component regression checks admitted scientific
  records, pending admission, different-owner filtering, and selector uniqueness.
- **PhysicsCompilerConsole:** retain main's safe own-property lookup and binding
  of an inline result to its exact submitted JSON. Also retain version-aware
  catalog requests and B's owner-only admission action. Changing JSON must not
  reuse a previous result, and switching inputs must not approve the wrong slice.
- **Automatic backend merge:** inspected compiler, schema and slice-service
  changes. Main's numeric JSON equivalence and original committed payload remain
  alongside B's versioned scientific importer and separate admission checks.
  No manual changes to backend, scientific data or shared specifications were made.
- **Test portability:** live renewal tests hardcoded `../.venv/bin/python`, so
  they failed in the isolated worktree before executing their expiry assertion.
  The launcher and expiry helper now both accept `SCIEXCHANGE_E2E_PYTHON`, with
  the existing default preserved. The executable path is shell-quoted by the
  launcher. This changes the test harness, not the application's access policy.

## Executed verification

- Frontend: all 153 tests in 17 files; TypeScript checking; ESLint; production build.
- Gateway and scientific modules: 363 tests passed using importlib collection.
- Research tooling: 9 tests passed.
- Mock browser suite: 12 passed on desktop and mobile (isolated port 5183).
- Live gateway browser suite: 5 passed, 1 intentionally skipped by its existing
  mobile setting. Covers independent PI signatures, purchases, delivery recovery,
  multiple deposits, identifier handling, and paid authorization renewal.
- Scientific browser suite: 1 passed against real FastAPI and isolated SQLite.
  Covers versioned admission, two-PI exchange, raw data authorization, Tafel,
  capacity and signed dQ/dV. It does not replace the server with mock responses.

Python 3.12 was used with `requirements.txt` and the science requirements.
Generated dependencies, keys, databases and browser evidence stay in ignored
frontend-owned paths. The only backend warning was the upstream Starlette/httpx
TestClient deprecation. These checks exercise local integration; they do not
establish production deployment, scientific truth or external payment settlement.
