import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(form);
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-gradient px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <span className="chip border-cyan-400/20 bg-cyan-400/10 text-cyan-200">Shared expenses made sharp</span>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">Track groups, expenses, balances, and settlements in one place.</h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Fast workflow for group spending, settlement suggestions, and CSV imports without leaving the browser.</p>
          </div>
        </div>

        <div className="glass-panel rounded-[2rem] p-6 shadow-glow sm:p-8">
          <div className="mb-8">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-slate-400">Welcome back</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Sign in</h2>
          </div>

          {error ? <div className="mb-5 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Email</span>
              <input className="input-base" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" required />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Password</span>
              <input className="input-base" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="••••••••" required />
            </label>
            <button type="submit" disabled={loading} className="button-primary w-full">
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-400">
            New here? <Link to="/register" className="font-semibold text-cyan-300 hover:text-cyan-200">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}