import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import { BookingsAPI, SeatLocksAPI, ShowsAPI } from '../services/endpoints.js';
import { errorMessage } from '../services/api.js';
import { getSocket } from '../services/socket.js';
import { useToast } from '../context/ToastContext.jsx';
import SeatMap, { SeatLegend } from '../components/SeatMap.jsx';
import { ErrorState, Spinner } from '../components/States.jsx';
import { formatDateTime, formatMoney } from '../utils/format.js';
import { CATEGORY_LABEL, MAX_SEATS } from '../utils/constants.js';
import { uid } from '../utils/uid.js';

export default function SeatSelection() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [show, setShow] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const loadSeats = useCallback(async () => {
    const d = await ShowsAPI.seats(showId);
    setSeats(d.seats);
    setSelected((prev) => new Set([...prev].filter((id) => d.seats.find((s) => s.seatId === id)?.status === 'AVAILABLE')));
  }, [showId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([ShowsAPI.get(showId), ShowsAPI.seats(showId)])
      .then(([s, m]) => { if (active) { setShow(s.show); setSeats(m.seats); } })
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [showId]);

  // Live updates: other customers' holds, bookings and releases arrive over Socket.IO.
  useEffect(() => {
    const socket = getSocket();
    const join = () => { socket.emit('show:join', showId); setLive(true); };
    const onUpdate = ({ showId: id, seatIds, status }) => {
      if (id !== showId) return;
      setSeats((prev) => prev.map((s) => (seatIds.includes(s.seatId) ? { ...s, status, mine: s.mine && status === 'HELD' } : s)));
      if (status !== 'AVAILABLE') {
        const lost = seatIds.filter((sid) => selectedRef.current.has(sid));
        if (lost.length) {
          setSelected((prev) => new Set([...prev].filter((sid) => !lost.includes(sid))));
          toast.info(`${lost.join(', ')} ${lost.length > 1 ? 'were' : 'was'} just taken by someone else.`);
        }
      }
    };
    const onConnect = () => { join(); loadSeats().catch(() => {}); }; // re-sync after a dropped connection
    const onDisconnect = () => setLive(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('seats:update', onUpdate);
    if (socket.connected) join();
    return () => {
      socket.emit('show:leave', showId);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('seats:update', onUpdate);
    };
  }, [showId, loadSeats, toast]);

  const toggle = (seat) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.seatId)) next.delete(seat.seatId);
      else if (next.size >= MAX_SEATS) toast.error(`You can book up to ${MAX_SEATS} seats at a time.`);
      else next.add(seat.seatId);
      return next;
    });
  };

  const chosen = useMemo(() => seats.filter((s) => selected.has(s.seatId)), [seats, selected]);
  const subtotal = chosen.reduce((sum, s) => sum + s.price, 0);
  const aisleAfter = show?.screen?.aisleAfter || 0;

  const proceed = async () => {
    if (!selected.size || busy) return;
    setBusy(true);
    try {
      const { lock } = await SeatLocksAPI.create({ showId, seatIds: [...selected] });
      try {
        const { booking } = await BookingsAPI.create({ lockId: lock.lockId, idempotencyKey: uid() });
        navigate(`/checkout/${booking.id}`);
      } catch (e) {
        await SeatLocksAPI.release(lock.lockId).catch(() => {});
        throw e;
      }
    } catch (err) {
      const gone = err.response?.data?.details?.unavailable;
      if (gone?.length) {
        setSelected((prev) => new Set([...prev].filter((id) => !gone.includes(id))));
        toast.error(`${gone.join(', ')} just got taken. Pick different seats.`);
        loadSeats().catch(() => {});
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Loading seats" />;
  if (error) return <ErrorState message={error} />;
  if (show.status !== 'SCHEDULED') return <ErrorState message="This show has been cancelled." />;

  const summary = (
    <div className="panel p-5">
      <h2 className="text-2xl font-bold">Your booking</h2>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-paper-mute">Movie</dt><dd className="text-right font-medium">{show.movie.title}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-paper-mute">Cinema</dt><dd className="text-right">{show.cinema.name}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-paper-mute">Screen</dt><dd className="text-right">{show.screen.name}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-paper-mute">Show</dt><dd className="text-right">{formatDateTime(show.startTime)}</dd></div>
      </dl>
      <hr className="my-4 border-ink-700" />
      {chosen.length === 0 ? (
        <p className="text-sm text-paper-mute">Tap seats on the map to select them. You can pick up to {MAX_SEATS}.</p>
      ) : (
        <>
          <p className="text-sm text-paper-mute">{chosen.length} {chosen.length === 1 ? 'seat' : 'seats'} selected</p>
          <ul className="mt-2 space-y-1 text-sm">
            {chosen.map((s) => (
              <li key={s.seatId} className="flex justify-between"><span>{s.seatId} <span className="text-paper-mute">({CATEGORY_LABEL[s.category]})</span></span><span>{formatMoney(s.price)}</span></li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-ink-700 pt-3 text-lg font-bold"><span>Tickets</span><span>{formatMoney(subtotal)}</span></div>
          <p className="mt-1 text-xs text-paper-mute">Convenience fee and taxes are added at checkout.</p>
        </>
      )}
      <button className="btn btn-primary mt-5 hidden w-full lg:inline-flex" disabled={!chosen.length || busy} onClick={proceed}>
        {busy ? 'Locking your seats…' : chosen.length ? `Pay ${formatMoney(subtotal)} and continue` : 'Select seats to continue'}
      </button>
      <p className="mt-3 hidden text-xs text-paper-mute lg:block">We hold your seats for 5 minutes once you continue.</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:pb-10">
      <Link to={`/movies/${show.movie.id}/shows`} className="inline-flex items-center gap-1.5 text-sm text-paper-mute hover:text-white"><ArrowLeft className="h-4 w-4" /> Showtimes</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-5xl font-black">{show.movie.title}</h1>
          <p className="mt-1 text-paper-mute">{show.cinema.name}, {show.screen.name}, {formatDateTime(show.startTime)}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs ${live ? 'text-emerald-300' : 'text-paper-mute'}`} aria-live="polite">
          {live ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />} {live ? 'Seats update live' : 'Reconnecting…'}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="panel p-4 sm:p-8" aria-label="Seat map">
          <SeatMap seats={seats} selected={selected} onToggle={toggle} aisleAfter={aisleAfter} />
          <div className="mt-8"><SeatLegend /></div>
        </section>
        <aside className="lg:sticky lg:top-24 lg:self-start">{summary}</aside>
      </div>

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-700 bg-ink-900/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
          <div>
            <p className="text-xs text-paper-mute">{chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'seat' : 'seats'}: ${chosen.map((s) => s.seatId).join(', ')}` : 'No seats selected'}</p>
            <p className="text-xl font-bold">{formatMoney(subtotal)}</p>
          </div>
          <button className="btn btn-primary" disabled={!chosen.length || busy} onClick={proceed}>{busy ? 'Locking…' : 'Continue'}</button>
        </div>
      </div>
    </div>
  );
}
