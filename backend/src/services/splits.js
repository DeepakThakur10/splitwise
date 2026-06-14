// src/services/splits.js
// Pure functions — no DB calls, easy to test.
//
// computeSplits(split_type, totalINR, splits) → [{ user_id, amount }]
//
// splits input format per type:
//   equal      → [{ user_id }]                   (amount is ignored)
//   unequal    → [{ user_id, value: 500 }]        (value = exact INR amount)
//   percentage → [{ user_id, value: 30 }]         (value = percentage)
//   share      → [{ user_id, value: 2 }]          (value = number of shares)

function computeSplits(split_type, totalINR, splits) {
  if (!splits || splits.length === 0) {
    throw new Error('splits array cannot be empty');
  }

  switch (split_type) {
    case 'equal':
      return splitEqual(totalINR, splits);
    case 'unequal':
      return splitUnequal(totalINR, splits);
    case 'percentage':
      return splitPercentage(totalINR, splits);
    case 'share':
      return splitShare(totalINR, splits);
    default:
      throw new Error(`Unknown split_type: ${split_type}`);
  }
}

// ── Equal split ────────────────────────────────────────────
// Each person owes the same amount.
// If it doesn't divide evenly, the last person absorbs the rounding penny.
function splitEqual(total, splits) {
  const n    = splits.length;
  const base = Math.floor((total * 100) / n) / 100; // floor to 2dp
  const last = parseFloat((total - base * (n - 1)).toFixed(2));

  return splits.map((s, i) => ({
    user_id: s.user_id,
    amount:  i === n - 1 ? last : base,
  }));
}

// ── Unequal split ──────────────────────────────────────────
// Each person's amount is given explicitly.
// We validate that the amounts sum to the total (within ₹0.02 rounding tolerance).
function splitUnequal(total, splits) {
  const sum = splits.reduce((acc, s) => acc + parseFloat(s.value), 0);

  if (Math.abs(sum - total) > 0.02) {
    throw new Error(
      `Unequal split amounts (${sum}) don't add up to total (${total})`
    );
  }

  return splits.map(s => ({
    user_id: s.user_id,
    amount:  parseFloat(parseFloat(s.value).toFixed(2)),
  }));
}

// ── Percentage split ───────────────────────────────────────
// values are percentages (30, 30, 40 etc.)
// We validate they sum to 100 (within 0.1% tolerance for floating point).
function splitPercentage(total, splits) {
  const sum = splits.reduce((acc, s) => acc + parseFloat(s.value), 0);

  if (Math.abs(sum - 100) > 0.1) {
    throw new Error(
      `Percentages add up to ${sum.toFixed(1)}%, not 100%`
    );
  }

  const n       = splits.length;
  const amounts = splits.map(s =>
    Math.floor((total * parseFloat(s.value) / 100) * 100) / 100
  );

  // Fix rounding so we always hit exactly the total
  const distributed = amounts.reduce((a, b) => a + b, 0);
  const diff = parseFloat((total - distributed).toFixed(2));
  amounts[n - 1] = parseFloat((amounts[n - 1] + diff).toFixed(2));

  return splits.map((s, i) => ({ user_id: s.user_id, amount: amounts[i] }));
}

// ── Share split ────────────────────────────────────────────
// values are share counts (1, 2, 1 etc.)
// Cost-per-share = total / sum_of_shares
function splitShare(total, splits) {
  const totalShares = splits.reduce((acc, s) => acc + parseFloat(s.value), 0);
  if (totalShares === 0) throw new Error('Total shares cannot be 0');

  const perShare = total / totalShares;
  const n        = splits.length;

  const amounts = splits.map(s =>
    Math.floor(parseFloat(s.value) * perShare * 100) / 100
  );

  // Fix rounding remainder on last person
  const distributed = amounts.reduce((a, b) => a + b, 0);
  const diff = parseFloat((total - distributed).toFixed(2));
  amounts[n - 1] = parseFloat((amounts[n - 1] + diff).toFixed(2));

  return splits.map((s, i) => ({ user_id: s.user_id, amount: amounts[i] }));
}

module.exports = { computeSplits, splitEqual, splitUnequal, splitPercentage, splitShare };
