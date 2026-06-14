# SCOPE.md

## Problem Statement

Build a SplitWise-like application capable of:

* Managing groups
* Tracking changing memberships
* Managing expenses
* Recording settlements
* Importing messy CSV data
* Explaining balances

---

# Database Schema

## users

id
name
email
password_hash

## groups

id
name
created_by
created_at

## group_members

id
group_id
user_id
joined_at
left_at

## expenses

id
group_id
description
amount
currency
fx_rate
paid_by
split_type
expense_date
notes
is_deleted

## expense_splits

id
expense_id
user_id
amount

## settlements

id
group_id
paid_by
paid_to
amount
settled_at
notes

## import_logs

id
group_id
filename
total_rows
imported
skipped
flagged
anomalies
imported_at

---

# CSV Anomalies Found

## Row 13

Issue:
Missing payer

Action:
Rejected

Reason:
Cannot determine ownership safely.

---

## Row 14

Issue:
Settlement logged as expense

Action:
Converted to settlement

Reason:
Represents repayment instead of shared spending.

---

## Row 15

Issue:
Percentages total 110%

Action:
Rejected

Reason:
Split must total 100%.

---

## Row 26

Issue:
Negative amount refund

Action:
Rejected

Reason:
Current system does not auto-convert refunds.

---

## Row 31

Issue:
Zero amount expense

Action:
Skipped

Reason:
No balance impact.

---

## Row 32

Issue:
Percentages total 110%

Action:
Rejected

Reason:
Invalid percentage split.

---

# Membership Rules

Members are included only if:

joined_at <= expense_date

AND

left_at IS NULL OR left_at >= expense_date

This prevents members from being charged before joining or after leaving.

---

# Import Results

Total Rows: 42

Imported: 37

Converted To Settlement: 1

Skipped: 1

Rejected: 4
