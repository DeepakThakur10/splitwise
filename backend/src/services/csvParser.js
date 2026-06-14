// src/services/csvParser.js
//
// Parses expenses_export.csv and returns:
//   { rows: [...], anomalies: [...] }
//
// Each row gets a status: 'ok' | 'flagged' | 'skip'
// Each anomaly has: { row, field, code, message, suggestion }
//
// POLICY:
//   'ok'      → safe to import as-is (possibly auto-fixed)
//   'flagged' → needs user decision before importing
//   'skip'    → will NOT be imported (duplicate, zero-amount placeholder, etc.)
//   'auto_fixed' → problem detected but fixed automatically (logged)

const { parse } = require('csv-parse/sync');

// FX rate config — documented, user-visible
const FX_RATES = {
  USD: 83,   // 1 USD = ₹83 (approximate, March 2026)
  INR: 1,
};

function parseCSV(csvText, knownMembers) {
  // knownMembers: [{ name, user_id }] — from the group the user is importing into

  // Parse raw CSV
  const rawRows = parse(csvText, {
    columns:          true,
    skip_empty_lines: true,
    trim:             true,
  });

  const results   = [];
  const anomalies = [];

  // Build a lowercase name → user lookup for matching
  const nameMap = {};
  for (const m of knownMembers) {
    nameMap[m.name.toLowerCase()] = m;
  }

  // Track descriptions we've seen to catch duplicates
  // Key: "date|description|amount|paid_by"
  const seen = new Map();

  for (let i = 0; i < rawRows.length; i++) {
    const raw    = rawRows[i];
    const rowNum = i + 2; // +2 because CSV row 1 is headers
    const row    = {
      _row:        rowNum,
      _status:     'ok',     // ok | flagged | skip
      _anomalies:  [],
      _autoFixed:  [],
      date:        raw.date,
      description: raw.description,
      amount:      raw.amount,
      currency:    raw.currency,
      split_type:  raw.split_type,
      split_with:  raw.split_with,
      split_details: raw.split_details,
      paid_by:     raw.paid_by,
      notes:       raw.notes,
    };

    // ──────────────────────────────────────────────────────
    // CHECK 1: Comma-formatted numbers like "1,200"
    // ──────────────────────────────────────────────────────
    if (typeof row.amount === 'string' && row.amount.includes(',')) {
      const fixed = row.amount.replace(/,/g, '');
      addAutoFix(row, anomalies, rowNum, 'amount', 'COMMA_IN_NUMBER',
        `Amount "${row.amount}" has commas — stripped to "${fixed}"`);
      row.amount = fixed;
    }

    // ──────────────────────────────────────────────────────
    // CHECK 2: Non-standard date formats (Mar-14, etc.)
    // ──────────────────────────────────────────────────────
    const parsedDate = parseDate(row.date);
    if (!parsedDate.valid) {
      addAnomaly(row, anomalies, rowNum, 'date', 'AMBIGUOUS_DATE',
        `Date "${row.date}" is ambiguous or unrecognised`,
        'Review and confirm the correct date before importing');
      row._status = 'flagged';
    } else if (parsedDate.ambiguous) {
      addAnomaly(row, anomalies, rowNum, 'date', 'AMBIGUOUS_DATE',
        `Date "${row.date}" is ambiguous (could be Apr-5 or May-4)`,
        'Confirm which date was intended');
      row.date    = parsedDate.date;
      row._status = 'flagged';
    } else {
      row.date = parsedDate.date;
    }

    // ──────────────────────────────────────────────────────
    // CHECK 2b: Date is technically parseable but notes say it's uncertain
    // (e.g. row 34: "04-05-2026" with note "is this April 5 or May 4?")
    // ──────────────────────────────────────────────────────
    if (
      parsedDate.valid &&
      (row.notes || '').toLowerCase().match(/april|may|format|mess|which/)
    ) {
      addAnomaly(row, anomalies, rowNum, 'date', 'AMBIGUOUS_DATE',
        `Date "${row.date}" may be ambiguous — note says: "${row.notes}"`,
        'Confirm whether this is DD-MM or MM-DD format');
      row._status = 'flagged';
    }

    // ──────────────────────────────────────────────────────
    // CHECK 3: Settlement logged as expense
    // ──────────────────────────────────────────────────────
    const desc = (row.description || '').toLowerCase();
    if (
      desc.includes('paid') && (desc.includes('back') || desc.includes('settled')) ||
      (row.notes || '').toLowerCase().includes('settlement')
    ) {
      addAnomaly(row, anomalies, rowNum, 'description', 'SETTLEMENT_AS_EXPENSE',
        `"${row.description}" looks like a settlement, not a shared expense`,
        'Will be imported as a settlement record, not an expense');
      row._status   = 'flagged';
      row._isSettlement = true;
    }

    // ──────────────────────────────────────────────────────
    // CHECK 4: Zero amount
    // ──────────────────────────────────────────────────────
    const amountNum = parseFloat(row.amount);
    if (!isNaN(amountNum) && amountNum === 0) {
      addAnomaly(row, anomalies, rowNum, 'amount', 'ZERO_AMOUNT',
        `Amount is 0 for "${row.description}" — likely a placeholder`,
        'Row will be skipped');
      row._status = 'skip';
    }

    // ──────────────────────────────────────────────────────
    // CHECK 5: Negative amount (refund/credit)
    // ──────────────────────────────────────────────────────
    if (!isNaN(amountNum) && amountNum < 0) {
      addAnomaly(row, anomalies, rowNum, 'amount', 'NEGATIVE_AMOUNT',
        `Amount ${amountNum} is negative — treating as a refund/credit`,
        'Will be imported as a credit that reduces the group total');
      row._isRefund = true;
      // Keep the row — negative amounts are valid refunds
    }

    // ──────────────────────────────────────────────────────
    // CHECK 6: Missing currency — default to INR
    // ──────────────────────────────────────────────────────
    if (!row.currency || row.currency.trim() === '') {
      addAnomaly(row, anomalies, rowNum, 'currency', 'MISSING_CURRENCY',
        `Currency is blank for "${row.description}"`,
        'Defaulting to INR — confirm if this is correct');
      row.currency = 'INR';
      row._status  = 'flagged';
    }

    // ──────────────────────────────────────────────────────
    // CHECK 7: Foreign currency — apply FX conversion
    // ──────────────────────────────────────────────────────
    const currency = (row.currency || 'INR').toUpperCase().trim();
    row.currency   = currency;
    if (currency !== 'INR') {
      const rate = FX_RATES[currency];
      if (!rate) {
        addAnomaly(row, anomalies, rowNum, 'currency', 'UNKNOWN_CURRENCY',
          `Unknown currency "${currency}"`,
          'Flag for user — cannot convert');
        row._status = 'flagged';
      } else {
        row._fx_rate        = rate;
        row._amount_inr     = parseFloat((amountNum * rate).toFixed(2));
        addAutoFix(row, anomalies, rowNum, 'currency', 'CURRENCY_CONVERTED',
          `${currency} ${amountNum} converted to ₹${row._amount_inr} at rate ${rate}`);
      }
    } else {
      row._fx_rate    = 1;
      row._amount_inr = amountNum;
    }

    // ──────────────────────────────────────────────────────
    // CHECK 8: Unknown or mismatched paid_by name
    // ──────────────────────────────────────────────────────
    const paidByRaw   = (row.paid_by || '').trim();
    const paidByMatch = matchName(paidByRaw, nameMap);

    if (!paidByRaw) {
      addAnomaly(row, anomalies, rowNum, 'paid_by', 'MISSING_PAID_BY',
        `No payer recorded for "${row.description}"`,
        'Cannot import without a payer — flag for user');
      row._status = 'flagged';
    } else if (!paidByMatch) {
      addAnomaly(row, anomalies, rowNum, 'paid_by', 'UNKNOWN_PAYER',
        `Payer "${paidByRaw}" does not match any group member`,
        'Map this name to a known member or add them to the group');
      row._status       = 'flagged';
      row._paid_by_raw  = paidByRaw;
    } else {
      if (paidByMatch.fuzzy) {
        addAutoFix(row, anomalies, rowNum, 'paid_by', 'PAYER_NAME_FIXED',
          `"${paidByRaw}" matched to group member "${paidByMatch.name}" (fuzzy)`);
      }
      row._paid_by_user_id = paidByMatch.user_id;
      row._paid_by_name    = paidByMatch.name;
    }

    // ──────────────────────────────────────────────────────
    // CHECK 9: split_with contains members not in the group
    // (Meera still listed after she left, etc.)
    // ──────────────────────────────────────────────────────
    const splitWith = (row.split_with || '').split(';').map(s => s.trim()).filter(Boolean);
    const unknownSplitMembers = [];
    const resolvedSplitWith   = [];

    for (const name of splitWith) {
      const match = matchName(name, nameMap);
      if (!match) {
        unknownSplitMembers.push(name);
      } else {
        resolvedSplitWith.push({ name: match.name, user_id: match.user_id });
      }
    }

    if (unknownSplitMembers.length > 0) {
      addAnomaly(row, anomalies, rowNum, 'split_with', 'UNKNOWN_SPLIT_MEMBER',
        `These people in split_with are not in the group: ${unknownSplitMembers.join(', ')}`,
        'Map them to group members or exclude them from the split');
      row._status = 'flagged';
    }

    row._resolved_split_with = resolvedSplitWith;

    // ──────────────────────────────────────────────────────
    // CHECK 10: Percentage splits that don't add up to 100%
    // ──────────────────────────────────────────────────────
    if (row.split_type === 'percentage' && row.split_details) {
      const pctTotal = parseSplitDetails(row.split_details, 'percentage');
      if (pctTotal !== null && Math.abs(pctTotal - 100) > 0.1) {
        addAnomaly(row, anomalies, rowNum, 'split_details', 'PERCENTAGE_NOT_100',
          `Percentages add up to ${pctTotal}% not 100%`,
          'Fix percentages before importing');
        row._status = 'flagged';
      }
    }

    // ──────────────────────────────────────────────────────
    // CHECK 11: split_type=equal but explicit shares provided
    // ──────────────────────────────────────────────────────
    if (row.split_type === 'equal' && row.split_details && row.split_details.trim() !== '') {
      addAnomaly(row, anomalies, rowNum, 'split_type', 'EQUAL_WITH_DETAILS',
        `split_type is "equal" but split_details are provided: "${row.split_details}"`,
        'Using the split_details (share-based) and overriding split_type to "share"');
      row.split_type = 'share';
      addAutoFix(row, anomalies, rowNum, 'split_type', 'SPLIT_TYPE_OVERRIDDEN',
        'split_type changed from "equal" to "share" because explicit details were present');
    }

    // ──────────────────────────────────────────────────────
    // CHECK 12: Duplicate detection
    // Key = date + description (lowercased) + amount
    // ──────────────────────────────────────────────────────
    const dupeKey = `${row.date}|${(row.description || '').toLowerCase().replace(/\s+/g, ' ')}|${amountNum}`;
    if (seen.has(dupeKey)) {
      const firstRow = seen.get(dupeKey);
      addAnomaly(row, anomalies, rowNum, 'description', 'DUPLICATE_EXPENSE',
        `Duplicate of row ${firstRow}: same date, description, and amount`,
        'This row will be skipped — only the first occurrence is kept');
      row._status    = 'skip';
      row._dupeOfRow = firstRow;
    } else {
      seen.set(dupeKey, rowNum);
    }

    // ──────────────────────────────────────────────────────
    // CHECK 13: Same description, same date, DIFFERENT amounts
    // (Thalassa dinner logged twice with ₹2400 and ₹2450)
    // ──────────────────────────────────────────────────────
    const descKey = `${row.date}|${(row.description || '').toLowerCase().replace(/\s+/g, ' ')}`;
    // We check the already-processed results for a matching description+date with different amount
    for (const prev of results) {
      const prevDescKey = `${prev.date}|${(prev.description || '').toLowerCase().replace(/\s+/g, ' ')}`;
      if (prevDescKey === descKey && Math.abs(parseFloat(prev.amount) - amountNum) > 0.01) {
        addAnomaly(row, anomalies, rowNum, 'amount', 'CONFLICTING_DUPLICATE',
          `Same description+date as row ${prev._row} but different amount (${prev.amount} vs ${amountNum})`,
          'Both rows flagged — user must pick which one is correct');
        row._status  = 'flagged';
        prev._status = 'flagged';
        // Also add an anomaly on the first row if not already flagged for this
        if (!prev._anomalies.find(a => a.code === 'CONFLICTING_DUPLICATE')) {
          addAnomaly(prev, anomalies, prev._row, 'amount', 'CONFLICTING_DUPLICATE',
            `Conflicts with row ${rowNum} — same description+date, amount is ${prev.amount} vs ${amountNum}`,
            'User must pick which row is correct');
        }
      }
    }

    // ──────────────────────────────────────────────────────
    // CHECK 14: Amount has too many decimal places (899.995)
    // ──────────────────────────────────────────────────────
    if (!isNaN(amountNum) && amountNum.toString().includes('.')) {
      const decimals = amountNum.toString().split('.')[1] || '';
      if (decimals.length > 2) {
        const rounded = parseFloat(amountNum.toFixed(2));
        addAutoFix(row, anomalies, rowNum, 'amount', 'EXTRA_DECIMAL_PLACES',
          `Amount ${amountNum} has ${decimals.length} decimal places — rounded to ₹${rounded}`);
        row.amount  = rounded.toString();
        row._amount_inr = rounded;
      }
    }

    results.push(row);
  }

  return { rows: results, anomalies };
}

