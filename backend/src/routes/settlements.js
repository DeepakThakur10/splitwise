// src/routes/settlements.js

const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// =====================================================
// RECORD SETTLEMENT
// POST /api/settlements
// =====================================================
router.post('/', async (req, res) => {
  const {
    group_id,
    paid_by,
    paid_to,
    amount,
    settled_at,
    notes
  } = req.body;

  if (!group_id || !paid_by || !paid_to || !amount) {
    return res.status(400).json({
      error: 'group_id, paid_by, paid_to and amount are required'
    });
  }

  if (paid_by === paid_to) {
    return res.status(400).json({
      error: 'paid_by and paid_to cannot be the same person'
    });
  }

  if (Number(amount) <= 0) {
    return res.status(400).json({
      error: 'Amount must be greater than zero'
    });
  }

  try {

    // Only payer can record payment
    if (Number(paid_by) !== Number(req.user.id)) {
      return res.status(403).json({
        error: 'You can only record payments made by yourself'
      });
    }

    // Verify payer belongs to group
    const payerMembership = await pool.query(
      `
      SELECT id
      FROM group_members
      WHERE group_id = $1
      AND user_id = $2
      AND left_at IS NULL
      `,
      [group_id, paid_by]
    );

    if (!payerMembership.rows.length) {
      return res.status(403).json({
        error: 'Payer is not an active member of this group'
      });
    }

    // Verify receiver belongs to group
    const receiverMembership = await pool.query(
      `
      SELECT id
      FROM group_members
      WHERE group_id = $1
      AND user_id = $2
      `,
      [group_id, paid_to]
    );

    if (!receiverMembership.rows.length) {
      return res.status(400).json({
        error: 'Receiver is not a member of this group'
      });
    }

    const balances = await getGroupNetBalances(group_id);
    const payerNet = balances.get(Number(paid_by)) || 0;
    const receiverNet = balances.get(Number(paid_to)) || 0;
    const paymentAmount = Number(amount);

    if (payerNet >= 0) {
      return res.status(400).json({
        error: 'You do not currently owe a balance in this group'
      });
    }

    if (receiverNet <= 0) {
      return res.status(400).json({
        error: 'Selected recipient is not currently owed money'
      });
    }

    const maxAllowed = Math.min(Math.abs(payerNet), receiverNet);
    if (paymentAmount - maxAllowed > 0.01) {
      return res.status(400).json({
        error: `Settlement amount cannot exceed your current owed balance of ${maxAllowed.toFixed(2)}`
      });
    }

    const result = await pool.query(
      `
      INSERT INTO settlements(
        group_id,
        paid_by,
        paid_to,
        amount,
        settled_at,
        notes
      )
      VALUES($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        group_id,
        paid_by,
        paid_to,
        amount,
        settled_at ||
          new Date().toISOString().slice(0, 10),
        notes || null
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('Settlement create error:', err);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

// =====================================================
// LIST GROUP SETTLEMENTS
// GET /api/settlements?group_id=1
// =====================================================
router.get('/', async (req, res) => {
  const { group_id } = req.query;

  if (!group_id) {
    return res.status(400).json({
      error: 'group_id required'
    });
  }

  try {

    const membership = await pool.query(
      `
      SELECT id
      FROM group_members
      WHERE group_id = $1
      AND user_id = $2
      `,
      [group_id, req.user.id]
    );

    if (!membership.rows.length) {
      return res.status(403).json({
        error: 'You are not a member of this group'
      });
    }

    const result = await pool.query(
      `
      SELECT
        s.*,
        u1.name AS paid_by_name,
        u2.name AS paid_to_name
      FROM settlements s
      JOIN users u1
        ON u1.id = s.paid_by
      JOIN users u2
        ON u2.id = s.paid_to
      WHERE s.group_id = $1
      ORDER BY s.settled_at DESC, s.id DESC
      `,
      [group_id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error('Settlement list error:', err);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

// =====================================================
// USER SETTLEMENT HISTORY
// GET /api/settlements/user/:userId
// =====================================================
router.get('/user/:userId', async (req, res) => {
  const userId = Number(req.params.userId);

  try {

    const result = await pool.query(
      `
      SELECT
        s.*,
        u1.name AS paid_by_name,
        u2.name AS paid_to_name
      FROM settlements s
      JOIN users u1
        ON u1.id = s.paid_by
      JOIN users u2
        ON u2.id = s.paid_to
      WHERE s.paid_by = $1
         OR s.paid_to = $1
      ORDER BY s.settled_at DESC
      `,
      [userId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error('User settlements error:', err);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

async function getGroupNetBalances(groupId) {
  const paidResult = await pool.query(
    `SELECT paid_by AS user_id, SUM(amount) AS total_paid
     FROM expenses
     WHERE group_id = $1 AND is_deleted = FALSE
     GROUP BY paid_by`,
    [groupId]
  );

  const owesResult = await pool.query(
    `SELECT es.user_id, SUM(es.amount) AS total_owes
     FROM expense_splits es
     JOIN expenses e ON e.id = es.expense_id
     WHERE e.group_id = $1 AND e.is_deleted = FALSE
     GROUP BY es.user_id`,
    [groupId]
  );

  const settledResult = await pool.query(
    `SELECT paid_by, paid_to, SUM(amount) AS total
     FROM settlements
     WHERE group_id = $1
     GROUP BY paid_by, paid_to`,
    [groupId]
  );

  const net = new Map();

  for (const row of paidResult.rows) {
    const userId = Number(row.user_id);
    net.set(userId, (net.get(userId) || 0) + Number(row.total_paid || 0));
  }

  for (const row of owesResult.rows) {
    const userId = Number(row.user_id);
    net.set(userId, (net.get(userId) || 0) - Number(row.total_owes || 0));
  }

  for (const row of settledResult.rows) {
    const paidBy = Number(row.paid_by);
    const paidTo = Number(row.paid_to);
    const total = Number(row.total || 0);
    net.set(paidBy, (net.get(paidBy) || 0) + total);
    net.set(paidTo, (net.get(paidTo) || 0) - total);
  }

  return net;
}

module.exports = router;
