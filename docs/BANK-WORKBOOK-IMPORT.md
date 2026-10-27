# Loading the bank's portfolio workbooks

HPMS can load the hydropower portfolio straight from the two workbooks the credit department already keeps.
They need no reformatting and no template:

| Workbook | What HPMS reads |
|---|---|
| Loan projection workbook (e.g. `Revised Projection_Ashad_2082_final.xlsx`) | Sheet `Disbursement_Ashad_2082`: one row per borrower (MW, CIF, limit, principal outstanding, remaining disbursement); the status from the row's fill colour; the quarterly projection (outstanding, repayment, disbursement tables). Sheets `Energy Bond`, `Net Loan with existing limit`, `New Loan Projection`, `Net Loan after New Loan`: bonds held, the bank's total loans and the regulator's minimum energy share, planned new limits. |
| Generation workbook (e.g. `Generation Details Compiled with Rate.xlsx`) | One sheet per plant: monthly contract energy, energy generated, revenue and PPA rate, in Bikram Sambat months. A borrower with two plants gets their sum. |

Nothing is invented. A field the workbooks do not carry (interest rate, maturity, COD, covenant terms) is left empty,
and a PPA rate a sheet does not give stays empty rather than being assumed.

## In the application (Admin, "Import bank workbooks")

1. **Read and check.** An administrator chooses both files. HPMS reads them and shows the reconciliation: the sum
   of the rows against each workbook's own total row (capacity, limit, outstanding), facilities by status against
   the workbook's legend, the projection, bonds, energy-financing inputs, planned new loans, generation, and any
   notes raised while reading. It also says what loading would replace. **Nothing changes yet.**
2. **Submit for approval.** Allowed only when the rows add up to the workbook's totals. The request names the
   files by their content hash, so only exactly what was checked can be loaded.
3. **Approve.** A checker recommends; **a different administrator** gives final approval (the default rule for
   `BANK_IMPORT`; an administrator can change it under Approval rules). On approval the portfolio is replaced:
   projects, loans, projections, generation, bonds and ratio inputs. Change requests about projects go with
   them. Users, settings, approval rules, bank-wide change requests and the audit log are kept.

The uploaded files are stored encrypted (the same key material as other secrets) until they are loaded. Every
upload and the load itself are written to the audit log.

### Turning it on

Off by default. Set on the bank's own server:

```
BANK_IMPORT_ENABLED=true
BANK_IMPORT_MAX_MB=20        # optional, per file
```

It stays off wherever `DEMO_RESET_ENABLED` is true (the public demo), and demo reset refuses to run on a
database that holds workbook data, so the two can never mix.

## From the command line (a database on this machine only)

```
python -m backend.scripts.import_bank_portfolio --projection <xlsx> --generation <xlsx>          # check only
python -m backend.scripts.import_bank_portfolio --projection <xlsx> --generation <xlsx> --apply  # load
```

The script refuses any database that is not on `localhost`. To go back to the synthetic portfolio:
`python -m backend.scripts.seed_realistic_data` and then `python -m backend.scripts.seed_test_workflows`.

## What the reconciliation can show

- **The legend and the colours disagree.** The status comes from each row's colour; the legend's counts are the
  analyst's own subtotals. A difference is shown side by side and does not stop the load; correct the colour
  or the legend in the workbook if one is wrong.
- **A total row differs from its rows.** Loading is refused until the borrower rows add up to the workbook's
  total for capacity, limit and outstanding.
- **Notes.** A row without a status colour (its status is then taken from its balances), a generation sheet that
  matches no borrower or more than one, a month label that could not be read, columns with figures but no
  quarter heading. Each note names the row or sheet.
