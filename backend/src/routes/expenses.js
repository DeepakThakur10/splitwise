// src/routes/expenses.js

const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { computeSplits } = require('../services/splits');

const router = express.Router();

router.use(auth);

// =====================================================
// CREATE EXPENSE
// POST /api/expenses
// =====================================================
router.post('/', async (req, res) => {
const {
group_id,
description,
amount,
currency = 'INR',
fx_rate = 1,
paid_by,
split_type,
expense_date,
notes,
splits
} = req.body;

if (
!group_id ||
!description ||
amount == null ||
!paid_by ||
!split_type ||
!expense_date
) {
return res.status(400).json({
error: 'Missing required fields'
});
}

if (
!['equal', 'unequal', 'percentage', 'share'].includes(split_type)
) {
return res.status(400).json({
error: 'Invalid split_type'
});
}

try {
// ---------------------------------------------
// Verify current user belongs to group
// ---------------------------------------------
const groupAccess = await pool.query(
`       SELECT id
      FROM group_members
      WHERE group_id = $1
      AND user_id = $2
      AND left_at IS NULL
      `,
[group_id, req.user.id]
);


if (!groupAccess.rows.length) {
  return res.status(403).json({
    error: 'You are not an active member of this group'
  });
}

// ---------------------------------------------
// Members active on expense date
// ---------------------------------------------
const activeResult = await pool.query(
  `
  SELECT user_id
  FROM group_members
  WHERE group_id = $1
  AND joined_at <= $2
  AND (
    left_at IS NULL
    OR left_at >= $2
  )
  `,
  [group_id, expense_date]
);

const activeMembers = activeResult.rows.map(
  row => row.user_id
);

// ---------------------------------------------
// Validate payer
// ---------------------------------------------
if (!activeMembers.includes(paid_by)) {
  return res.status(400).json({
    error: 'Payer was not an active member on expense date'
  });
}

// ---------------------------------------------
// Validate split users
// ---------------------------------------------
if (!Array.isArray(splits) || splits.length === 0) {
  return res.status(400).json({
    error: 'Splits are required'
  });
}

for (const split of splits) {
  if (!activeMembers.includes(split.user_id)) {
    return res.status(400).json({
      error: `User ${split.user_id} was not active on ${expense_date}`
    });
  }
}

// ---------------------------------------------
// Convert to INR
// ---------------------------------------------
const amountINR = Number(
  (Number(amount) * Number(fx_rate)).toFixed(2)
);

// ---------------------------------------------
// Calculate split amounts
// ---------------------------------------------
let splitRows;

try {
  splitRows = computeSplits(
    split_type,
    amountINR,
    splits
  );
} catch (err) {
  return res.status(400).json({
    error: err.message
  });
}

const client = await pool.connect();

try {
  await client.query('BEGIN');

  const expenseResult = await client.query(
    `
    INSERT INTO expenses(
      group_id,
      description,
      amount,
      currency,
      fx_rate,
      paid_by,
      split_type,
      expense_date,
      notes
    )
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
    `,
    [
      group_id,
      description,
      amountINR,
      currency,
      fx_rate,
      paid_by,
      split_type,
      expense_date,
      notes || null
    ]
  );

  const expense = expenseResult.rows[0];

  for (const split of splitRows) {
    await client.query(
      `
      INSERT INTO expense_splits(
        expense_id,
        user_id,
        amount
      )
      VALUES($1,$2,$3)
      `,
      [
        expense.id,
        split.user_id,
        split.amount
      ]
    );
  }

  await client.query('COMMIT');

  res.status(201).json({
    ...expense,
    splits: splitRows
  });

} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}


} catch (err) {
console.error('Create expense error:', err);
res.status(500).json({
error: 'Server error'
});
}
});

// =====================================================
// LIST GROUP EXPENSES
// GET /api/expenses?group_id=1
// =====================================================
router.get('/', async (req, res) => {
const { group_id } = req.query;

if (!group_id) {
return res.status(400).json({
error: 'group_id query param required'
});
}

try {
const result = await pool.query(
`       SELECT
        e.*,
        u.name AS paid_by_name,
        json_agg(
          json_build_object(
            'user_id', es.user_id,
            'name', u2.name,
            'amount', es.amount
          )
          ORDER BY es.id
        ) AS splits
      FROM expenses e
      JOIN users u
        ON u.id = e.paid_by
      JOIN expense_splits es
        ON es.expense_id = e.id
      JOIN users u2
        ON u2.id = es.user_id
      WHERE e.group_id = $1
      AND e.is_deleted = FALSE
      GROUP BY e.id, u.name
      ORDER BY e.expense_date DESC, e.id DESC
      `,
[group_id]
);

```
res.json(result.rows);
```

} catch (err) {
console.error('List expenses error:', err);
res.status(500).json({
error: 'Server error'
});
}
});

// =====================================================
// GET SINGLE EXPENSE
// =====================================================
router.get('/:id', async (req, res) => {
try {
const result = await pool.query(
`       SELECT
        e.*,
        u.name AS paid_by_name,
        json_agg(
          json_build_object(
            'user_id', es.user_id,
            'name', u2.name,
            'amount', es.amount
          )
          ORDER BY es.id
        ) AS splits
      FROM expenses e
      JOIN users u
        ON u.id = e.paid_by
      JOIN expense_splits es
        ON es.expense_id = e.id
      JOIN users u2
        ON u2.id = es.user_id
      WHERE e.id = $1
      AND e.is_deleted = FALSE
      GROUP BY e.id, u.name
      `,
[req.params.id]
);

```
if (!result.rows.length) {
  return res.status(404).json({
    error: 'Expense not found'
  });
}

res.json(result.rows[0]);
```

} catch (err) {
console.error('Get expense error:', err);
res.status(500).json({
error: 'Server error'
});
}
});

// =====================================================
// SOFT DELETE EXPENSE
// Only creator can delete
// =====================================================
router.delete('/:id', async (req, res) => {
try {
const result = await pool.query(
`       UPDATE expenses
      SET is_deleted = TRUE
      WHERE id = $1
      AND paid_by = $2
      AND is_deleted = FALSE
      RETURNING id
      `,
[req.params.id, req.user.id]
);

```
if (!result.rows.length) {
  return res.status(404).json({
    error: 'Expense not found or not owned by you'
  });
}

res.json({
  message: 'Expense deleted',
  id: result.rows[0].id
});
```

} catch (err) {
console.error('Delete expense error:', err);
res.status(500).json({
error: 'Server error'
});
}
});

module.exports = router;
