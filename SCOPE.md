# SCOPE.md

## Project Scope

Build a shared expense application capable of handling:

* Changing group memberships
* Multiple split strategies
* Multi-currency expenses
* CSV import with anomaly detection
* Debt settlement tracking

---

# CSV Anomaly Log

The provided CSV contains deliberately messy data.

## 1. Duplicate Expense

Example:

* Dinner at Marina Bites
* dinner - marina bites

Detection:

* Similar description
* Same amount
* Same date
* Same payer

Policy:

* Flag for user approval

Action:

* User chooses which record to keep.

---

## 2. Settlement Recorded as Expense

Example:

* Rohan paid Aisha back

Detection:

* Settlement keywords detected

Policy:

* Convert into settlement record

Action:

* Imported into settlements table.

---

## 3. Negative Amount

Example:

* Parasailing refund

Detection:

* Amount < 0

Policy:

* Treat as refund

Action:

* Imported as negative expense.

---

## 4. Zero Amount Expense

Example:

* Dinner order Swiggy

Detection:

* Amount = 0

Policy:

* Flag for review

Action:

* User approval required.

---

## 5. Missing Payer

Example:

* House cleaning supplies

Detection:

* Empty payer field

Policy:

* Flag

Action:

* User must resolve.

---

## 6. Name Variations

Examples:

* Priya
* priya
* Priya S

Detection:

* Alias matching

Policy:

* Auto-fix

Action:

* Map to canonical user.

---

## 7. Currency Conversion

Example:

* Goa Trip Expenses

Detection:

* Currency = USD

Policy:

* Convert using FX rate.

Action:

* Store normalized INR amount.

---

## 8. Membership Violation

Example:

* Expense includes Sam before joining date

Detection:

* Membership history validation

Policy:

* Flag

Action:

* User approval required.

---

## 9. Former Member Included

Example:

* Meera charged after leaving

Detection:

* Expense date after left_at

Policy:

* Flag

Action:

* User approval required.

---

## 10. Split Percentage Not Equal To 100

Detection:

* Percentage total != 100

Policy:

* Reject

Action:

* Flag as error.

---

## 11. Share Split With Invalid Shares

Detection:

* Share total <= 0

Policy:

* Reject

Action:

* Flag as error.

---

## 12. Date Format Issues

Detection:

* Invalid date formats

Policy:

* Normalize when possible

Action:

* Auto-fix or flag.

---

# Database Schema

users

* id
* name
* email
* password_hash
* created_at

groups

* id
* name
* created_by
* created_at

group_members

* id
* group_id
* user_id
* joined_at
* left_at

expenses

* id
* group_id
* description
* amount
* currency
* fx_rate
* paid_by
* split_type
* expense_date
* notes
* is_deleted
* created_at

expense_splits

* id
* expense_id
* user_id
* amount

settlements

* id
* group_id
* paid_by
* paid_to
* amount
* settled_at
* notes

import_logs

* id
* group_id
* filename
* total_rows
* imported
* skipped
* flagged
* anomalies
* imported_at

name_aliases

* id
* alias
* canonical_name
