import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, FlaskConical, ShieldCheck, Timer } from 'lucide-react';
import { BookingsAPI, PaymentsAPI, SeatLocksAPI } from '../services/endpoints.js';
import { errorMessage } from '../services/api.js';
import { useAsync } from '../hooks/useAsync.js';
import { mmss, useCountdown } from '../hooks/useCountdown.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorState, Spinner } from '../components/States.jsx';
import { formatDateTime, formatMoney } from '../utils/format.js';

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the Razorpay checkout. Check your connection.'));
    document.body.appendChild(s);
    return undefined;
  });
}

function Row({ label, value, strong }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'text-lg font-bold' : 'text-sm'}`}>
      <dt className={strong ? '' : 'text-paper-mute'}>{label}</dt><dd className="text-right">{value}</dd>
    </div>
  );
}

export default function Checkout() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => BookingsAPI.get(bookingId), [bookingId]);
  const booking = data?.booking;
  const left = useCountdown(booking?.status === 'PENDING_PAYMENT' ? booking.holdExpiresAt : null);

  const [order, setOrder] = useState(null); // set when the mock gateway panel is open
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState('');
  const [failed, setFailed] = useState(false);

  if (loading) return <Spinner label="Loading your booking" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (booking.status === 'CONFIRMED') return <Navigate to={`/bookings/${booking.id}/confirmation`} replace />;

  const expired = booking.status === 'PENDING_PAYMENT' && left === 0;
  const payable = booking.status === 'PENDING_PAYMENT' && !expired && !failed;
  const seatsLink = `/shows/${booking.show.id}/seats`;

  const finish = async (p) => {
    try {
      await PaymentsAPI.verify({ bookingId: booking.id, orderId: p.orderId, paymentId: p.paymentId, signature: p.signature });
      navigate(`/bookings/${booking.id}/confirmation`, { replace: true });
    } catch (e) {
      setPayError(errorMessage(e));
      setOrder(null);
    }
  };

  const markFailed = async () => {
    await PaymentsAPI.fail(booking.id).catch(() => {});
    setFailed(true);
    setOrder(null);
    setPayError('The payment did not go through, so your seats were released. No money was taken.');
  };

  const payWithRazorpay = async (o) => {
    await loadRazorpay();
    const rzp = new window.Razorpay({
      key: o.keyId,
      amount: o.amount,
      currency: o.currency,
      order_id: o.orderId,
      name: 'Marquee',
      description: `${booking.movie.title}, ${booking.seatIds.join(', ')}`,
      prefill: { name: user?.name, email: user?.email, contact: user?.phone },
      theme: { color: '#e8283a' },
      handler: (r) => finish({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
      modal: { ondismiss: () => setBusy(false) },
    });
    rzp.on('payment.failed', markFailed);
    rzp.open();
  };

  const startPayment = async () => {
    setBusy(true);
    setPayError('');
    try {
      const { order: o } = await PaymentsAPI.createOrder(booking.id);
      if (o.provider === 'razorpay') await payWithRazorpay(o);
      else setOrder(o);
    } catch (e) {
      setPayError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const mockPay = async () => {
    setBusy(true);
    try {
      await finish(await PaymentsAPI.mockComplete(order.orderId));
    } catch (e) {
      setPayError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const giveUp = async () => {
    setBusy(true);
    await SeatLocksAPI.release(booking.holdId).catch(() => {});
    navigate(seatsLink);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-5xl font-black">Checkout</h1>

      {booking.status === 'PENDING_PAYMENT' && !expired && !failed && (
        <p className={`mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${left <= 60 ? 'border-accent/50 bg-accent/10 text-accent-hover' : 'border-ink-600 bg-ink-800 text-paper-dim'}`} role="timer" aria-live="off">
          <Timer className="h-4 w-4" aria-hidden /> Seats held for <b className="tabular-nums">{mmss(left)}</b>
        </p>
      )}
      {(expired || (booking.status !== 'PENDING_PAYMENT' && !failed)) && (
        <div className="panel mt-4 flex items-start gap-3 border-accent/40 p-4" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-hover" aria-hidden />
          <div>
            <p className="font-semibold">
              {expired || booking.status === 'EXPIRED' ? 'Your 5 minute seat hold has expired.' : `This booking is ${booking.status.replace('_', ' ').toLowerCase()}.`}
            </p>
            {booking.failureReason && <p className="text-sm text-paper-mute">{booking.failureReason}</p>}
            <Link to={seatsLink} className="btn btn-primary btn-sm mt-3">Choose seats again</Link>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="panel p-6" aria-label="Order summary">
          <h2 className="text-3xl font-bold">{booking.movie.title}</h2>
          <p className="text-sm text-paper-mute">{booking.movie.language}, rated {booking.movie.certification}</p>
          <dl className="mt-5 space-y-2">
            <Row label="Cinema" value={`${booking.cinema.name}, ${booking.cinema.city}`} />
            <Row label="Screen" value={booking.screen.name} />
            <Row label="Show" value={formatDateTime(booking.show.startTime)} />
            <Row label="Seats" value={booking.seatIds.join(', ')} />
          </dl>
          <hr className="my-5 border-ink-700" />
          <dl className="space-y-2">
            <Row label={`Tickets (${booking.seatIds.length})`} value={formatMoney(booking.subtotal)} />
            <Row label="Convenience fee" value={formatMoney(booking.convenienceFee)} />
            <Row label="Taxes" value={formatMoney(booking.tax)} />
          </dl>
          <div className="mt-4 border-t border-ink-700 pt-4"><Row strong label="Amount payable" value={formatMoney(booking.totalAmount)} /></div>
        </section>

        <aside className="panel h-fit p-6" aria-label="Payment">
          <h2 className="text-2xl font-bold">Payment</h2>
          {payError && <p role="alert" className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-hover">{payError}</p>}

          {order ? (
            <div className="mt-4 space-y-3">
              <p className="inline-flex items-center gap-2 rounded-md bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold"><FlaskConical className="h-3.5 w-3.5" /> Test gateway, no real money</p>
              <p className="text-sm text-paper-dim">This stands in for Razorpay in demo mode. Paying signs the order the same way the real gateway does, and the server verifies it.</p>
              <button className="btn btn-primary w-full" disabled={busy || left === 0} onClick={mockPay}>{busy ? 'Processing…' : `Pay ${formatMoney(order.amount)}`}</button>
              <button className="btn btn-ghost w-full" disabled={busy} onClick={markFailed}>Simulate a failed payment</button>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-paper-mute">You will pay {formatMoney(booking.totalAmount)}. Tickets are issued only after the payment is verified.</p>
              <button className="btn btn-primary mt-5 w-full py-3" disabled={!payable || busy} onClick={startPayment}>{busy ? 'Starting payment…' : `Pay ${formatMoney(booking.totalAmount)}`}</button>
            </>
          )}

          {payable && <button className="btn btn-ghost mt-3 w-full" disabled={busy} onClick={giveUp}>Release seats and go back</button>}
          <p className="mt-5 inline-flex items-center gap-2 text-xs text-paper-mute"><ShieldCheck className="h-4 w-4" aria-hidden /> Price and seats are re-checked on the server.</p>
        </aside>
      </div>
    </div>
  );
}
