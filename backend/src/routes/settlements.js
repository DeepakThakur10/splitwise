// src/routes/settlements.js
//
// POST /api/settlements         — record a payment
// GET  /api/settlements?group_id=X  — list all settlements for a group

const express = require('express');
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ── Record a settlement ────────────────────────────────────
router.post('/', async (req, res) => {
  const { group_id, paid_by, paid_to, amount, settled_at, notes } = req.body;

  if (!group_id || !paid_by || !paid_to || !amount) {
    return res.status(400).json({ error: 'group_id, paid_by, paid_to, amount required' });
  }
  if (paid_by === paid_to) {
    return res.status(400).json({ error: 'paid_by and paid_to cannot be the same person' });
  }
  if (parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Amount must be positive' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO settlements (group_id, paid_by, paid_to, amount, settled_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [group_id, paid_by, paid_to, amount, settled_at || new Date().toISOString().slice(0, 10), notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Settlement error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── List settlements for a group ───────────────────────────
router.get('/', async (req, res) => {
  const { group_id } = req.query;
  if (!group_id) return res.status(400).json({ error: 'group_id required' });

  try {
    const result = await pool.query(
      `SELECT s.*,
              u1.name AS paid_by_name,
              u2.name AS paid_to_name
       FROM settlements s
       JOIN users u1 ON u1.id = s.paid_by
       JOIN users u2 ON u2.id = s.paid_to
       WHERE s.group_id = $1
       ORDER BY s.settled_at DESC`,
      [group_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List settlements error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
