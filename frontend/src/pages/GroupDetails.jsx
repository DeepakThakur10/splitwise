import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { balanceApi, expenseApi, groupApi, settlementApi, usersApi } from '../api/api';
import ExpenseCard from '../components/ExpenseCard';
import BalanceCard from '../components/BalanceCard';
import ExpenseModal from '../components/ExpenseModal';
import ImportCSV from './ImportCSV';
import { useAuth } from '../context/AuthContext';

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

function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function GroupDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [settlementSuggestions, setSettlementSuggestions] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('expenses');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [addingMember, setAddingMember] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(null);
  const [memberJoinDate, setMemberJoinDate] = useState(today());
  const [adminJoinDate, setAdminJoinDate] = useState('');
  const [settlementForm, setSettlementForm] = useState({ paid_to: '', amount: '', notes: '', settled_at: today() });
  const [settlementSaving, setSettlementSaving] = useState(false);

  const handleAuthFailure = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const reloadAll = async () => {
    setLoading(true);
    setError('');
    setAccessDenied(false);
    try {
      const groupRes = await groupApi.details(id);

      setGroup(groupRes.data);

      const [expensesRes, balanceRes, settlementRes] = await Promise.allSettled([
        expenseApi.list(id),
        balanceApi.get(id),
        settlementApi.list(id)
      ]);

      if (expensesRes.status === 'fulfilled') {
        setExpenses(expensesRes.value.data || []);
      } else {
        setExpenses([]);
      }

      if (balanceRes.status === 'fulfilled') {
        const nextBalances = balanceRes.value.data?.balances || [];
        const nextSettlementSuggestions = balanceRes.value.data?.settlements || [];
        setBalances(nextBalances);
        setSettlementSuggestions(nextSettlementSuggestions);

        if (!settlementForm.paid_to && nextSettlementSuggestions.length) {
          const myPayment = nextSettlementSuggestions.find((item) => Number(item.from) === Number(user?.id));
          setSettlementForm((current) => ({ ...current, paid_to: myPayment?.to ? String(myPayment.to) : current.paid_to }));
        }
      } else {
        setBalances([]);
        setSettlementSuggestions([]);
      }

      if (settlementRes.status === 'fulfilled') {
        setSettlements(settlementRes.value.data || []);
      } else {
        setSettlements([]);
      }
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.error || 'Failed to load group data';

      if (status === 401) {
        handleAuthFailure();
        return;
      }

      if (status === 403) {
        setAccessDenied(true);
        setError(message);
        setGroup(null);
        return;
      }

      setError(message);
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
  const isAdmin = Number(group?.created_by) === Number(user?.id);
  const currentMember = useMemo(() => activeMembers.find((member) => Number(member.user_id) === Number(user?.id)), [activeMembers, user?.id]);
  const adminMembership = useMemo(
    () => group?.members?.find((member) => Number(member.user_id) === Number(group?.created_by)),
    [group]
  );
  const canCorrectAdminJoinDate = Boolean(isAdmin && adminMembership && !adminMembership.joined_at_locked);
  const settlementRecipients = useMemo(
    () => settlementSuggestions
      .filter((item) => Number(item.from) === Number(user?.id))
      .map((item) => ({ user_id: item.to, name: item.to_name, amount: item.amount })),
    [settlementSuggestions, user?.id]
  );

  const handleAddMember = async (userId) => {
    setAddingMember(true);
    setError('');
    try {
      await groupApi.addMember(id, { user_id: userId, joined_at: memberJoinDate || today() });
      setMemberQuery('');
      setMemberResults([]);
      await reloadAll();
    } catch (err) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      setError(err?.response?.data?.error || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleMemberLeave = async (userId) => {
    setLeaveLoading(userId);
    setError('');
    try {
      await groupApi.updateMember(id, userId, {});
      await reloadAll();
    } catch (err) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      setError(err?.response?.data?.error || 'Failed to update member status');
    } finally {
      setLeaveLoading(null);
    }
  };

  const handleAdminJoinDateUpdate = async () => {
    const nextJoinDate = adminJoinDate || toDateInputValue(adminMembership?.joined_at);
    if (!nextJoinDate) return;

    setError('');
    try {
      await groupApi.updateMember(id, user.id, { joined_at: nextJoinDate });
      setAdminJoinDate('');
      await reloadAll();
    } catch (err) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      setError(err?.response?.data?.error || 'Failed to update admin joining date');
    }
  };

  const handleDeleteGroup = async () => {
    setError('');
    try {
      await groupApi.remove(id);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      setError(err?.response?.data?.error || 'Failed to delete group');
    }
  };

  const handleSettlementSubmit = async (event) => {
    event.preventDefault();
    setSettlementSaving(true);
    setError('');

    try {
      const payer = user?.id;
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
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
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
        <div className="glass-panel rounded-[2rem] p-8">{accessDenied ? 'You do not have access to this group.' : (error || 'Group not found.')}</div>
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
              <p className="mt-2 text-sm text-slate-400">Created {formatDate(group.created_at)} by {group.created_by_name || `user ${group.created_by}`}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="chip">{group.members?.length || 0} membership records</span>
              <span className="chip">{activeMembers.length} active members</span>
              <span className="chip">{expenses.length} expenses</span>
              <span className="chip">{settlements.length} settlements</span>
              {isAdmin ? <span className="chip">Admin</span> : null}
            </div>
          </div>

          <div className="w-full max-w-xl rounded-[1.75rem] border border-slate-800 bg-slate-950/50 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Members</h2>
              {isAdmin ? (
                <button type="button" onClick={handleDeleteGroup} className="button-secondary px-3 py-2 text-xs">
                  Delete group
                </button>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              {group.members.map((member) => (
                <div key={member.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-white">{member.name}</p>
                        {Number(member.user_id) === Number(group.created_by) ? <span className="chip">Admin</span> : null}
                      </div>
                      <p className="text-sm text-slate-400">{member.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                      <span className="chip">Joined {formatDate(member.joined_at)}</span>
                      <span className="chip">{member.left_at ? `Left ${formatDate(member.left_at)}` : 'Active'}</span>
                      {isAdmin && !member.left_at ? (
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
                  <input className="input-base" value={currentMember?.name || user?.name || 'You'} disabled />
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm text-slate-300">Paid to</span>
                  <select className="input-base" value={settlementForm.paid_to} onChange={(event) => setSettlementForm({ ...settlementForm, paid_to: event.target.value })} required>
                    <option value="">Select recipient</option>
                    {settlementRecipients.map((recipient) => (
                      <option key={recipient.user_id} value={recipient.user_id}>{recipient.name}</option>
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
        {isAdmin ? <div className="glass-panel rounded-[2rem] p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-white">Add member</h2>
          <p className="mt-2 text-sm text-slate-400">Search by name or email, then add the selected user to this group.</p>

          {canCorrectAdminJoinDate ? (
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-sm font-semibold text-white">Correct your joining date</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  className="input-base sm:max-w-[180px]"
                  type="date"
                  value={adminJoinDate || toDateInputValue(adminMembership.joined_at)}
                  onChange={(event) => setAdminJoinDate(event.target.value)}
                />
                <button type="button" onClick={handleAdminJoinDateUpdate} className="button-secondary px-5 py-3">
                  Save once
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 lg:flex-row">
            <input className="input-base flex-1" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Search users" />
            <input className="input-base lg:max-w-[180px]" type="date" value={memberJoinDate} onChange={(event) => setMemberJoinDate(event.target.value)} />
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
        </div> : null}

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
