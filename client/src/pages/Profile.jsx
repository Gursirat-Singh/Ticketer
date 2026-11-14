import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { AuthAPI, BookingsAPI } from '../services/endpoints.js';
import { errorMessage } from '../services/api.js';
import { useAsync } from '../hooks/useAsync.js';
import { ConfirmModal } from '../components/Modal.jsx';
import Poster from '../components/Poster.jsx';
import { EmptyState, ErrorState, Spinner, StatusBadge } from '../components/States.jsx';
import { formatDateTime, formatMoney } from '../utils/format.js';

const CUTOFF_HOURS = 2;

function BookingsTab() {
  const toast = useToast();
  const [bucket, setBucket] = useState('upcoming');
  const { data, loading, error, reload } = useAsync(() => BookingsAPI.mine(bucket), [bucket]);
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);

  const confirmCancel = async () => {
    setBusy(true);
    try {
      await BookingsAPI.cancel(cancelling.id);
      toast.success('Booking cancelled. Your refund has been started.');
      setCancelling(null);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const tabs = [['upcoming', 'Upcoming'], ['past', 'Previous'], ['cancelled', 'Cancelled']];
  return (
    <div>
      <div className="flex gap-2" role="tablist" aria-label="Booking history">
        {tabs.map(([v, label]) => (
          <button key={v} role="tab" aria-selected={bucket === v} onClick={() => setBucket(v)}
            className={`rounded-full border px-4 py-1.5 text-sm ${bucket === v ? 'border-accent bg-accent text-white' : 'border-ink-600 text-paper-dim hover:bg-ink-800'}`}>{label}</button>
        ))}
      </div>

      {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={reload} /> : data.bookings.length === 0 ? (
        <EmptyState title={`No ${bucket === 'past' ? 'previous' : bucket} bookings`} action={bucket === 'upcoming' && <Link to="/movies" className="btn btn-primary btn-sm mt-3">Find a movie</Link>} />
      ) : (
        <ul className="mt-5 space-y-4">
          {data.bookings.map((b) => {
            const hoursLeft = (new Date(b.show.startTime).getTime() - Date.now()) / 3_600_000;
            const canCancel = b.status === 'CONFIRMED' && hoursLeft >= CUTOFF_HOURS;
            return (
              <li key={b.id} className="panel flex gap-4 p-4">
                <Poster movie={b.movie} className="hidden h-28 w-20 shrink-0 rounded-lg sm:block" titleClass="text-base" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="text-2xl font-bold">{b.movie.title}</h3>
                    <StatusBadge status={b.status} />
                    {b.status === 'CANCELLED' && <StatusBadge status={b.refundStatus === 'REFUNDED' ? 'REFUNDED' : 'REFUND_PENDING'} />}
                  </div>
                  <p className="text-sm text-paper-mute">{b.cinema.name}, {b.screen.name}</p>
                  <p className="text-sm text-paper-dim">{formatDateTime(b.show.startTime)}, seats {b.seatIds.join(', ')}</p>
                  <p className="mt-1 text-sm text-paper-mute"><span className="font-mono">{b.bookingCode}</span>, {formatMoney(b.totalAmount)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {b.status === 'CONFIRMED' && <Link to={`/bookings/${b.id}/confirmation`} className="btn btn-ghost btn-sm">View ticket</Link>}
                    {canCancel && <button className="btn btn-danger btn-sm" onClick={() => setCancelling(b)}>Cancel booking</button>}
                    {b.status === 'CONFIRMED' && hoursLeft > 0 && !canCancel && <span className="text-xs text-paper-mute">Cancellation closes {CUTOFF_HOURS} hours before the show.</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {cancelling && (
        <ConfirmModal title="Cancel this booking?" confirmLabel="Cancel booking and refund" busy={busy} onConfirm={confirmCancel} onClose={() => setCancelling(null)}
          message={`${cancelling.movie.title}, seats ${cancelling.seatIds.join(', ')}. The seats go back on sale and ${formatMoney(cancelling.totalAmount)} is refunded to your original payment method.`} />
      )}
    </div>
  );
}

function ProfileTab() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '' });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error('Enter your name.');
    setBusy(true);
    try {
      const { user: u } = await AuthAPI.updateProfile(form);
      setUser(u);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="panel max-w-lg space-y-4 p-6">
      <div><label className="label" htmlFor="p-name">Full name</label><input id="p-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><label className="label" htmlFor="p-email">Email</label><input id="p-email" className="input opacity-70" value={user.email} disabled /></div>
      <div><label className="label" htmlFor="p-phone">Phone</label><input id="p-phone" className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
    </form>
  );
}

function PasswordTab() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return toast.error('The new passwords do not match.');
    if (form.newPassword.length < 8 || !/[A-Za-z]/.test(form.newPassword) || !/\d/.test(form.newPassword)) return toast.error('Use at least 8 characters with a letter and a number.');
    setBusy(true);
    try {
      await AuthAPI.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password changed. Other devices were logged out.');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <form onSubmit={save} className="panel max-w-lg space-y-4 p-6">
      <div><label className="label" htmlFor="cp">Current password</label><input id="cp" type="password" autoComplete="current-password" className="input" value={form.currentPassword} onChange={set('currentPassword')} /></div>
      <div><label className="label" htmlFor="np">New password</label><input id="np" type="password" autoComplete="new-password" className="input" value={form.newPassword} onChange={set('newPassword')} /></div>
      <div><label className="label" htmlFor="cn">Confirm new password</label><input id="cn" type="password" autoComplete="new-password" className="input" value={form.confirm} onChange={set('confirm')} /></div>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Updating…' : 'Change password'}</button>
    </form>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [tab, setTab] = useState('bookings');
  const tabs = [['bookings', 'My bookings'], ['profile', 'Profile'], ['password', 'Password']];
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-5xl font-black">Hi, {user.name.split(' ')[0]}</h1>
      <div className="mt-6 flex gap-6 border-b border-ink-700" role="tablist" aria-label="Account">
        {tabs.map(([v, label]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={`-mb-px border-b-2 pb-3 text-sm font-semibold ${tab === v ? 'border-accent text-white' : 'border-transparent text-paper-mute hover:text-white'}`}>{label}</button>
        ))}
      </div>
      <div className="mt-6">{tab === 'bookings' ? <BookingsTab /> : tab === 'profile' ? <ProfileTab /> : <PasswordTab />}</div>
    </div>
  );
}
