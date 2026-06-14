// src/routes/import.js
//
// Two-phase import — nothing touches the DB until the user confirms.
//
// POST /api/import/preview   — parse CSV, return anomaly report (no DB writes)
// POST /api/import/confirm   — actually import the approved rows

const express = require('express');
const multer  = require('multer');
const PDFDocument = require('pdfkit');
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');
const { parseCSV }      = require('../services/csvParser');
const { computeSplits } = require('../services/splits');

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage() }); // keep file in RAM
router.use(auth);

// ── Phase 1: Preview ───────────────────────────────────────
// Returns parsed rows + anomaly report.
// Frontend shows this to the user who can adjust flags before confirming.

router.post('/preview', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { group_id } = req.body;
  if (!group_id) return res.status(400).json({ error: 'group_id required' });

  try {
    // Get group members so the parser can match names
    const membersResult = await pool.query(
      `SELECT u.id AS user_id, u.name, gm.joined_at, gm.left_at
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1`,
      [group_id]
    );
    const knownMembers = membersResult.rows;

    const csvText = req.file.buffer.toString('utf8');
    const { rows, anomalies } = parseCSV(csvText, knownMembers);

    const summary = {
      total:     rows.length,
      ok:        rows.filter(r => r._status === 'ok').length,
      flagged:   rows.filter(r => r._status === 'flagged').length,
      skip:      rows.filter(r => r._status === 'skip').length,
      auto_fixed: anomalies.filter(a => a.type === 'auto_fixed').length,
      errors:    anomalies.filter(a => a.type === 'error').length,
    };

    res.json({ summary, rows, anomalies });
  } catch (err) {
    console.error('Preview error:', err.message);
    res.status(500).json({ error: `Parse failed: ${err.message}` });
  }
});

// ── Phase 2: Confirm ───────────────────────────────────────
// User sends back the rows they want to import (with any manual fixes applied).
// Each row has _status: 'ok' | 'flagged' (user approved) | 'skip'
router.post('/confirm', async (req, res) => {
  const { group_id, rows } = req.body;
  if (!group_id || !rows) return res.status(400).json({ error: 'group_id and rows required' });

  // Get member map for resolving user_ids
  const membersResult = await pool.query(
    `SELECT u.id AS user_id, u.name, gm.joined_at, gm.left_at
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1`,
    [group_id]
  );
  const nameMap = {};
  for (const m of membersResult.rows) {
    nameMap[m.name.toLowerCase()] = m;
  }

  const client = await pool.connect();
  const importedIds  = [];
  const skippedRows  = [];
  const errorRows    = [];
  const reportIssues = [];

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      collectRowIssues(row, reportIssues);

      // Skip rows the user didn't approve
      if (row._status === 'skip') {
        skippedRows.push({ row: row._row, reason: 'skipped by user or auto-skip' });
        reportIssues.push({
          row: row._row,
          code: 'ROW_SKIPPED',
          message: 'Row skipped by user or auto-skip policy',
          action: 'Skipped'
        });
        continue;
      }

      // Handle settlement rows
      if (row._isSettlement) {
        await importSettlement(client, group_id, row, nameMap);
        importedIds.push({ type: 'settlement', row: row._row });
        continue;
      }

      // Validate we have a paid_by user_id
      const paidByUserId = row._paid_by_user_id ||
        (row._paid_by_name && nameMap[row._paid_by_name.toLowerCase()]?.user_id);

      if (!paidByUserId) {
        errorRows.push({ row: row._row, reason: `Cannot resolve payer: ${row.paid_by}` });
        reportIssues.push({
          row: row._row,
          code: 'PAYER_RESOLUTION_FAILED',
          message: `Cannot resolve payer: ${row.paid_by}`,
          action: 'Rejected'
        });
        continue;
      }

      // Build the splits array for computeSplits()
      const splitWith     = row._resolved_split_with || [];
      const splitDetails  = row.split_details || '';
      const splitType     = row.split_type || 'equal';
      const amountINR     = parseFloat(row._amount_inr || row.amount);
      const fxRate        = parseFloat(row._fx_rate || 1);

      let splits;
      try {
        splits = buildSplitsArray(splitType, splitWith, splitDetails, Math.abs(amountINR), nameMap, row.date);
        if (amountINR < 0) {
          splits = splits.map(split => ({ ...split, amount: -Math.abs(split.amount) }));
        }
      } catch (e) {
        errorRows.push({ row: row._row, reason: e.message });
        reportIssues.push({
          row: row._row,
          code: 'SPLIT_BUILD_FAILED',
          message: e.message,
          action: 'Rejected'
        });
        continue;
      }

      // Insert expense
      const eResult = await client.query(
        `INSERT INTO expenses
           (group_id, description, amount, currency, fx_rate, paid_by, split_type, expense_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          group_id,
          row.description,
          amountINR,
          row.currency || 'INR',
          fxRate,
          paidByUserId,
          splitType,
          row.date,
          row.notes || null,
        ]
      );
      const expenseId = eResult.rows[0].id;

      // Insert splits
      for (const s of splits) {
        await client.query(
          'INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1,$2,$3)',
          [expenseId, s.user_id, s.amount]
        );
      }

      importedIds.push({ type: 'expense', id: expenseId, row: row._row });
    }

    // Save import log
    await client.query(
      `INSERT INTO import_logs (group_id, filename, total_rows, imported, skipped, flagged, anomalies)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        group_id,
        'expenses_export.csv',
        rows.length,
        importedIds.length,
        skippedRows.length,
        errorRows.length,
        JSON.stringify({
          imported: importedIds,
          skipped: skippedRows,
          errors: errorRows,
          issues: reportIssues
        }),
      ]
    );

    await client.query('COMMIT');

    res.json({
      imported: importedIds.length,
      skipped:  skippedRows.length,
      errors:   errorRows.length,
      details:  { imported: importedIds, skipped: skippedRows, errors: errorRows },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import confirm error:', err.message);
    res.status(500).json({ error: `Import failed: ${err.message}` });
  } finally {
    client.release();
  }
});

