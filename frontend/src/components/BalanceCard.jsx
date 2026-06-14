function formatCurrency(value) {
  const absolute = Math.abs(Number(value || 0));
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(absolute);
}

export default function BalanceCard({ balance }) {
  const positive = Number(balance.net) > 0;

  return (
    <div className="glass-panel rounded-3xl p-5 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{balance.name}</h3>
          <p className="text-sm text-slate-400">Net balance</p>
        </div>
        <div className={`rounded-2xl px-4 py-2 text-lg font-semibold ${positive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
          {positive ? '+' : '-'}{formatCurrency(balance.net)}
        </div>
      </div>
    </div>
  );
}