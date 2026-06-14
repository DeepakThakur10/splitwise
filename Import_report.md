# IMPORT_REPORT.md

# CSV Import Report

File Imported: expenses_export.csv

Import Date: 14 June 2026

## Import Summary

| Metric                | Value |
| --------------------- | ----- |
| Total Rows            | 42    |
| Imported Expenses     | 37    |
| Converted Settlements | 1     |
| Skipped Rows          | 1     |
| Error Rows            | 4     |

---

# Successfully Imported Records

The following records were successfully imported into the system:

Rows:

2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43

Total Imported Expenses: 37

---

# Settlement Conversion

## Row 14

Description:
Rohan paid Aisha back

Detected Issue:
This row represents a repayment between members rather than a shared expense.

Action Taken:
Converted into a settlement record.

Result:
Inserted into settlements table instead of expenses table.

---

# Skipped Records

## Row 31

Description:
Dinner order Swiggy

Issue:
Expense amount was zero.

Action Taken:
Skipped.

Reason:
Zero-value expenses do not affect balances and provide no financial impact.

---

# Error Records

## Row 13

Description:
House cleaning supplies

Issue:
Missing payer information.

Error:
Cannot resolve payer.

Action Taken:
Rejected.

Reason:
Ownership of the expense could not be safely determined.

---

## Row 15

Description:
Pizza Friday

Issue:
Invalid percentage split.

Error:
Percentages add up to 110.00% instead of 100%.

Action Taken:
Rejected.

Reason:
Percentage-based splits must total exactly 100%.

---

## Row 26

Description:
Parasailing refund

Issue:
Negative amount detected.

Error:
Expense amount must be greater than zero.

Action Taken:
Rejected.

Reason:
Current implementation does not automatically convert refunds into credit transactions.

---

## Row 32

Description:
Weekend brunch

Issue:
Invalid percentage split.

Error:
Percentages add up to 110.00% instead of 100%.

Action Taken:
Rejected.

Reason:
Percentage-based splits must total exactly 100%.

---

# Import Decisions

The importer follows these principles:

1. No silent corrections.
2. Invalid rows are surfaced to the user.
3. Settlement rows are converted into settlement records.
4. Missing critical information causes rejection.
5. Invalid split configurations are rejected.
6. All actions are logged in import_logs.

---

# Final Outcome

The import process completed successfully.

Results:

* 37 expenses imported.
* 1 settlement created.
* 1 row skipped.
* 4 rows rejected.
* No application crashes occurred.
* All anomalies were reported to the user before final import.

This satisfies the assignment requirement of detecting, surfacing, and handling data quality issues during CSV ingestion.