// ── Helpers ────────────────────────────────────────────────

function addAnomaly(row, anomalies, rowNum, field, code, message, suggestion) {
  const a = { row: rowNum, field, code, message, suggestion, type: 'error' };
  row._anomalies.push(a);
  anomalies.push(a);
}

function addAutoFix(row, anomalies, rowNum, field, code, message) {
  const a = { row: rowNum, field, code, message, type: 'auto_fixed' };
  row._autoFixed.push(a);
  anomalies.push(a);
}

// Tries multiple date formats and returns { valid, ambiguous, date }
function parseDate(raw) {
  if (!raw) return { valid: false };

  // DD-MM-YYYY (standard in this file — Indian format)
  // We treat this as unambiguous DD-MM-YYYY UNLESS the notes on the row
  // explicitly say the date might be wrong (like row 34: "04-05-2026" with a note).
  // Truly ambiguous: when day and month are swapped it produces a DIFFERENT valid date
  // AND there is external evidence of confusion (the row's notes mention it).
  // Without that signal we trust DD-MM-YYYY throughout.
  const dmy = raw.match(/^(\d{1,2})-(\d{2})-(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    return { valid: true, ambiguous: false, date };
  }

  // Mar-14 style (e.g. "Mar-14" → March 14, 2026)
  const monDay = raw.match(/^([A-Za-z]{3})-(\d{1,2})$/);
  if (monDay) {
    const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
    const m = months[monDay[1].toLowerCase()];
    if (m) {
      const d    = monDay[2].padStart(2, '0');
      const mon  = m.toString().padStart(2, '0');
      return { valid: true, ambiguous: false, date: `2026-${mon}-${d}` };
    }
  }

  return { valid: false };
}

// Fuzzy name matching: exact → case-insensitive → trimmed
function matchName(rawName, nameMap) {
  if (!rawName) return null;
  const key = rawName.toLowerCase().trim();

  // Exact match
  if (nameMap[key]) return { ...nameMap[key], fuzzy: false };

  // Try matching just the first name (handles "Priya S" → "Priya")
  const firstWord = key.split(/\s+/)[0];
  if (nameMap[firstWord]) return { ...nameMap[firstWord], fuzzy: true };

  // Try stripping trailing spaces/punctuation
  const stripped = key.replace(/[^a-z]/g, '');
  for (const [k, v] of Object.entries(nameMap)) {
    if (k.replace(/[^a-z]/g, '') === stripped) return { ...v, fuzzy: true };
  }

  return null;
}

// Parse split_details like "Rohan 30%; Priya 40%" and sum the values
function parseSplitDetails(details, type) {
  if (!details) return null;
  const parts = details.split(';').map(s => s.trim()).filter(Boolean);
  let total = 0;
  for (const part of parts) {
    const match = part.match(/([\d.]+)\s*%?$/);
    if (match) total += parseFloat(match[1]);
  }
  return total;
}

module.exports = { parseCSV, FX_RATES };
