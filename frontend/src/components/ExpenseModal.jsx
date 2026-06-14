import { useEffect, useMemo, useState } from 'react';
import { expenseApi } from '../api/api';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

const today = new Date().toISOString().slice(0, 10);

export default function ExpenseModal({ open, onClose, groupId, members, onCreated }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    description: '',
    amount: '',
    currency: 'INR',
    fx_rate: 1,
    paid_by: '',
    expense_date: today,
    split_type: 'equal',
    notes: ''
  });
  const [splits, setSplits] = useState([]);

  const activeMembers = useMemo(() => {
    if (!form.expense_date) return members;
    const dateVal = new Date(`${form.expense_date}T00:00:00.000Z`).getTime();
    if (Number.isNaN(dateVal)) return members;
    return members.filter((member) => {
      const joinedVal = new Date(member.joined_at).getTime();
      const leftVal = member.left_at ? new Date(member.left_at).getTime() : null;

      if (Number.isNaN(joinedVal)) return true;
      if (dateVal < joinedVal) return false;
      if (leftVal && dateVal > leftVal) return false;
      return true;
    });
  }, [members, form.expense_date]);

  useEffect(() => {
    if (!open) return;
    const defaultMembers = activeMembers.map((member) => ({
      user_id: member.user_id,
      name: member.name,
      included: true,
      value: ''
    }));
    setSplits(defaultMembers);
    setForm({
      description: '',
      amount: '',
      currency: 'INR',
      fx_rate: 1,
      paid_by: activeMembers[0]?.user_id ? String(activeMembers[0].user_id) : '',
      expense_date: today,
      split_type: 'equal',
      notes: ''
    });
    setError('');
  }, [open]);

  useEffect(() => {
    setSplits((current) => {
      const lookup = new Map(current.map((item) => [item.user_id, item]));
      return activeMembers.map((member) => {
        const previous = lookup.get(member.user_id);
        return {
          user_id: member.user_id,
          name: member.name,
          included: previous?.included ?? true,
          value: previous?.value ?? ''
        };
      });
    });
  }, [activeMembers]);

  useEffect(() => {
    setForm((current) => {
      if (activeMembers.length > 0) {
        const isStillActive = activeMembers.some((m) => String(m.user_id) === String(current.paid_by));
        if (!isStillActive) {
          return { ...current, paid_by: String(activeMembers[0].user_id) };
        }
      } else {
        return { ...current, paid_by: '' };
      }
      return current;
    });
  }, [activeMembers]);

  if (!open) return null;

  const updateSplit = (userId, patch) => {
    setSplits((current) => current.map((item) => (item.user_id === userId ? { ...item, ...patch } : item)));
  };

  const selectAll = (included) => {
    setSplits((current) => current.map((item) => ({ ...item, included })));
  };

  const buildSplitsPayload = () => {
    const selected = splits.filter((item) => item.included);

    if (selected.length === 0) {
      throw new Error('Select at least one member');
    }

    if (form.split_type === 'equal') {
      return selected.map((item) => ({ user_id: item.user_id }));
    }

    return selected.map((item) => {
      if (item.value === '' || item.value == null) {
        throw new Error(`Enter a value for ${item.name}`);
      }
      return {
        user_id: item.user_id,
        value: Number(item.value)
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        group_id: Number(groupId),
        description: form.description.trim(),
        amount: Number(form.amount),
        currency: form.currency || 'INR',
        fx_rate: Number(form.fx_rate) || 1,
        paid_by: Number(form.paid_by),
        split_type: form.split_type,
        expense_date: form.expense_date,
        notes: form.notes?.trim() || null,
        splits: buildSplitsPayload()
      };

      await expenseApi.create(payload);
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to add expense');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = splits.filter((item) => item.included).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm sm:items-center">
      <div className="glass-panel max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] p-6 shadow-glow sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Add Expense</h2>
            <p className="mt-1 text-sm text-slate-400">Split expense across selected members in the chosen format.</p>
          </div>
          <button type="button" onClick={onClose} className="button-secondary px-4 py-2">
            Close
          </button>
        </div>

        {error ? <div className="mb-5 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Description</span>
              <input className="input-base" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Dinner at Zest" required />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Amount</span>
              <input className="input-base" type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="2500" required />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Currency</span>
              <input className="input-base" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} placeholder="INR" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">FX Rate</span>
              <input className="input-base" type="number" min="0" step="0.0001" value={form.fx_rate} onChange={(event) => setForm({ ...form, fx_rate: event.target.value })} />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Paid by</span>
              <select className="input-base" value={form.paid_by} onChange={(event) => setForm({ ...form, paid_by: event.target.value })} required>
                <option value="">Select payer</option>
                {activeMembers.map((member) => (
                  <option key={member.user_id} value={member.user_id}>{member.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Expense date</span>
              <input className="input-base" type="date" value={form.expense_date} onChange={(event) => setForm({ ...form, expense_date: event.target.value })} required />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm text-slate-300">Split type</span>
              <select className="input-base" value={form.split_type} onChange={(event) => setForm({ ...form, split_type: event.target.value })}>
                <option value="equal">Equal</option>
                <option value="unequal">Unequal</option>
                <option value="percentage">Percentage</option>
                <option value="share">Share</option>
              </select>
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm text-slate-300">Notes</span>
              <textarea className="input-base min-h-[110px]" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional note" />
            </label>
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/50 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Members</h3>
                <p className="text-sm text-slate-400">Selected: {selectedCount} of {activeMembers.length}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="button-secondary px-3 py-2 text-sm" onClick={() => selectAll(true)}>Select all</button>
                <button type="button" className="button-secondary px-3 py-2 text-sm" onClick={() => selectAll(false)}>Clear</button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {splits.map((item) => (
                <div key={item.user_id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-3 text-sm font-medium text-white">
                      <input type="checkbox" checked={item.included} onChange={(event) => updateSplit(item.user_id, { included: event.target.checked })} className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-cyan-400/30" />
                      {item.name}
                    </label>
                    <span className="text-xs text-slate-500">{item.user_id}</span>
                  </div>
                  {form.split_type !== 'equal' ? (
                    <input
                      className="input-base"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={form.split_type === 'percentage' ? 'Percentage' : form.split_type === 'share' ? 'Shares' : 'Amount'}
                      value={item.value}
                      onChange={(event) => updateSplit(item.user_id, { value: event.target.value })}
                      disabled={!item.included}
                    />
                  ) : (
                    <p className="text-sm text-slate-400">Equal share will be calculated automatically.</p>
                  )}
                </div>
              ))}
            </div>

            {form.amount ? <p className="text-sm text-slate-400">Preview total: {formatCurrency(form.amount)}</p> : null}
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="button-secondary px-5 py-3" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={submitting} className="button-primary px-5 py-3">
              {submitting ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}