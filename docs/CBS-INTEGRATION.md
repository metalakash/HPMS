# Core banking integration

HPMS reads loan balances from a bank's core banking system (CBS). It never writes to it.

## How it is built

One adapter interface, four implementations, chosen by `CBS_ADAPTER`:

| `CBS_ADAPTER` | What it does | Needs from the bank |
|---|---|---|
| `mock` (default) | Answers with a built-in sample record. Shows the diff, never saves. | Nothing |
| `stub` | Refuses every call. For a deployment that must not sync. | Nothing |
| `file` | Reads the newest end-of-day extract in a directory. | A scheduled extract dropped on SFTP |
| `http` | Asks the bank's API for one account at a time (JSON or XML). | An inquiry endpoint and a credential |

The `file` and `http` adapters contain no bank-specific code. A **mapping file** (JSON) says where
each HPMS field is in the bank's data, how dates and signs are written, and what status codes
mean. Bringing on another bank, or another core banking product, is a new mapping file.

Code: `backend/app/integration/cbs_adapters.py` (adapters, mapping),
`backend/app/integration/finacle_adapter.py` (interface, circuit breaker, rate limiter, selection),
`backend/app/services/cbs_sync_real_service.py` (one loan on demand),
`backend/app/services/cbs_sync_service.py` (nightly batch). Examples: `backend/app/integration/mappings/`.

## Recommended sequence

**1. Proof of concept: file extract.** This is the fastest route with any bank because it asks
nothing new of the core banking system: the bank's IT team schedules a report it can already
produce and drops it where HPMS can read it. No API, no firewall rule towards the CBS, no
vendor involvement. Balances are as of the previous end of day, which is what covenant
monitoring needs.

**2. Production: add the HTTP inquiry** once the bank exposes account inquiry through its API
gateway or middleware. This gives the "Sync now" button a live answer. The nightly extract can
stay as the bulk refresh; the two adapters use the same mapping vocabulary.

## What to ask the bank for

For the file extract:

1. A sample extract (10-20 loan accounts, real layout, masked values are fine).
2. The column that holds the account number HPMS should key on, and whether it matches the
   account numbers already recorded in HPMS.
3. Sign convention: are loan balances reported as negative (debit) amounts?
4. Date format, delimiter, encoding, number format (thousands separators).
5. Which of these it can include: sanctioned limit, disbursed amount, outstanding principal,
   accrued interest, overdue principal, overdue interest, interest rate, rate reset date,
   maturity date, account status. Outstanding principal is the only one HPMS cannot do without.
6. Delivery: SFTP host and path, file naming, time of day, what happens on holidays.

For the HTTP inquiry, additionally:

7. The endpoint, a sample request and a sample response.
8. Authentication: API key, bearer token, basic auth or mutual TLS.
9. Network path (VPN / allow-listed IP) and the call volume it tolerates per day.
10. A test environment and two or three test accounts.

## Configuration

```
CBS_ADAPTER=file
CBS_MAPPING_FILE=/etc/hpms/bank-mapping.json
CBS_EXTRACT_DIR=/data/cbs-extracts
CBS_EXTRACT_MAX_AGE_HOURS=36        # refuse a stale file instead of presenting old balances as current
```

```
CBS_ADAPTER=http
CBS_MAPPING_FILE=/etc/hpms/bank-mapping.json
CBS_HTTP_BASE_URL=https://gateway.bank.example/api
CBS_HTTP_AUTH_HEADER=X-API-Key
CBS_HTTP_AUTH_VALUE=...             # secret: environment only, never in the mapping file or the repository
CBS_HTTP_CLIENT_CERT=/etc/hpms/client.pem   # only if the bank requires mutual TLS
CBS_HTTP_CLIENT_KEY=/etc/hpms/client.key
CBS_MAX_CALLS_PER_DAY=1000
```

Plain `http://` is refused unless `CBS_HTTP_VERIFY_TLS=false`, which is for a lab only.

## The mapping file

