import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Shield, Ticket, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export const Logo = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-2 font-display text-3xl font-black tracking-wide ${className}`}>
    <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden>
      <path d="M12 48V16l20 22 20-22v32" fill="none" stroke="#e8283a" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
    Marquee
  </span>
);

const link = ({ isActive }) => `rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-paper-dim hover:text-white'}`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const onLogout = async () => {
    await logout();
    close();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" onClick={close} aria-label="Marquee home"><Logo /></Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          <NavLink to="/movies" className={link}>Movies</NavLink>
          <NavLink to="/cinemas" className={link}>Cinemas</NavLink>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {user.role === 'admin' && (
                <Link to="/admin" className="btn btn-ghost btn-sm"><Shield className="h-4 w-4" /> Admin</Link>
              )}
              <Link to="/profile" className="btn btn-ghost btn-sm"><User className="h-4 w-4" /> {user.name.split(' ')[0]}</Link>
              <button onClick={onLogout} className="btn btn-ghost btn-sm" aria-label="Log out"><LogOut className="h-4 w-4" /></button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
            </>
          )}
        </div>

        <button className="rounded-md p-2 text-paper-dim hover:bg-ink-800 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-ink-700 px-4 py-3 md:hidden" aria-label="Mobile">
          <NavLink to="/movies" className={link} onClick={close}>Movies</NavLink>
          <NavLink to="/cinemas" className={link} onClick={close}>Cinemas</NavLink>
          {user ? (
            <>
              <NavLink to="/profile" className={link} onClick={close}><Ticket className="mr-2 inline h-4 w-4" />My bookings</NavLink>
              {user.role === 'admin' && <NavLink to="/admin" className={link} onClick={close}>Admin dashboard</NavLink>}
              <button onClick={onLogout} className="px-3 py-2 text-left text-sm text-paper-dim hover:text-white">Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={link} onClick={close}>Log in</NavLink>
              <NavLink to="/register" className={link} onClick={close}>Sign up</NavLink>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
