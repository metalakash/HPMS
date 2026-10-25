# HPMS end-to-end tests (Playwright)

These drive the real app against the real backend. Nothing is mocked.

## Before running

1. Backend running where `HPMS_BACKEND_URL` in `frontend/.env.local` points (the Vite proxy target),
   migrated to head, with the demo accounts enabled (`DEBUG=true` or `ALLOW_DEV_AUTH=true`).
2. Seeded data, from the repository root:

   ```bash
   python -m backend.scripts.seed_realistic_data
   ```

   ```bash
   python -m backend.scripts.seed_test_workflows
   ```

Playwright starts the Vite dev server itself if it is not already running.

## Running

```bash
npm run test:e2e
```

```bash
npx playwright test 3-approvals.spec.ts
```

```bash
npm run test:e2e:report
```

`10-demo-reset.spec.ts` is skipped unless `E2E_DEMO_RESET=1`. It replaces every project, so run
it on its own (`E2E_DEMO_RESET=1 npx playwright test 10-demo-reset.spec.ts`), against a backend
started with `DEMO_RESET_ENABLED=true`. It leaves a fresh seed behind, which is also a quick way to
reseed the synthetic stack.

## Other browsers

`E2E_ALL_BROWSERS=1` adds Firefox and the installed Microsoft Edge to Chromium (RFP TECH B.2, B.4):

```bash
E2E_ALL_BROWSERS=1 npx playwright test --project=firefox --project=msedge
```

The suites that change shared records (approvals, covenant inputs, demo reset, user admin) run on
Chromium only, because three browsers at once would race each other over the same records.

## Other browsers

`E2E_ALL_BROWSERS=1` adds Firefox and the installed Microsoft Edge to Chromium (RFP TECH B.2, B.4):

```bash
E2E_ALL_BROWSERS=1 npx playwright test --project=firefox --project=msedge
```

The suites that change shared records (approvals, covenant inputs, demo reset, user admin) run on
Chromium only, because three browsers at once would race each other over the same records.

## What the suites write

`3-approvals.spec.ts` submits, approves and rejects real change requests. Every run adds two
requests and their audit entries, and moves one project's forecast COD. The other suites only read
(the CBS comparison changes nothing while the backend uses its mock adapter, and the import suite
stops at the preview).

## How the tests work

- `fixtures/auth.ts` signs in through `POST /api/v1/auth/login`, once per worker and account, and
  seeds `sessionStorage["hpms-auth"]`, the session the app's own auth store persists.
  - `authenticatedPage` / `api`: a page and an API client for the default account (`admin`, or
    `E2E_USERNAME` / `E2E_PASSWORD`).
  - `pageAs(name)` / `apiAs(name)`: the same for another demo account (`maker`, `approver`,
    `auditor`, `guest`), each page in its own browser context.
- Expected values are read from the API in each test rather than hard-coded, so the suites do not
  depend on a particular dataset.
- Locate things the way a user does: `getByRole`, `getByLabel`, table captions (`tableByCaption`).
- Workers are capped at 4 because every test shares one dev backend.
- `test.fixme` marks a known application defect; the comment above it says what to fix.

## Suites

| File | Covers |
|------|--------|
| `0-smoke-test.spec.ts` | redirect to login, sign-in form, wrong password, dashboard loads cleanly, sign out |
| `1-projects-workflow.spec.ts` | list, stage/province/status filters, combined and empty results, pagination, opening a project, loan/tranche/repayment tables, not-found |
| `2-project-tabs.spec.ts` | Generation & PPA, Hydrology, Land & governance and ESG tabs with and without data; CBS comparison |
| `3-approvals.spec.ts` | queue and state filter; propose → recommend → approve and apply with three accounts; rejection; who is offered what |
| `4-loan-import.spec.ts` | CSV preview and validation in the import dialog; admin only |

## Running against a separate, throwaway stack

The suite assumes the synthetic seed and writes to the database, so never point it at a database
that holds anything else. To run it beside a development database you want left alone:

1. Start a throwaway Postgres (this repository uses a private cluster in `.e2e-pg/`, ignored by
   git, on port 5544), create a database, and with `DATABASE_URL` set to it run
   `alembic upgrade head`, then `python -m backend.scripts.seed_realistic_data` and
   `python -m backend.scripts.seed_test_workflows`.
2. Start a backend on that database and a frontend in front of it on other ports. The
   `backend-e2e` (port 8002) and `frontend-e2e` (port 5174) entries in `.claude/launch.json` do
   this for a database at `127.0.0.1:5544/hpms_e2e`; `HPMS_BACKEND_URL` tells Vite where to proxy.
3. Run the suite at that frontend:

```bash
E2E_BASE_URL=http://localhost:5174 npx playwright test
```

`8-project-records.spec.ts` and `7-reports-regulatory.spec.ts` reload the page before checking
what they saved, because two defects (routes that never committed, a screen calling the wrong
address) passed every mocked test and only showed against the real backend.
