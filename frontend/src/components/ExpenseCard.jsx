function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export default function ExpenseCard({ expense, onDelete }) {
  return (
    <div className="glass-panel rounded-3xl p-5 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{expense.description}</h3>
            <span className="chip uppercase">{expense.split_type}</span>
          </div>
          <p className="text-sm text-slate-300">Paid by {expense.paid_by_name}</p>
          <p className="text-sm text-slate-400">{formatDate(expense.expense_date)}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-white">{formatCurrency(expense.amount)}</p>
          <p className="text-sm text-slate-400">{expense.currency || 'INR'}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(expense.splits || []).map((split) => (
          <span key={`${expense.id}-${split.user_id}`} className="chip">
            {split.name}: {formatCurrency(split.amount)}
          </span>
        ))}
      </div>

      {onDelete ? (
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={() => onDelete(expense.id)} className="button-secondary px-4 py-2 text-sm">
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}