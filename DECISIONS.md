# Decision Log

This file records significant product and engineering decisions made for the shared expenses app.

## 1. Use PostgreSQL as the only database

Options considered:

- SQLite for local simplicity.
- MongoDB/document storage.
- PostgreSQL.

Decision:

Use PostgreSQL.

Why:

The assignment requires relational databases only. The domain is naturally relational: users, groups, memberships, expenses, split rows, and settlements all need joins and transactional writes. PostgreSQL also works well with Neon for deployment.

## 2. Store expenses in INR, preserve original currency metadata

Options considered:

- Store all amounts exactly as entered and convert during balance calculation.
- Store all amounts in INR after conversion.
- Store both original and converted amounts separately.

Decision:

Store `expenses.amount` in INR, while also storing `currency` and `fx_rate`.

Why:

Balance calculations stay simple and consistent. The original currency and conversion rate remain auditable for Priya's USD concern. The importer logs each conversion.

Tradeoff:

The exact original foreign amount is not stored as a separate numeric column. It can be inferred as `amount / fx_rate`, but a future version could add `original_amount`.

## 3. Use a fixed FX rate for CSV import

Options considered:

- Use live historical exchange-rate API.
- Ask the user to enter a rate during import.
- Use a documented fixed rate.

Decision:

Use a fixed USD rate of `83` for the provided assignment import.

Why:

The app needs deterministic results for review and live evaluation. A live API would make the same CSV produce different balances over time or fail offline.

Tradeoff:

This is not a financial-grade historical FX source. It is documented and visible in the anomaly report.

## 4. Two-phase CSV import

Options considered:

- Import immediately and reject bad rows.
- Import immediately and silently fix obvious problems.
- Preview, surface anomalies, then confirm.

Decision:

Use preview and confirm.

Why:

The assignment explicitly requires detecting and surfacing problems. Meera also asked to approve deletes/changes. A preview gives the user control before the database changes.

## 5. Keep duplicate rows user-reviewable

Options considered:

- Delete duplicates automatically.
- Keep every duplicate.
- Skip exact/fuzzy duplicates by default but show them before import.

Decision:

Set duplicate rows to `skip` by default and show them in the anomaly list.

Why:

It prevents obvious double-counting while still giving the user visibility and the option to change the row status.

## 6. Flag conflicting duplicates instead of choosing a winner

Options considered:

- Keep the first row.
- Keep the larger amount.
- Keep the row whose note says another is wrong.
- Flag both rows.

Decision:

Flag both conflicting rows.

Why:

Choosing a winner would be a silent guess. The CSV includes examples where descriptions differ but refer to the same dinner with different amounts. That requires human approval.

## 7. Represent membership as dated rows

Options considered:

- Boolean active/inactive membership.
- Separate current membership table and audit table.
- Single `group_members` table with `joined_at` and `left_at`.

Decision:

Use one `group_members` table with join and leave dates.

Why:

Sam and Meera's requirements depend on whether someone was active on the expense date. A dated membership record directly supports that.

## 8. Store expense splits as rows

Options considered:

- Store split details as JSON on the expense.
- Recalculate splits every time from original inputs.
- Store one row per expense/person share.

Decision:

Store `expense_splits`.

Why:

Rohan wants to trace balances to the exact expenses that created them. Split rows make balance math explainable and queryable.

## 9. Balance formula

Decision:

For each user:

```text
net = total_paid - total_owed - settlements_paid + settlements_received
```

`net > 0` means the user should receive money. `net < 0` means the user owes money.

Why:

This matches the standard shared-expense accounting model and is easy to walk through manually.

## 10. Settlement suggestion algorithm

Options considered:

- Pair every debtor with every creditor.
- Greedy minimum cash-flow settlement.
- Optimization solver.

Decision:

Use greedy minimum cash flow: largest debtor pays largest creditor until balances are zero.

Why:

It produces a small set of understandable transactions, matching Aisha's request for "who pays whom, how much."

## 11. Negative CSV amounts are refunds

Options considered:

- Reject all negative amounts.
- Convert negative expenses into settlements.
- Treat negative amounts as credits/refunds.

Decision:

Treat negative CSV amounts as refunds/credits and keep the sign in import.

Why:

The CSV explicitly includes a cancelled slot refund. Rejecting it would lose real data. Treating it as a negative shared expense reduces balances correctly.

## 12. Keep manual expense creation stricter than CSV import

Decision:

Manual expense creation rejects non-positive totals. CSV import has special handling for historical refunds.

Why:

Manual input should prevent accidental bad data. Historical import needs deliberate exceptions because the source file already contains messy but meaningful records.

## 13. Frontend style direction

Options considered:

- Dark glassmorphism UI.
- Landing-page-style UI.
- Quiet finance/product UI.

Decision:

Use a restrained product UI with lighter surfaces, clearer typography, and green accents.

Why:

The app is a work tool for reviewing balances and anomalies. The UI should prioritize clarity over decoration.

