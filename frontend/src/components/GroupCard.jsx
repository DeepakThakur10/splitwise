import { Link } from 'react-router-dom';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

export default function GroupCard({ group }) {
  return (
    <Link
      to={`/groups/${group.id}`}
      className="glass-panel group flex h-full flex-col rounded-3xl p-5 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-sky-400/30 hover:bg-slate-900/80"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="chip mb-3">Group</p>
          <h3 className="text-xl font-semibold text-white">{group.name}</h3>
        </div>
        <div className="rounded-2xl bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-300">
          {group.member_count || 0} members
        </div>
      </div>
      <div className="mt-auto grid gap-2 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <span>Created</span>
          <span className="text-slate-100">{formatDate(group.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}