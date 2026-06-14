import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { balanceApi, expenseApi, groupApi, settlementApi, usersApi } from '../api/api';
import ExpenseCard from '../components/ExpenseCard';
import BalanceCard from '../components/BalanceCard';
import ExpenseModal from '../components/ExpenseModal';
import ImportCSV from './ImportCSV';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

function formatCurrency(value) {
  const amount = Math.abs(Number(value || 0));
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function GroupDetails() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [settlementSuggestions, setSettlementSuggestions] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('expenses');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [addingMember, setAddingMember] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(null);
  const [settlementForm, setSettlementForm] = useState({ paid_to: '', amount: '', notes: '', settled_at: today() });
  const [settlementSaving, setSettlementSaving] = useState(false);

  const reloadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [groupRes, expensesRes, balanceRes, settlementRes] = await Promise.all([
        groupApi.details(id),
        expenseApi.list(id),
        balanceApi.get(id),
        settlementApi.list(id)
      ]);

      setGroup(groupRes.data);
      setExpenses(expensesRes.data || []);
      setBalances(balanceRes.data?.balances || []);
      setSettlementSuggestions(balanceRes.data?.settlements || []);
      setSettlements(settlementRes.data || []);

      if (!settlementForm.paid_to && balanceRes.data?.balances?.length) {
        const creditor = balanceRes.data.balances.find((item) => Number(item.net) < 0) || balanceRes.data.balances[0];
        setSettlementForm((current) => ({ ...current, paid_to: creditor?.user_id ? String(creditor.user_id) : '' }));
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load group data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();
  }, [id]);

  useEffect(() => {
    if (memberQuery.length < 2) {
      setMemberResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { data } = await usersApi.search(memberQuery);
        setMemberResults(data || []);
      } catch {
        setMemberResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [memberQuery]);

  const activeMembers = useMemo(() => group?.members?.filter((member) => !member.left_at) || [], [group]);

  const handleAddMember = async (userId) => {
    setAddingMember(true);
    setError('');
    try {
      await groupApi.addMember(id, { user_id: userId, joined_at: today() });
      setMemberQuery('');
      setMemberResults([]);
      await reloadAll();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleMemberLeave = async (userId) => {
    setLeaveLoading(userId);
    setError('');
    try {
      await groupApi.updateMember(id, userId, { left_at: today() });
      await reloadAll();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to update member status');
    } finally {
      setLeaveLoading(null);
    }
  };

  const handleSettlementSubmit = async (event) => {
    event.preventDefault();
    setSettlementSaving(true);
    setError('');

    try {
      const payer = activeMembers[0]?.user_id;
      await settlementApi.create({
        group_id: Number(id),
        paid_by: Number(payer),
        paid_to: Number(settlementForm.paid_to),
        amount: Number(settlementForm.amount),
        settled_at: settlementForm.settled_at,
        notes: settlementForm.notes || null
      });
      setSettlementForm((current) => ({ ...current, amount: '', notes: '' }));
      await reloadAll();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create settlement');
    } finally {
      setSettlementSaving(false);
    }
  };

  const tabs = [
    ['expenses', 'Expenses'],
    ['balances', 'Balances'],
    ['settlements', 'Settlements'],
    ['import', 'Import CSV']
  ];

  if (loading && !group) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-4 py-10 text-slate-300 sm:px-6 lg:px-8">
        Loading group details...
      </main>
    );
  }

  if (!group) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 text-slate-200 sm:px-6 lg:px-8">
        <div className="glass-panel rounded-[2rem] p-8">Group not found.</div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <section className="glass-panel rounded-[2rem] p-6 shadow-soft sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div>
              <p className="chip mb-3">Group details</p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{group.name}</h1>
              <p className="mt-2 text-sm text-slate-400">Created {formatDate(group.created_at)} by user {group.created_by}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="chip">{group.members?.length || 0} membership records</span>
              <span className="chip">{activeMembers.length} active members</span>
              <span className="chip">{expenses.length} expenses</span>
              <span className="chip">{settlements.length} settlements</span>
            </div>
          </div>

          <div className="w-full max-w-xl rounded-[1.75rem] border border-slate-800 bg-slate-950/50 p-5">
            <h2 className="text-lg font-semibold text-white">Members</h2>
            <div className="mt-4 space-y-3">
              {group.members.map((member) => (
                <div key={member.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{member.name}</p>
                      <p className="text-sm text-slate-400">{member.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                      <span className="chip">Joined {formatDate(member.joined_at)}</span>
                      <span className="chip">{member.left_at ? `Left ${formatDate(member.left_at)}` : 'Active'}</span>
                      {!member.left_at ? (
                        <button type="button" onClick={() => handleMemberLeave(member.user_id)} disabled={leaveLoading === member.user_id} className="button-secondary px-3 py-2 text-xs">
                          {leaveLoading === member.user_id ? 'Updating...' : 'Mark left'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error ? <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

        <div className="mt-6 flex flex-wrap gap-2 rounded-[1.5rem] border border-slate-800 bg-slate-950/50 p-2">
          {tabs.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${tab === key ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:bg-slate-900'}`}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        {tab === 'expenses' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">Expenses</h2>
              <button type="button" onClick={() => setShowExpenseModal(true)} className="button-primary px-5 py-3">Add expense</button>
            </div>

            <div className="grid gap-4">
              {expenses.length ? expenses.map((expense) => (
                <ExpenseCard key={expense.id} expense={expense} onDelete={async (expenseId) => {
                  await expenseApi.remove(expenseId);
                  await reloadAll();
                }} />
              )) : (
                <div className="glass-panel rounded-[2rem] p-8 text-center text-slate-300">No expenses yet.</div>
              )}
            </div>
          </div>
        ) : null}

        {tab === 'balances' ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Balances</h2>
              <p className="mt-2 text-sm text-slate-400">Net balance per member and settlement suggestions.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {balances.length ? balances.map((balance) => (
                <BalanceCard key={balance.user_id} balance={balance} />
              )) : (
                <div className="glass-panel rounded-[2rem] p-8 text-slate-300">No balances yet.</div>
              )}
            </div>

            <div>
              <h3 className="mb-4 text-lg font-semibold text-white">Settlement suggestions</h3>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {settlementSuggestions.length ? settlementSuggestions.map((item, index) => (
                  <div key={`${item.from}-${item.to}-${index}`} className="glass-panel rounded-3xl p-5 shadow-soft">
                    <p className="text-sm text-slate-400">Suggested payment</p>
                    <p className="mt-3 text-xl font-semibold text-white">{item.from_name} → {item.to_name}</p>
                    <p className="mt-2 text-2xl font-semibold text-cyan-300">{formatCurrency(item.amount)}</p>
                  </div>
                )) : (
                  <div className="glass-panel rounded-[2rem] p-8 text-slate-300">No settlement suggestions available.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'settlements' ? (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="glass-panel rounded-[2rem] p-6 shadow-soft">
              <h2 className="text-xl font-semibold text-white">Create settlement</h2>
              <form onSubmit={handleSettlementSubmit} className="mt-6 space-y-4">
                <label className="space-y-2 block">
                  <span className="text-sm text-slate-300">Paid by</span>
                  <input className="input-base" value={activeMembers[0]?.name || 'You'} disabled />
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm text-slate-300">Paid to</span>
                  <select className="input-base" value={settlementForm.paid_to} onChange={(event) => setSettlementForm({ ...settlementForm, paid_to: event.target.value })} required>
                    <option value="">Select recipient</option>
                    {balances.map((balance) => (
                      <option key={balance.user_id} value={balance.user_id}>{balance.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm text-slate-300">Amount</span>
                  <input className="input-base" type="number" min="0" step="0.01" value={settlementForm.amount} onChange={(event) => setSettlementForm({ ...settlementForm, amount: event.target.value })} required />
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm text-slate-300">Settled at</span>
                  <input className="input-base" type="date" value={settlementForm.settled_at} onChange={(event) => setSettlementForm({ ...settlementForm, settled_at: event.target.value })} required />
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm text-slate-300">Notes</span>
                  <textarea className="input-base min-h-[110px]" value={settlementForm.notes} onChange={(event) => setSettlementForm({ ...settlementForm, notes: event.target.value })} placeholder="Optional note" />
                </label>
                <button type="submit" disabled={settlementSaving} className="button-primary w-full">
                  {settlementSaving ? 'Saving...' : 'Create settlement'}
                </button>
              </form>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">Settlement history</h2>
              {settlements.length ? settlements.map((settlement) => (
                <div key={settlement.id} className="glass-panel rounded-3xl p-5 shadow-soft">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-white">{settlement.paid_by_name} → {settlement.paid_to_name}</p>
                      <p className="mt-1 text-sm text-slate-400">{formatDate(settlement.settled_at)}</p>
                      {settlement.notes ? <p className="mt-2 text-sm text-slate-300">{settlement.notes}</p> : null}
                    </div>
                    <div className="text-2xl font-semibold text-cyan-300">{formatCurrency(settlement.amount)}</div>
                  </div>
                </div>
              )) : (
                <div className="glass-panel rounded-[2rem] p-8 text-slate-300">No settlements recorded.</div>
              )}
            </div>
          </div>
        ) : null}

        {tab === 'import' ? <ImportCSV groupId={id} members={group.members} /> : null}
      </section>

      <section className="mt-8 space-y-6">
        <div className="glass-panel rounded-[2rem] p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-white">Add member</h2>
          <p className="mt-2 text-sm text-slate-400">Search by name or email, then add the selected user to this group.</p>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row">
            <input className="input-base flex-1" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Search users" />
            <button type="button" disabled className="button-secondary px-5 py-3">{addingMember ? 'Adding...' : 'Search enabled below'}</button>
          </div>

          {memberResults.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {memberResults.map((user) => (
                <div key={user.id} className="rounded-3xl border border-slate-800 bg-slate-950/50 p-4">
                  <p className="font-semibold text-white">{user.name}</p>
                  <p className="text-sm text-slate-400">{user.email}</p>
                  <button type="button" onClick={() => handleAddMember(user.id)} disabled={addingMember} className="button-primary mt-4 px-4 py-2 text-sm">
                    Add to group
                  </button>
                </div>
              ))}
            </div>
          ) : memberQuery.length >= 2 ? (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">No matching users found.</div>
          ) : null}
        </div>

        <div className="glass-panel rounded-[2rem] p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-white">Member timeline</h2>
          <div className="mt-4 space-y-3">
            {group.members.map((member) => (
              <div key={`timeline-${member.id}`} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
                {member.name} joined {formatDate(member.joined_at)}{member.left_at ? ` and left ${formatDate(member.left_at)}` : ''}
              </div>
            ))}
          </div>
        </div>
      </section>

      <ExpenseModal
        open={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        groupId={id}
        members={group.members}
        onCreated={reloadAll}
      />
    </main>
  );
}