router.get('/report/:logId', async (req, res) => {
  try {
    const log = await loadImportLogForUser(req.params.logId, req.user.id);
    if (!log) return res.status(404).json({ error: 'Import log not found' });

    const report = formatImportReport(log);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="import-report-${log.id}.txt"`);
    res.send(report);
  } catch (err) {
    console.error('TXT report error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/report/:logId/pdf', async (req, res) => {
  try {
    const log = await loadImportLogForUser(req.params.logId, req.user.id);
    if (!log) return res.status(404).json({ error: 'Import log not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="import-report-${log.id}.pdf"`);

    const doc = new PDFDocument({ margin: 48 });
    doc.pipe(res);

    doc.fontSize(18).text('Import Report', { underline: true });
    doc.moveDown();
    doc.fontSize(11);

    for (const line of formatImportReport(log).split('\n')) {
      doc.text(line || ' ');
    }

    doc.end();
  } catch (err) {
    console.error('PDF report error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Get import history ─────────────────────────────────────
router.get('/logs', async (req, res) => {
  const { group_id } = req.query;
  if (!group_id) return res.status(400).json({ error: 'group_id required' });
  try {
    const result = await pool.query(
      'SELECT * FROM import_logs WHERE group_id = $1 ORDER BY imported_at DESC',
      [group_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Helpers ────────────────────────────────────────────────

async function importSettlement(client, groupId, row, nameMap) {
  const paidBy = row._paid_by_user_id ||
    nameMap[(row._paid_by_name || '').toLowerCase()]?.user_id;
  // split_with has the recipient
  const splitWith = (row.split_with || '').split(';').map(s => s.trim()).filter(Boolean);
  const recipient = splitWith[0] ? nameMap[splitWith[0].toLowerCase()]?.user_id : null;

  if (!paidBy || !recipient) return; // can't resolve — skip

  await client.query(
    `INSERT INTO settlements (group_id, paid_by, paid_to, amount, settled_at, notes)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [groupId, paidBy, recipient, Math.abs(parseFloat(row.amount)), row.date, row.notes]
  );
}

async function loadImportLogForUser(logId, userId) {
  const result = await pool.query(
    `SELECT il.*
     FROM import_logs il
     JOIN group_members gm ON gm.group_id = il.group_id
     WHERE il.id = $1 AND gm.user_id = $2`,
    [logId, userId]
  );

  return result.rows[0] || null;
}

function collectRowIssues(row, issues) {
  const rowIssues = [
    ...(row._anomalies || []),
    ...(row._autoFixed || [])
  ];

  for (const issue of rowIssues) {
    issues.push({
      row: issue.row || row._row,
      code: issue.code,
      message: issue.message,
      action: issue.type === 'auto_fixed' ? 'Auto fixed' : row._status === 'skip' ? 'Skipped' : 'Needs review'
    });
  }
}

function formatImportReport(log) {
  const payload = log.anomalies || {};
  const issues = Array.isArray(payload.issues) ? payload.issues : [
    ...(payload.skipped || []).map(item => ({
      row: item.row,
      code: 'ROW_SKIPPED',
      message: item.reason,
      action: 'Skipped'
    })),
    ...(payload.errors || []).map(item => ({
      row: item.row,
      code: 'IMPORT_ERROR',
      message: item.reason,
      action: 'Rejected'
    }))
  ];

  const lines = [
    'Import Report',
    '',
    `File: ${log.filename || 'expenses_export.csv'}`,
    `Imported: ${log.imported || 0}`,
    `Skipped: ${log.skipped || 0}`,
    `Errors: ${log.flagged || 0}`,
    '',
    'Detected Issues:',
    ''
  ];

  if (!issues.length) {
    lines.push('No issues detected.');
  }

  for (const issue of issues) {
    lines.push(`Row ${issue.row || 'N/A'}`);
    lines.push(issue.code ? `${issue.code}: ${issue.message || ''}` : (issue.message || 'Issue detected'));
    lines.push(`Action: ${issue.action || 'Needs review'}`);
    lines.push('');
  }

  return lines.join('\n');
}

function isActiveOn(member, date) {
  if (!member || !date || !member.joined_at) return true;

  const day = new Date(`${date}T00:00:00.000Z`);
  const joined = new Date(member.joined_at);
  const left = member.left_at ? new Date(member.left_at) : null;

  if (Number.isNaN(day.getTime()) || Number.isNaN(joined.getTime())) return true;
  if (day < joined) return false;
  return !(left && day > left);
}

function buildSplitsArray(splitType, splitWith, splitDetails, totalINR, nameMap, date) {
  const { computeSplits } = require('../services/splits');

  // Parse split_details string into values
  // Format varies: "Rohan 700; Priya 400" or "Aisha 30%; Rohan 30%" or "Aisha 1; Rohan 2"
  const detailMap = {};
  if (splitDetails) {
    for (const part of splitDetails.split(';')) {
      const m = part.trim().match(/^(.+?)\s+([\d.]+)\s*%?$/);
      if (m) {
        detailMap[m[1].trim().toLowerCase()] = parseFloat(m[2]);
      }
    }
  }

  // Filter splitWith to only include members active on the expense date
  const activeSplitWith = splitWith.filter(member => {
    const m = nameMap[member.name.toLowerCase()];
    return m && isActiveOn(m, date);
  });

  const splits = activeSplitWith.map(member => {
    const value = detailMap[member.name.toLowerCase()];
    return {
      user_id: member.user_id,
      value:   value != null ? value : 1, // default to 1 for equal splits
    };
  });

  if (splits.length === 0) throw new Error('No active split members on this date');

  return computeSplits(splitType, totalINR, splits);
}

module.exports = router;
