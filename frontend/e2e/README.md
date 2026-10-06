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
