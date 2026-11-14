import { NavLink, Outlet, Link } from 'react-router-dom';
import { BarChart3, Building2, CreditCard, Film, LayoutGrid, Armchair, Ticket, Users, CalendarClock, ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Navbar.jsx';

const items = [
  ['/admin', 'Dashboard', BarChart3, true],
  ['/admin/movies', 'Movies', Film],
  ['/admin/cinemas', 'Cinemas', Building2],
  ['/admin/screens', 'Screens and seats', Armchair],
  ['/admin/shows', 'Shows', CalendarClock],
  ['/admin/bookings', 'Bookings', Ticket],
  ['/admin/users', 'Users', Users],
  ['/admin/payments', 'Payments', CreditCard],
];

export default function AdminLayout() {
  const cls = ({ isActive }) =>
    `flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-accent/15 text-white' : 'text-paper-dim hover:bg-ink-800 hover:text-white'}`;
  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-ink-700 bg-ink-900 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-3 lg:py-5">
          <Link to="/admin" aria-label="Admin home"><Logo /></Link>
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-paper-mute hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Site</Link>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Admin">
          {items.map(([to, label, Icon, end]) => (
            <NavLink key={to} to={to} end={end} className={cls}><Icon className="h-4 w-4" aria-hidden /> {label}</NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></main>
    </div>
  );
}
