# DECISIONS.md

## Decision 1: Membership History Tracking

### Problem

How should group membership history be maintained?

### Options Considered

1. Delete members when they leave a group
2. Preserve historical membership records

### Chosen Approach

Preserve membership history using `joined_at` and `left_at` timestamps.

### Reason

Historical expense calculations must consider whether a user was a member at the time an expense occurred. Deleting membership records would make accurate historical calculations impossible.

---

## Decision 2: Balance Calculation Model

### Problem

How should group balances be represented?

### Options Considered

1. Direct pairwise debts between all users
2. Net balances per user

### Chosen Approach

Net balance calculation.

### Reason

Net balances simplify calculations and integrate naturally with settlement optimization algorithms such as Minimum Cash Flow.

---

## Decision 3: Settlement Storage

### Problem

How should settlement transactions be recorded?

### Options Considered

1. Modify expense records
2. Maintain a dedicated settlement table

### Chosen Approach

Separate settlement table.

### Reason

Maintains a complete audit trail and clearly distinguishes expenses from debt repayments.

---

## Decision 4: Currency Conversion Strategy

### Problem

How should multi-currency imports be handled?

### Options Considered

1. Store original currencies only
2. Convert all imported values into a common currency

### Chosen Approach

Convert imported values to INR using `fx_rate`.

### Reason

Balance calculations require a common monetary unit to ensure consistency and correctness.

---

## Decision 5: Handling Invalid CSV Rows

### Problem

How should anomalies detected during CSV import be processed?

### Options Considered

1. Silent correction
2. Automatic rejection
3. User approval workflow

### Chosen Approach

User approval workflow.

### Reason

The assignment requires anomaly visibility and user control over potentially incorrect data.

---

## Decision 6: Expense Deletion Strategy

### Problem

How should deleted expenses be managed?

### Options Considered

1. Hard delete
2. Soft delete

### Chosen Approach

Soft delete.

### Reason

Preserves historical reporting, auditability, and traceability of financial records.

---

## Decision 7: Settlement Optimization

### Problem

How should settlements be generated?

### Options Considered

1. Naive pairwise payments
2. Minimum Cash Flow algorithm

### Chosen Approach

Minimum Cash Flow algorithm.

### Reason

Reduces the total number of transactions required to settle debts, improving usability and efficiency.

---

# Summary

The design decisions prioritize:

* Historical accuracy
* Auditability
* Data integrity
* User transparency
* Efficient debt settlement

These choices ensure the system remains reliable even when memberships change, expenses are modified, or imported data contains anomalies.
