// src/routes/users.js
// GET /api/users/search?q=name  — find users to add to a group

const express = require('express');
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.status(400).json({ error: 'Query must be at least 2 characters' });

  try {
    const result = await pool.query(
      `SELECT id, name, email FROM users
       WHERE name ILIKE $1 OR email ILIKE $1
       LIMIT 10`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
