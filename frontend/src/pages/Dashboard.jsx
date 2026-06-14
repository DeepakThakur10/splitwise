import { useEffect, useState } from 'react';
import { groupApi } from '../api/api';
import GroupCard from '../components/GroupCard';

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupJoinDate, setGroupJoinDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const loadGroups = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await groupApi.list();
      setGroups(data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await groupApi.create({ name: groupName, joined_at: groupJoinDate || today() });
      setGroupName('');
      setGroupJoinDate(today());
      await loadGroups();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <section className="mb-8 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="glass-panel rounded-[2rem] p-6 shadow-soft sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="chip mb-4">Dashboard</p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Groups</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Create a new group, open an existing workspace, and manage balances in a single place.</p>
            </div>
            <div className="rounded-3xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Updated</p>
              <p className="mt-1 text-sm font-medium text-slate-200">{groups[0]?.created_at ? formatDate(groups[0].created_at) : '—'}</p>
            </div>
          </div>

          {error ? <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

          <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input className="input-base flex-1" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Create a new group" required />
            <input className="input-base sm:max-w-[180px]" type="date" value={groupJoinDate} onChange={(event) => setGroupJoinDate(event.target.value)} required />
            <button type="submit" disabled={saving} className="button-primary min-w-40">
              {saving ? 'Creating...' : 'Create group'}
            </button>
          </form>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="glass-panel rounded-[2rem] p-6 shadow-soft">
            <p className="text-sm text-slate-400">Total groups</p>
            <p className="mt-3 text-4xl font-semibold text-white">{groups.length}</p>
          </div>
          <div className="glass-panel rounded-[2rem] p-6 shadow-soft">
            <p className="text-sm text-slate-400">Workspace</p>
            <p className="mt-3 text-2xl font-semibold text-white">Shared expenses</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">Balances, settlements, expense imports, and activity tracking.</p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">All groups</h2>
          <button type="button" onClick={loadGroups} className="button-secondary px-4 py-2 text-sm">Refresh</button>
        </div>

        {loading ? (
          <div className="glass-panel rounded-[2rem] p-8 text-center text-slate-300">Loading groups...</div>
        ) : groups.length === 0 ? (
          <div className="glass-panel rounded-[2rem] p-8 text-center text-slate-300">No groups yet. Create one to get started.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