```json
{
  "name": "Example Bank nightly loan extract",
  "fields": {
    "finacle_account_id": "ACCT_NO",
    "outstanding_principal": "BAL_AMT",
    "interest_rate_pct": "INT_RATE",
    "maturity_date": "MAT_DT"
  },
  "date_formats": ["%d-%m-%Y"],
  "negate": ["outstanding_principal"],
  "thousands_separator": ",",
  "defaults": {"currency_code": "NPR"},
  "status_values": {"A": "ACTIVE", "C": "CLOSED"},
  "file": {"pattern": "loans_*.txt", "delimiter": "|", "encoding": "utf-8-sig"}
}
```

- `fields`: HPMS field -> column name (file) or path (HTTP). `finacle_account_id` and
  `outstanding_principal` are required. Leave out anything the bank does not supply.
- For HTTP, add an `http` block: `path` (may contain `{account_id}`), `format` (`json` or `xml`),
  `record_path` (where the account sits in the response), optional `method`, `headers` and
  `body_template` (may contain `{account_id}`, `{request_id}`, `{timestamp}`). JSON paths are
  dotted (`data.balances.principal`, list indexes allowed); XML paths are slash-separated tag
  names with namespaces ignored (`Body/LoanInqRs/Bal`).

The example files use invented layouts. **No real Finacle, Pumori or T24 format is assumed.**
With `CBS_ADAPTER=file` and no mapping file, HPMS falls back to the placeholder column names in
`FinacleFieldMapping`; replace it with the bank's real layout before relying on it.

## What a sync does

- Compares the fields in `CBS_OWNED` (disbursed amount, outstanding principal and interest,
  overdue principal and interest, interest rate, maturity date) and returns the diff.
- A field the bank does not supply is reported as `not_provided` and the local value is kept.
- Differences are written, an audit-chain entry records the before and after values, a rate
  change adds a rate-history row, and the project's covenants are re-tested.
- `dry_run: true` on `POST /api/v1/cbs/sync/{project_id}` compares without writing: use it to
  check a new mapping against real accounts.
- The nightly batch (`POST /api/v1/loan-accounts/sync`) updates accounts HPMS already holds.
  Accounts in the extract that HPMS does not hold are counted, not created: a loan is linked to
  a project when it is recorded in HPMS. Unreadable rows are returned as errors.
- `GET /api/v1/cbs/status` shows the adapter, the mapping name, the newest extract and its age,
  the circuit breaker and the rate limiter. It never shows credentials.

## Checking a bank's sample extract

Before connecting anything, run the checker on the sample file. It reads the file exactly as the
adapter would and writes nothing:

```
python -m backend.scripts.check_cbs_extract loans_sample.txt --mapping bank-mapping.json
python -m backend.scripts.check_cbs_extract loans_sample.txt --mapping bank-mapping.json --compare
```

It reports the rows read, each rejected row with the reason, which fields the extract supplies,
which synced fields it never supplies, and with `--compare` how the accounts line up with the
loans HPMS holds and how many a sync would change. Account numbers are shown by their last four
characters only.

## Running it every night

Create a sync schedule (`POST /api/v1/loan-accounts/sync-schedule`) with `sync_source`
`FINACLE_CBS`, a `frequency` of `daily` and a `scheduled_time_utc`. At that time HPMS reads the
configured adapter, updates the loans it holds, re-tests covenants, checks the schedule's alert
thresholds and records the run in the sync history. A schedule is refused, with the reason in its
history, while `CBS_ADAPTER` is `mock` or `stub`.

## Not done yet

- **No connection to a real core banking system has been tested.** The adapters are tested
  against invented layouts and a fake HTTP server.
- Fetching the extract over SFTP: HPMS reads a local directory; something else (the bank's
  transfer job, or a mounted share) has to put the file there.
- Repayment schedules and disbursement tranches are not synced, only account-level balances.
- Token refresh (OAuth client credentials) for the HTTP adapter: only static header credentials
  and mutual TLS are supported.
- Per-bank configuration is per deployment (environment variables). One deployment serving
  several banks would need the adapter chosen per tenant.
