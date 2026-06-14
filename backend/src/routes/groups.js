// src/routes/groups.js

const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// =====================================================
// CREATE GROUP
// POST /api/groups
// =====================================================
router.post('/', async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      error: 'Group name is required'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const groupResult = await client.query(
      `
      INSERT INTO groups(name, created_by)
      VALUES($1, $2)
      RETURNING *
      `,
      [name.trim(), req.user.id]
    );

    const group = groupResult.rows[0];

    await client.query(
      `
      INSERT INTO group_members(
        group_id,
        user_id,
        joined_at
      )
      VALUES($1, $2, CURRENT_DATE)
      `,
      [group.id, req.user.id]
    );

    await client.query('COMMIT');

    res.status(201).json(group);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// =====================================================
// LIST MY GROUPS
// GET /api/groups
// =====================================================
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        g.id,
        g.name,
        g.created_at,
        COUNT(DISTINCT gm2.user_id) AS member_count
      FROM groups g
      JOIN group_members gm
        ON gm.group_id = g.id
      JOIN group_members gm2
        ON gm2.group_id = g.id
        AND gm2.left_at IS NULL
      WHERE gm.user_id = $1
      AND gm.left_at IS NULL
      GROUP BY g.id, g.name, g.created_at
      ORDER BY g.created_at DESC
      `,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('List groups error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =====================================================
// GET GROUP DETAILS
// GET /api/groups/:id
// =====================================================
router.get('/:id', async (req, res) => {
  const groupId = parseInt(req.params.id);

  if (isNaN(groupId)) {
    return res.status(400).json({
      error: 'Invalid group id'
    });
  }

  try {
    const membershipCheck = await pool.query(
      `
      SELECT id
      FROM group_members
      WHERE group_id = $1
      AND user_id = $2
      AND left_at IS NULL
      `,
      [groupId, req.user.id]
    );

    if (!membershipCheck.rows.length) {
      return res.status(403).json({
        error: 'You are not an active member of this group'
      });
    }

    const groupResult = await pool.query(
      `SELECT * FROM groups WHERE id = $1`,
      [groupId]
    );

    if (!groupResult.rows.length) {
      return res.status(404).json({
        error: 'Group not found'
      });
    }

    const membersResult = await pool.query(
      `
      SELECT
        gm.id,
        gm.joined_at,
        gm.left_at,
        u.id AS user_id,
        u.name,
        u.email
      FROM group_members gm
      JOIN users u
        ON gm.user_id = u.id
      WHERE gm.group_id = $1
      ORDER BY gm.joined_at ASC
      `,
      [groupId]
    );

    res.json({
      ...groupResult.rows[0],
      members: membersResult.rows
    });

  } catch (err) {
    console.error('Get group error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =====================================================
// ADD MEMBER
// POST /api/groups/:id/members
// =====================================================
router.post('/:id/members', async (req, res) => {
  const groupId = parseInt(req.params.id);

  if (isNaN(groupId)) {
    return res.status(400).json({
      error: 'Invalid group id'
    });
  }

  const { user_id, joined_at } = req.body;

  if (!user_id) {
    return res.status(400).json({
      error: 'user_id is required'
    });
  }

  try {
    const memberCheck = await pool.query(
      `
      SELECT id
      FROM group_members
      WHERE group_id = $1
      AND user_id = $2
      AND left_at IS NULL
      `,
      [groupId, req.user.id]
    );

    if (!memberCheck.rows.length) {
      return res.status(403).json({
        error: 'Only active members can add users'
      });
    }

    const existingMember = await pool.query(
      `
      SELECT id
      FROM group_members
      WHERE group_id = $1
      AND user_id = $2
      AND left_at IS NULL
      `,
      [groupId, user_id]
    );

    if (existingMember.rows.length) {
      return res.status(400).json({
        error: 'User is already an active member'
      });
    }

    const result = await pool.query(
      `
      INSERT INTO group_members(
        group_id,
        user_id,
        joined_at
      )
      VALUES($1,$2,$3)
      RETURNING *
      `,
      [
        groupId,
        user_id,
        joined_at || new Date().toISOString().slice(0, 10)
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =====================================================
// MEMBER LEAVES
// PUT /api/groups/:id/members/:userId
// =====================================================
router.put('/:id/members/:userId', async (req, res) => {
  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);

  const { left_at } = req.body;

  if (!left_at) {
    return res.status(400).json({
      error: 'left_at date is required'
    });
  }

  try {
    const memberCheck = await pool.query(
      `
      SELECT id
      FROM group_members
      WHERE group_id = $1
      AND user_id = $2
      AND left_at IS NULL
      `,
      [groupId, req.user.id]
    );

    if (!memberCheck.rows.length) {
      return res.status(403).json({
        error: 'Only active members can update membership'
      });
    }

    const result = await pool.query(
      `
      UPDATE group_members
      SET left_at = $1
      WHERE group_id = $2
      AND user_id = $3
      AND left_at IS NULL
      RETURNING *
      `,
      [left_at, groupId, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: 'Active membership not found'
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Leave member error:', err);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

module.exports = router;