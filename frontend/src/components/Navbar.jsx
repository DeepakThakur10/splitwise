import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <NavLink to="/dashboard" className="flex items-center gap-3 text-lg font-semibold tracking-tight text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20">S</span>
          <span>Splitwise Clone</span>
        </NavLink>

        <nav className="flex items-center gap-2 sm:gap-3">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `rounded-2xl px-4 py-2 text-sm font-medium transition ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`
            }
          >
            Dashboard
          </NavLink>
          <div className="hidden rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-300 md:block">
            {user?.name || 'Account'}
          </div>
          <button type="button" onClick={handleLogout} className="button-secondary px-4 py-2">
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}