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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <NavLink to="/dashboard" className="flex items-center gap-3 text-lg font-semibold tracking-tight text-slate-950">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-sm">S</span>
          <span>Splitwise</span>
        </NavLink>

        <nav className="flex items-center gap-2 sm:gap-3">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `rounded-lg px-4 py-2 text-sm font-medium transition ${isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`
            }
          >
            Dashboard
          </NavLink>
          <div className="hidden rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 md:block">
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
