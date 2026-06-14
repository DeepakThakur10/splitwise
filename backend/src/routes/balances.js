// src/routes/balances.js
//
// GET /api/balances?group_id=X   — full balance summary for a group
//
// Returns:
//   balances[]    — net amount each person is owed (positive = owed money)
//   settlements[] — minimum set of payments to settle all debts

const express = require('express');
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const { group_id } = req.query;
  if (!group_id) return res.status(400).json({ error: 'group_id required' });

  try {
    // ── Step 1: Sum up what each person paid (credits) ──────
    const paidResult = await pool.query(
      `SELECT e.paid_by AS user_id, u.name, SUM(e.amount) AS total_paid
       FROM expenses e
       JOIN users u ON u.id = e.paid_by
       WHERE e.group_id = $1 AND e.is_deleted = FALSE
       GROUP BY e.paid_by, u.name`,
      [group_id]
    );

    // ── Step 2: Sum up what each person owes (debits) ───────
    const owesResult = await pool.query(
      `SELECT es.user_id, u.name, SUM(es.amount) AS total_owes
       FROM expense_splits es
       JOIN expenses e ON e.id = es.expense_id
       JOIN users u ON u.id = es.user_id
       WHERE e.group_id = $1 AND e.is_deleted = FALSE
       GROUP BY es.user_id, u.name`,
      [group_id]
    );

    // ── Step 3: Sum up settlements already made ──────────────
    const settledResult = await pool.query(
      `SELECT paid_by, paid_to, SUM(amount) AS total
       FROM settlements
       WHERE group_id = $1
       GROUP BY paid_by, paid_to`,
      [group_id]
    );

    // Build lookup maps
    const paid   = {};  // user_id → amount paid for others
    const owes   = {};  // user_id → amount owed in splits
    const names  = {};

    for (const r of paidResult.rows) {
      paid[r.user_id]  = parseFloat(r.total_paid);
      names[r.user_id] = r.name;
    }
    for (const r of owesResult.rows) {
      owes[r.user_id]  = parseFloat(r.total_owes);
      names[r.user_id] = r.name;
    }

    // Collect all user_ids mentioned
    const userIds = [...new Set([
      ...Object.keys(paid),
      ...Object.keys(owes),
    ].map(Number))];

    // ── Step 4: Net balance per person ───────────────────────
    // net > 0 means they are owed money
    // net < 0 means they owe money
    const net = {};
    for (const id of userIds) {
      net[id] = (paid[id] || 0) - (owes[id] || 0);
    }

    // Apply settlements
    for (const s of settledResult.rows) {
      const amount = parseFloat(s.total);
      net[s.paid_by] = (net[s.paid_by] || 0) - amount; // payer gets credit
      net[s.paid_to] = (net[s.paid_to] || 0) + amount; // receiver is more owed
    }

    const balances = userIds.map(id => ({
      user_id: id,
      name:    names[id] || `User ${id}`,
      net:     parseFloat(net[id].toFixed(2)),
    }));

    // ── Step 5: Minimum cash flow algorithm ─────────────────
    // Greedy: biggest creditor gets paid by biggest debtor first.
    // This minimises the number of transactions needed.
    const settlements = minCashFlow(
      balances.map(b => ({ user_id: b.user_id, name: b.name, net: b.net }))
    );

    res.json({ balances, settlements });
  } catch (err) {
    console.error('Balances error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Min-cash-flow greedy algorithm ────────────────────────
// Input:  [{ user_id, name, net }]  (net > 0 = owed, net < 0 = owes)
// Output: [{ from, from_name, to, to_name, amount }]
function minCashFlow(people) {
  // Work with cents to avoid floating point issues
  const balances = people.map(p => ({
    ...p,
    cents: Math.round(p.net * 100),
  }));

  const transactions = [];

  // Keep going until everyone is settled
  while (true) {
    // Find the person who owes the most and who is owed the most
    let maxCreditor = balances.reduce((a, b) => b.cents > a.cents ? b : a);
    let maxDebtor   = balances.reduce((a, b) => b.cents < a.cents ? b : a);

    // If everyone is settled (within 1 cent rounding), we're done
    if (maxCreditor.cents <= 0 || maxDebtor.cents >= 0) break;

    const amount = Math.min(maxCreditor.cents, -maxDebtor.cents);

    transactions.push({
      from:      maxDebtor.user_id,
      from_name: maxDebtor.name,
      to:        maxCreditor.user_id,
      to_name:   maxCreditor.name,
      amount:    parseFloat((amount / 100).toFixed(2)),
    });

    maxCreditor.cents -= amount;
    maxDebtor.cents   += amount;
  }

  return transactions;
}

module.exports = router;
