import { useState } from 'react';
import { AdminAPI } from '../../services/endpoints.js';
import { errorMessage } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { StatusBadge } from '../../components/States.jsx';
import DataTable, { PageHeader } from '../../components/admin/DataTable.jsx';
import { formatDateTime, formatMoney } from '../../utils/format.js';

const STATUSES = ['PAID', 'CREATED', 'FAILED', 'REFUND_PENDING', 'REFUNDED'];

export default function AdminPayments() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const { data, loading, error, reload } = useAsync(() => AdminAPI.payments({ status: status || undefined, page, limit: 15 }), [status, page]);

  const retry = async (id) => {
    setBusyId(id);
    try {
      await AdminAPI.refund(id);
      toast.success('Refund completed.');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    { header: 'Booking', cell: (p) => <span className="font-mono text-xs font-semibold">{p.bookingCode}</span> },
    { header: 'Customer', cell: (p) => (p.user ? <div><p className="font-medium">{p.user.name}</p><p className="text-xs text-paper-mute">{p.user.email}</p></div> : 'n/a') },
    { header: 'Amount', cell: (p) => formatMoney(p.amount) },
    { header: 'Provider', cell: (p) => p.provider },
    { header: 'Transaction', cell: (p) => <span className="font-mono text-xs text-paper-mute">{p.providerPaymentId || p.providerOrderId}</span> },
    { header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
    { header: 'Date', cell: (p) => formatDateTime(p.createdAt) },
    { header: 'Actions', cell: (p) => (p.status === 'REFUND_PENDING' ? <button className="btn btn-ghost btn-sm" disabled={busyId === p.id} onClick={() => retry(p.id)}>{busyId === p.id ? 'Retrying…' : 'Retry refund'}</button> : null) },
  ];

  return (
    <div>
      <PageHeader title="Payments" subtitle="Orders, captures and refunds">
        <select className="input w-auto" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}
        </select>
      </PageHeader>
      {error ? <p role="alert" className="panel p-6 text-accent-hover">{error}</p> : (
        <DataTable columns={columns} rows={data?.payments || []} loading={loading} emptyTitle="No payments match"
          pagination={data && { page: data.page, pages: Math.ceil(data.total / data.limit), total: data.total, onPage: setPage }} />
      )}
    </div>
  );
}
