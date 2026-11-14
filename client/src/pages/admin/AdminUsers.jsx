import { useState } from 'react';
import { AdminAPI } from '../../services/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { StatusBadge } from '../../components/States.jsx';
import DataTable, { PageHeader } from '../../components/admin/DataTable.jsx';
import { formatDate, formatMoney } from '../../utils/format.js';

export default function AdminUsers() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounce(q);
  const { data, loading, error } = useAsync(() => AdminAPI.users({ q: search || undefined, page, limit: 15 }), [search, page]);

  const columns = [
    { header: 'Name', cell: (u) => <span className="font-semibold">{u.name}</span> },
    { header: 'Email', cell: (u) => u.email },
    { header: 'Phone', cell: (u) => u.phone || 'n/a' },
    { header: 'Role', cell: (u) => <StatusBadge status={u.role} /> },
    { header: 'Bookings', cell: (u) => u.bookings },
    { header: 'Spent', cell: (u) => formatMoney(u.spent) },
    { header: 'Joined', cell: (u) => formatDate(u.createdAt) },
  ];
  return (
    <div>
      <PageHeader title="Users" subtitle="Registered customers and admins">
        <input className="input w-56" placeholder="Search name or email" aria-label="Search users" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </PageHeader>
      {error ? <p role="alert" className="panel p-6 text-accent-hover">{error}</p> : (
        <DataTable columns={columns} rows={data?.users || []} loading={loading} emptyTitle="No users match"
          pagination={data && { page: data.page, pages: Math.ceil(data.total / data.limit), total: data.total, onPage: setPage }} />
      )}
    </div>
  );
}
