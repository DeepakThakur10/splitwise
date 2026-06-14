// src/services/splits.js

// =====================================================
// VALIDATION HELPERS
// =====================================================

function validateExpenseAmount(totalINR) {
  if (isNaN(Number(totalINR))) {
    throw new Error('Expense amount must be a number');
  }

  if (Number(totalINR) <= 0) {
    throw new Error('Expense amount must be greater than zero');
  }
}

function validateUsers(splits) {
  const ids = splits.map(s => s.user_id);

  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate users found in splits');
  }

  for (const split of splits) {
    if (!split.user_id) {
      throw new Error('Every split must contain user_id');
    }
  }
}

function validateValues(splits) {
  for (const split of splits) {
    if (split.value === undefined || split.value === null) {
      continue;
    }

    if (isNaN(Number(split.value))) {
      throw new Error(
        `Invalid value for user ${split.user_id}`
      );
    }

    if (Number(split.value) < 0) {
      throw new Error(
        `Negative value not allowed for user ${split.user_id}`
      );
    }
  }
}

// =====================================================
// MAIN ENTRY
// =====================================================

function computeSplits(split_type, totalINR, splits) {
  validateExpenseAmount(totalINR);

  if (!Array.isArray(splits) || splits.length === 0) {
    throw new Error('splits array cannot be empty');
  }

  validateUsers(splits);
  validateValues(splits);

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
      throw new Error(
        `Unknown split_type: ${split_type}`
      );
  }
}

// =====================================================
// EQUAL SPLIT
// =====================================================

function splitEqual(total, splits) {
  const n = splits.length;

  const base =
    Math.floor((total * 100) / n) / 100;

  const last = parseFloat(
    (total - base * (n - 1)).toFixed(2)
  );

  return splits.map((split, index) => ({
    user_id: split.user_id,
    amount: index === n - 1 ? last : base
  }));
}

// =====================================================
// UNEQUAL SPLIT
// =====================================================

function splitUnequal(total, splits) {
  const sum = splits.reduce(
    (acc, split) =>
      acc + parseFloat(split.value),
    0
  );

  if (Math.abs(sum - total) > 0.02) {
    throw new Error(
      `Unequal split amounts (${sum}) don't add up to total (${total})`
    );
  }

  return splits.map(split => ({
    user_id: split.user_id,
    amount: parseFloat(
      Number(split.value).toFixed(2)
    )
  }));
}

// =====================================================
// PERCENTAGE SPLIT
// =====================================================

function splitPercentage(total, splits) {
  const percentageTotal = splits.reduce(
    (acc, split) =>
      acc + parseFloat(split.value),
    0
  );

  if (Math.abs(percentageTotal - 100) > 0.1) {
    throw new Error(
      `Percentages add up to ${percentageTotal.toFixed(
        2
      )}% instead of 100%`
    );
  }

  const amounts = splits.map(split =>
    Math.floor(
      ((total * parseFloat(split.value)) / 100) * 100
    ) / 100
  );

  const distributed = amounts.reduce(
    (a, b) => a + b,
    0
  );

  const diff = parseFloat(
    (total - distributed).toFixed(2)
  );

  amounts[amounts.length - 1] = parseFloat(
    (amounts[amounts.length - 1] + diff).toFixed(2)
  );

  return splits.map((split, index) => ({
    user_id: split.user_id,
    amount: amounts[index]
  }));
}

// =====================================================
// SHARE SPLIT
// =====================================================

function splitShare(total, splits) {
  for (const split of splits) {
    if (Number(split.value) <= 0) {
      throw new Error(
        `Share count must be greater than zero for user ${split.user_id}`
      );
    }
  }

  const totalShares = splits.reduce(
    (acc, split) =>
      acc + parseFloat(split.value),
    0
  );

  const perShare = total / totalShares;

  const amounts = splits.map(split =>
    Math.floor(
      parseFloat(split.value) *
        perShare *
        100
    ) / 100
  );

  const distributed = amounts.reduce(
    (a, b) => a + b,
    0
  );

  const diff = parseFloat(
    (total - distributed).toFixed(2)
  );

  amounts[amounts.length - 1] = parseFloat(
    (amounts[amounts.length - 1] + diff).toFixed(2)
  );

  return splits.map((split, index) => ({
    user_id: split.user_id,
    amount: amounts[index]
  }));
}

module.exports = {
  computeSplits,
  splitEqual,
  splitUnequal,
  splitPercentage,
  splitShare
};