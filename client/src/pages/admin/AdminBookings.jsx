import { useState } from 'react';
import { AdminAPI, BookingsAPI } from '../../services/endpoints.js';
import { errorMessage } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ConfirmModal } from '../../components/Modal.jsx';
import { StatusBadge } from '../../components/States.jsx';
import DataTable, { PageHeader } from '../../components/admin/DataTable.jsx';
import { formatDateTime, formatMoney } from '../../utils/format.js';

const STATUSES = ['CONFIRMED', 'PENDING_PAYMENT', 'CANCELLED', 'FAILED', 'EXPIRED'];

export default function AdminBookings() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounce(q);
  const { data, loading, error, reload } = useAsync(() => AdminAPI.bookings({ status: status || undefined, q: search || undefined, page, limit: 15 }), [status, search, page]);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    setBusy(true);
    try {
      await BookingsAPI.cancel(target.id);
      toast.success('Booking cancelled and refund started.');
      setTarget(null);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { header: 'Booking', cell: (b) => <span className="font-mono text-xs font-semibold">{b.bookingCode}</span> },
    { header: 'Customer', cell: (b) => <div><p className="font-medium">{b.user?.name}</p><p className="text-xs text-paper-mute">{b.user?.email}</p></div> },
    { header: 'Movie and show', cell: (b) => <div><p>{b.movie.title}</p><p className="text-xs text-paper-mute">{b.cinema.name}, {formatDateTime(b.show.startTime)}</p></div> },
    { header: 'Seats', cell: (b) => b.seatIds.join(', ') },
    { header: 'Amount', cell: (b) => formatMoney(b.totalAmount) },
    { header: 'Status', cell: (b) => <StatusBadge status={b.status} /> },
    { header: 'Actions', cell: (b) => (b.status === 'CONFIRMED' ? <button className="btn btn-danger btn-sm" onClick={() => setTarget(b)}>Cancel and refund</button> : null) },
  ];

  return (
    <div>
      <PageHeader title="Bookings" subtitle="Every booking across all shows">
        <input className="input w-44" placeholder="Booking ID" aria-label="Search by booking ID" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="input w-auto" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}
        </select>
      </PageHeader>
      {error ? <p role="alert" className="panel p-6 text-accent-hover">{error}</p> : (
        <DataTable columns={columns} rows={data?.bookings || []} loading={loading} emptyTitle="No bookings match"
          pagination={data && { page: data.page, pages: Math.ceil(data.total / data.limit), total: data.total, onPage: setPage }} />
      )}
      {target && (
        <ConfirmModal title="Cancel this booking?" confirmLabel="Cancel and refund" busy={busy} onConfirm={cancel} onClose={() => setTarget(null)}
          message={`${target.bookingCode} for ${target.user?.name}: seats ${target.seatIds.join(', ')} go back on sale and ${formatMoney(target.totalAmount)} is refunded.`} />
      )}
    </div>
  );
}
