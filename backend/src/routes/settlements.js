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

module.exports = router;