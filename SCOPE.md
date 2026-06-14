# Scope and Import Anomaly Log

This document records the product scope, database schema, and the anomaly policy used for importing the provided `Expenses Export.csv`.

## Product Scope

The app supports:

- Login and registration.
- Groups with membership history.
- Join dates and leave dates for members.
- Expenses in INR and foreign currencies.
- Split types: `equal`, `unequal`, `percentage`, `share`.
- Per-expense split rows for traceability.
- Group balance summaries.
- Suggested settlement payments.
- Settlement records.
- Two-phase CSV import: preview first, confirm later.

Out of scope for the current version:

- Real-time collaboration.
- Automatic bank/payment integration.
- Dynamic historical FX lookup.
- Full admin role model.
- Hard deletion of expenses; expenses are soft deleted.

## Import Policy

The importer does not silently guess. Each row receives a status:

- `ok`: safe to import.
- `flagged`: shown to the user for review before confirm.
- `skip`: not imported unless the user changes the status.

Anomalies are also tagged as:

- `error`: needs review or explicit policy.
- `auto_fixed`: deterministic normalization was applied and logged.

## Actual CSV Audit Summary

File tested: `E:\Download\Expenses Export.csv`

Parser result after current fixes:

- Data rows: 42
- Anomaly events: 23
- Row statuses:
  - `ok`: 29
  - `flagged`: 11
  - `skip`: 2

Detected anomaly counts:

| Code | Count | Policy |
| --- | ---: | --- |
| `DUPLICATE_EXPENSE` | 1 | Skip later duplicate by default, keep first row. |
| `COMMA_IN_NUMBER` | 1 | Strip commas and log auto-fix. |
| `EXTRA_DECIMAL_PLACES` | 1 | Round to 2 decimals and log auto-fix. |
| `PAYER_NAME_FIXED` | 1 | Fuzzy-match obvious name variant and log auto-fix. |
| `MISSING_PAID_BY` | 1 | Flag; cannot safely import without payer. |
| `SETTLEMENT_AS_EXPENSE` | 1 | Flag; import as settlement if approved. |
| `PERCENTAGE_NOT_100` | 2 | Flag; percentages must total 100%. |
| `CURRENCY_CONVERTED` | 4 | Convert to INR using documented FX rate and log auto-fix. |
| `UNKNOWN_SPLIT_MEMBER` | 1 | Flag; member must be mapped or excluded. |
| `CONFLICTING_DUPLICATE` | 2 | Flag both rows; user must choose correct row. |
| `NEGATIVE_AMOUNT` | 1 | Treat as refund/credit and import negative splits if approved. |
| `MISSING_CURRENCY` | 1 | Default to INR but flag for review. |
| `ZERO_AMOUNT` | 1 | Skip by default as placeholder. |
| `AMBIGUOUS_DATE` | 1 | Flag; user must confirm intended date. |
| `SPLIT_MEMBER_NOT_ACTIVE_ON_DATE` | 1 | Flag; member was not active on expense date. |
| `PAYER_NOT_ACTIVE_ON_DATE` | 1 | Flag; payer was not active on expense date. |
| `EQUAL_WITH_DETAILS` | 1 | Flag; split type conflicts with details. |
| `SPLIT_TYPE_OVERRIDDEN` | 1 | Override equal to share and log auto-fix. |

## Row-Level Anomaly Log

| CSV Row | Code | Handling |
| ---: | --- | --- |
| 6 | `DUPLICATE_EXPENSE` | Duplicate of row 5 after canonical description matching; skipped by default. |
| 7 | `COMMA_IN_NUMBER` | `"1,200"` normalized to `1200`. |
| 10 | `EXTRA_DECIMAL_PLACES` | `899.995` rounded to `900.00`. |
| 11 | `PAYER_NAME_FIXED` | `Priya S` matched to `Priya`. |
| 13 | `MISSING_PAID_BY` | Flagged; payer must be reviewed before import. |
| 14 | `SETTLEMENT_AS_EXPENSE` | Flagged; imported as settlement if approved. |
| 15 | `PERCENTAGE_NOT_100` | Flagged; split totals 110%, not 100%. |
| 20 | `CURRENCY_CONVERTED` | USD 540 converted to INR at rate 83. |
| 21 | `CURRENCY_CONVERTED` | USD 84 converted to INR at rate 83. |
| 23 | `CURRENCY_CONVERTED` | USD 150 converted to INR at rate 83. |
| 23 | `UNKNOWN_SPLIT_MEMBER` | `Dev's friend Kabir` is not a group member; flagged. |
| 24 | `CONFLICTING_DUPLICATE` | Conflicts with row 25 for Thalassa dinner. |
| 25 | `CONFLICTING_DUPLICATE` | Conflicts with row 24 for Thalassa dinner. |
| 26 | `NEGATIVE_AMOUNT` | Treated as USD refund/credit. |
| 26 | `CURRENCY_CONVERTED` | USD -30 converted to INR at rate 83. |
| 28 | `MISSING_CURRENCY` | Defaults to INR but remains flagged. |
| 31 | `ZERO_AMOUNT` | Skipped by default. |
| 32 | `PERCENTAGE_NOT_100` | Flagged; split totals 110%, not 100%. |
| 34 | `AMBIGUOUS_DATE` | Flagged because row note questions April 5 vs May 4. |
| 36 | `SPLIT_MEMBER_NOT_ACTIVE_ON_DATE` | Meera included after move-out; flagged. |
| 38 | `PAYER_NOT_ACTIVE_ON_DATE` | Sam paid before configured join date; flagged. |
| 42 | `EQUAL_WITH_DETAILS` | Equal split has share details; flagged. |
| 42 | `SPLIT_TYPE_OVERRIDDEN` | Split type changed to `share` for import calculation. |

## Database Schema

### `users`

Stores registered users.

- `id` primary key
- `name`
- `email` unique
- `password` bcrypt hash
- `created_at`

### `groups`

Stores expense groups.

- `id` primary key
- `name`
- `created_by` references `users(id)`
- `created_at`

### `group_members`

Stores group membership history.

- `id` primary key
- `group_id` references `groups(id)`
- `user_id` references `users(id)`
- `joined_at`
- `left_at`
- unique `(group_id, user_id, joined_at)`

This is the core table for Sam and Meera's requirement. Expenses and imports can compare expense dates to member active windows.

### `expenses`

Stores expenses in INR.

- `id` primary key
- `group_id`
- `description`
- `amount` stored in INR
- `currency` original currency label
- `fx_rate` conversion rate used
- `paid_by`
- `split_type`
- `expense_date`
- `notes`
- `is_deleted`
- `created_at`

### `expense_splits`

Stores one owed share per person per expense.

- `id` primary key
- `expense_id`
- `user_id`
- `amount`

This table supports Rohan's traceability request because every balance comes from concrete split rows.

### `settlements`

Stores direct payments between members.

- `id` primary key
- `group_id`
- `paid_by`
- `paid_to`
- `amount`
- `settled_at`
- `notes`
- `created_at`

### `import_logs`

Stores import reports.

- `id` primary key
- `group_id`
- `filename`
- `total_rows`
- `imported`
- `skipped`
- `flagged`
- `anomalies` JSONB
- `imported_at`

### `name_aliases`

Reserved for raw CSV name mappings.

- `id` primary key
- `raw_name` unique
- `user_id`

The current importer uses in-memory exact/first-name/fuzzy matching. This table is available for future persistent alias management.

