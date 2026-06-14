# DECISIONS.md

## Decision 1: PostgreSQL

Options:

* MongoDB
* PostgreSQL

Chosen:

* PostgreSQL

Reason:
Assignment explicitly requires a relational database.

---

## Decision 2: Membership History

Options:

* Current members only
* Historical membership records

Chosen:

* Historical membership records

Reason:
Required to correctly handle join and leave dates.

---

## Decision 3: Store Expenses In INR

Options:

* Store original currency
* Store normalized INR value

Chosen:

* Store INR value with original currency metadata

Reason:
Simplifies balance calculations.

---

## Decision 4: Two-Phase CSV Import

Options:

* Direct import
* Preview then import

Chosen:

* Preview then import

Reason:
Supports user approval and prevents silent data changes.

---

## Decision 5: Soft Delete Expenses

Options:

* Hard delete
* Soft delete

Chosen:

* Soft delete

Reason:
Provides auditability.

---

## Decision 6: JWT Authentication

Options:

* Session Authentication
* JWT

Chosen:

* JWT

Reason:
Simpler API integration.

---

## Decision 7: Minimum Cash Flow Algorithm

Options:

* All pairwise debts
* Min cash flow settlement

Chosen:

* Min cash flow

Reason:
Provides smallest number of transactions.

---

## Decision 8: Duplicate Handling

Options:

* Auto-delete
* User approval

Chosen:

* User approval

Reason:
Matches Meera's requirement.

---

## Decision 9: Name Alias Resolution

Options:

* Reject mismatched names
* Alias mapping

Chosen:

* Alias mapping

Reason:
Common CSV inconsistency.

---

## Decision 10: Historical Membership Validation

Options:

* Ignore membership dates
* Validate against join/leave history

Chosen:

* Validate

Reason:
Matches Sam's requirement.
