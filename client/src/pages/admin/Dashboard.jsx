import { AdminAPI } from '../../services/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import { ErrorState, Spinner } from '../../components/States.jsx';
import { PageHeader } from '../../components/admin/DataTable.jsx';
import { formatMoney } from '../../utils/format.js';

function Stat({ label, value, hint }) {
  return (
    <div className="panel p-5">
      <p className="text-sm text-paper-mute">{label}</p>
      <p className="mt-1 font-display text-5xl font-black tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-paper-mute">{hint}</p>}
    </div>
  );
}

export default function Dashboard() {
  const stats = useAsync(() => AdminAPI.dashboard(), []);
  const trends = useAsync(() => AdminAPI.analytics(), []);
  if (stats.loading || trends.loading) return <Spinner />;
  if (stats.error || trends.error) return <ErrorState message={stats.error || trends.error} onRetry={() => { stats.reload(); trends.reload(); }} />;

  const s = stats.data;
  const { revenueByDay, popularMovies } = trends.data;
  const maxRevenue = Math.max(1, ...revenueByDay.map((r) => r.revenue));
  const maxTickets = Math.max(1, ...popularMovies.map((m) => m.tickets));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live numbers from confirmed bookings" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Total revenue" value={formatMoney(s.totalRevenue)} />
        <Stat label="Confirmed bookings" value={s.totalBookings.toLocaleString('en-IN')} />
        <Stat label="Registered users" value={s.totalUsers.toLocaleString('en-IN')} />
        <Stat label="Movies" value={s.totalMovies} />
        <Stat label="Active shows" value={s.activeShows} hint="Scheduled and still to start" />
        <Stat label="Seat occupancy" value={`${s.occupancyPercent}%`} hint="Booked seats across upcoming shows" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="panel p-5" aria-label="Revenue trend">
          <h2 className="text-2xl font-bold">Revenue, last 30 days</h2>
          {revenueByDay.length === 0 ? <p className="mt-4 text-sm text-paper-mute">No confirmed bookings in the last 30 days.</p> : (
            <ul className="mt-4 space-y-2">
              {revenueByDay.slice(-14).map((r) => (
                <li key={r.date} className="grid grid-cols-[5.5rem_1fr_6rem] items-center gap-3 text-sm">
                  <span className="text-paper-mute">{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  <span className="h-3 overflow-hidden rounded-full bg-ink-700"><span className="block h-full rounded-full bg-accent" style={{ width: `${(r.revenue / maxRevenue) * 100}%` }} /></span>
                  <span className="text-right tabular-nums">{formatMoney(r.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5" aria-label="Most popular movies">
          <h2 className="text-2xl font-bold">Most popular movies</h2>
          {popularMovies.length === 0 ? <p className="mt-4 text-sm text-paper-mute">No tickets sold yet.</p> : (
            <ol className="mt-4 space-y-3">
              {popularMovies.map((m) => (
                <li key={m.movieId}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{m.title}</span><span className="text-paper-mute">{m.tickets} tickets, {formatMoney(m.revenue)}</span></div>
                  <span className="mt-1 block h-2 overflow-hidden rounded-full bg-ink-700"><span className="block h-full rounded-full bg-velvet" style={{ width: `${(m.tickets / maxTickets) * 100}%` }} /></span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
