# AI_USAGE.md

## AI Tools Used

### Primary AI Tool

* ChatGPT

### Secondary AI Tool

* Claude (used for UI brainstorming and design suggestions)

---

# Key Prompts Used During Development

## Prompt 1

Design a PostgreSQL schema for a SplitWise-like application that supports:

* Group creation and management
* Dynamic membership changes
* Expense tracking
* Settlement tracking
* CSV import functionality
* Historical balance calculations

## Prompt 2

Build RESTful Express.js APIs for:

* Authentication
* Groups
* Expenses
* Balances
* Settlements
* CSV Import Management

using PostgreSQL as the database.

## Prompt 3

Implement balance calculation and debt simplification using the Minimum Cash Flow algorithm to minimize the number of transactions required to settle debts.

## Prompt 4

Create anomaly detection and validation rules for imported CSV files, including:

* Duplicate records
* Invalid percentages
* Missing participants
* Incorrect settlement entries

---

# Cases Where AI Suggestions Were Incorrect

## Case 1: Membership History Ignored

### Problem

The initial AI-generated balance calculation did not consider membership history.

### Issue

Users who had already left a group could still be charged for later expenses.

### Fix

Added membership validation using:

* `joined_at`
* `left_at`

timestamps.

### Result

Historical expense calculations became accurate.

---

## Case 2: Deleting Members

### Problem

AI suggested removing users from the `group_members` table when they left a group.

### Issue

Historical expenses and settlements could no longer be explained correctly.

### Fix

Implemented soft membership tracking using the `left_at` field instead of deleting records.

### Result

Complete membership history is preserved.

---

## Case 3: Settlement Import Handling

### Problem

AI initially treated settlement rows as regular expenses during CSV import.

### Issue

Balances became incorrect because settlements reduce debt rather than create new expenses.

### Fix

Added settlement detection and conversion logic during import processing.

### Result

Settlement transactions are imported correctly and balances remain accurate.

---

## Case 4: Invalid Percentage Splits

### Problem

AI accepted percentage-based splits even when the total exceeded 100%.

### Issue

Expense distribution became mathematically incorrect.

### Fix

Added strict validation ensuring percentage totals equal exactly 100%.

### Result

Invalid records are rejected before insertion.

---

# Human Verification Process

All AI-generated outputs were manually reviewed before integration, including:

* Database schema design
* SQL queries
* Express.js API implementations
* Balance calculation algorithms
* CSV import logic
* Validation rules

Testing was performed using:

* PostgreSQL queries
* Postman API testing
* Manual edge-case verification

---

# Final Outcome

AI tools accelerated development by assisting with code generation, architecture ideas, and validation logic. However, all final engineering decisions, testing, debugging, and implementation choices were performed manually after review and verification.

AI served as a productivity tool rather than a replacement for software engineering judgment.
