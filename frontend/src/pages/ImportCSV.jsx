import { useEffect, useMemo, useState } from 'react';
import { importApi } from '../api/api';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default function ImportCSV({ groupId, members }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [report, setReport] = useState(null);

  const memberCount = useMemo(() => members.length, [members]);

  const loadLogs = async () => {
    try {
      const { data } = await importApi.logs(groupId);
      setLogs(data);
    } catch {
      setLogs([]);
    }
  };

  useEffect(() => {
    if (groupId) {
      loadLogs();
    }
  }, [groupId]);

  const handlePreview = async (event) => {
    event.preventDefault();
    setError('');
    setReport(null);

    if (!file) {
      setError('Choose a CSV file first');
      return;
    }

    const formData = new FormData();
    formData.append('group_id', groupId);
    formData.append('file', file);

    setLoading(true);
    try {
      const { data } = await importApi.preview(formData);
      setPreview(data.summary);
      setRows(data.rows || []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setError('');

    try {
      const payload = {
        group_id: Number(groupId),
        rows
      };
      const { data } = await importApi.confirm(payload);
      setReport(data);
      await loadLogs();
    } catch (err) {
      setError(err?.response?.data?.error || 'Import failed');
    } finally {
      setConfirming(false);
    }
  };

  const updateRowStatus = (rowIndex, status) => {
    setRows((current) => current.map((row, index) => (index === rowIndex ? { ...row, _status: status } : row)));
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-[2rem] p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold text-white">Import CSV</h3>
            <p className="mt-2 text-sm text-slate-400">Preview imported rows before they touch the database. Group members available: {memberCount}.</p>
          </div>
          <div className="chip">Two-phase import</div>
        </div>

        {error ? <div className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

        <form onSubmit={handlePreview} className="mt-6 flex flex-col gap-3 lg:flex-row">
          <input
            type="file"
            accept=".csv,text/csv"
            className="input-base flex-1 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950 hover:file:bg-cyan-300"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <button type="submit" disabled={loading} className="button-primary min-w-40">
            {loading ? 'Previewing...' : 'Upload & preview'}
          </button>
        </form>
      </div>

      {preview ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {[
            ['Total', preview.total],
            ['OK', preview.ok],
            ['Flagged', preview.flagged],
            ['Skip', preview.skip],
            ['Auto fixed', preview.auto_fixed],
            ['Errors', preview.errors]
          ].map(([label, value]) => (
            <div key={label} className="glass-panel rounded-3xl p-5 shadow-soft">
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </section>
      ) : null}

      {rows.length ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-white">Rows</h3>
            <button type="button" onClick={handleConfirm} disabled={confirming} className="button-primary px-5 py-3">
              {confirming ? 'Confirming...' : 'Confirm import'}
            </button>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950/60 shadow-soft">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-900/80 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Row</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Paid by</th>
                    <th className="px-4 py-3">Split type</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/50 text-slate-200">
                  {rows.map((row, index) => (
                    <tr key={`${row._row}-${index}`}>
                      <td className="px-4 py-3 text-slate-400">{row._row}</td>
                      <td className="px-4 py-3">{row.date}</td>
                      <td className="px-4 py-3">{row.description}</td>
                      <td className="px-4 py-3">{formatCurrency(row._amount_inr || row.amount)}</td>
                      <td className="px-4 py-3">{row._paid_by_name || row.paid_by || '—'}</td>
                      <td className="px-4 py-3">{row.split_type || 'equal'}</td>
                      <td className="px-4 py-3">
                        <select className="input-base max-w-[150px] px-3 py-2 text-sm" value={row._status} onChange={(event) => updateRowStatus(index, event.target.value)}>
                          <option value="ok">ok</option>
                          <option value="flagged">flagged</option>
                          <option value="skip">skip</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {report ? (
        <section className="glass-panel rounded-[2rem] p-6 shadow-soft">
          <h3 className="text-xl font-semibold text-white">Import report</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-sm text-slate-400">Imported</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-300">{report.imported}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-sm text-slate-400">Skipped</p>
              <p className="mt-2 text-3xl font-semibold text-amber-300">{report.skipped}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
              <p className="text-sm text-slate-400">Errors</p>
              <p className="mt-2 text-3xl font-semibold text-rose-300">{report.errors}</p>
            </div>
          </div>
          <pre className="mt-5 overflow-auto rounded-3xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">{JSON.stringify(report.details, null, 2)}</pre>
        </section>
      ) : null}

      <section className="glass-panel rounded-[2rem] p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-white">Import logs</h3>
          <button type="button" onClick={loadLogs} className="button-secondary px-4 py-2 text-sm">Refresh logs</button>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl border border-slate-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/80 text-slate-300">
                <tr>
                  <th className="px-4 py-3">Imported at</th>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Imported</th>
                  <th className="px-4 py-3">Skipped</th>
                  <th className="px-4 py-3">Flagged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/50 text-slate-200">
                {logs.length ? logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3">{formatDate(log.imported_at)}</td>
                    <td className="px-4 py-3">{log.filename || 'expenses_export.csv'}</td>
                    <td className="px-4 py-3">{log.total_rows}</td>
                    <td className="px-4 py-3">{log.imported}</td>
                    <td className="px-4 py-3">{log.skipped}</td>
                    <td className="px-4 py-3">{log.flagged}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-400" colSpan={6}>No import history yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}