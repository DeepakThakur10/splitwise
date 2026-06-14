# AI_USAGE.md

## AI Tools Used

### ChatGPT

Used for:

* Backend architecture
* PostgreSQL schema design
* API design
* Balance calculation logic
* CSV import design
* Documentation generation

### Claude

Used for:

* React frontend generation
* Tailwind UI generation
* Component scaffolding

### GitHub Copilot

Used for:

* Boilerplate completion
* Refactoring assistance

---

# Representative Prompts

## Backend

"Build Express routes for groups, expenses, settlements and balance calculation using PostgreSQL."

## CSV Import

"Design a two-phase CSV import system that detects anomalies and requires user approval."

## Frontend

"Generate a React + Vite frontend that integrates with my existing Express backend."

---

# AI Mistakes Found And Corrected

## Case 1: Membership Validation Bug

AI Output:
Allowed expenses to include members regardless of join date.

Problem:
Sam could be charged before joining the group.

Fix:
Added validation:

```sql
joined_at <= expense_date
AND (
 left_at IS NULL
 OR left_at >= expense_date
)
```

Result:
Historical membership is enforced.

---

## Case 2: Duplicate Membership Creation

AI Output:
Allowed same user to be added multiple times.

Problem:
Duplicate group membership records.

Fix:
Added validation and database constraints.

Result:
Single active membership per user.

---

## Case 3: Balance Calculation Error

AI Output:
Ignored settlement adjustments.

Problem:
Displayed incorrect balances.

Fix:
Settlement amounts are incorporated into net balance calculations.

Result:
Balances reflect actual outstanding debts.

---

## Human Verification Process

Every AI-generated file was:

1. Reviewed manually.
2. Tested using Postman.
3. Verified against PostgreSQL records.
4. Adjusted when business rules were violated.

The final implementation reflects engineering decisions made by the developer and not blind acceptance of AI-generated code.
