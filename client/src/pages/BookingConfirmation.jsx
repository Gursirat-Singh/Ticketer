import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Download, Mail } from 'lucide-react';
import { BookingsAPI } from '../services/endpoints.js';
import { errorMessage } from '../services/api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ErrorState, Spinner } from '../components/States.jsx';
import { formatDateTime, formatMoney } from '../utils/format.js';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function BookingConfirmation() {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => BookingsAPI.get(bookingId), [bookingId]);
  const [downloading, setDownloading] = useState(false);
  const booking = data?.booking;

  // A payment that is still being confirmed (e.g. webhook in flight): check again shortly.
  useEffect(() => {
    if (booking?.status !== 'CONFIRMING') return undefined;
    const t = setTimeout(reload, 1500);
    return () => clearTimeout(t);
  }, [booking, reload]);

  const download = async () => {
    setDownloading(true);
    try {
      downloadBlob(await BookingsAPI.ticket(booking.id), `ticket-${booking.bookingCode}.pdf`);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not download the ticket.'));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <Spinner label="Loading your ticket" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  if (booking.status === 'CONFIRMING') return <Spinner label="Confirming your payment" />;
  if (booking.status !== 'CONFIRMED') {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-4xl font-black">This booking is {booking.status.replace('_', ' ').toLowerCase()}</h1>
        {booking.failureReason && <p className="mt-2 text-paper-mute">{booking.failureReason}</p>}
        {booking.refundStatus !== 'NONE' && <p className="mt-2 text-paper-dim">Refund status: {booking.refundStatus.toLowerCase()}.</p>}
        <Link to="/movies" className="btn btn-primary mt-8">Browse movies</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3 text-emerald-300"><CheckCircle2 className="h-7 w-7" aria-hidden /><span className="text-lg font-semibold">Payment verified</span></div>
      <h1 className="mt-2 text-5xl font-black">You are going to the movies</h1>
      <p className="mt-2 inline-flex items-center gap-2 text-sm text-paper-mute"><Mail className="h-4 w-4" aria-hidden /> A confirmation with your ticket is on its way to {user?.email}.</p>

      <article className="panel mt-8 overflow-hidden" aria-label="Ticket">
        <div className="grid sm:grid-cols-[1fr_auto]">
          <div className="p-6">
            <h2 className="text-4xl font-black">{booking.movie.title}</h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div><dt className="text-paper-mute">Cinema</dt><dd className="font-semibold">{booking.cinema.name}</dd></div>
              <div><dt className="text-paper-mute">Screen</dt><dd className="font-semibold">{booking.screen.name}</dd></div>
              <div className="col-span-2"><dt className="text-paper-mute">Show time</dt><dd className="font-semibold">{formatDateTime(booking.show.startTime)}</dd></div>
              <div className="col-span-2"><dt className="text-paper-mute">Seats</dt><dd className="text-2xl font-bold">{booking.seatIds.join(', ')}</dd></div>
            </dl>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 border-t border-dashed border-ink-600 p-6 sm:border-l sm:border-t-0">
            {booking.qrCode && <img src={booking.qrCode} alt={`QR code for booking ${booking.bookingCode}`} className="h-40 w-40 rounded-lg bg-white p-2" />}
            <p className="text-xs text-paper-mute">Show this at the entrance</p>
          </div>
        </div>
        <dl className="grid gap-4 border-t border-ink-700 bg-ink-800/50 p-6 text-sm sm:grid-cols-3">
          <div><dt className="text-paper-mute">Booking ID</dt><dd className="font-mono text-base font-bold">{booking.bookingCode}</dd></div>
          <div><dt className="text-paper-mute">Amount paid</dt><dd className="font-semibold">{formatMoney(booking.totalAmount)}</dd></div>
          <div><dt className="text-paper-mute">Payment</dt><dd className="font-semibold text-emerald-300">Paid, online</dd></div>
        </dl>
      </article>

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn btn-primary" onClick={download} disabled={downloading}><Download className="h-4 w-4" /> {downloading ? 'Preparing PDF…' : 'Download ticket (PDF)'}</button>
        <Link to="/profile" className="btn btn-ghost">View all bookings</Link>
      </div>
    </div>
  );
}
