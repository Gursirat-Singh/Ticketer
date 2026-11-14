import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState, Spinner } from '../States.jsx';

/** columns: [{ header, cell(row), className }] */
export default function DataTable({ columns, rows, loading, emptyTitle = 'Nothing here yet', pagination, rowKey = (r) => r.id ?? r._id }) {
  if (loading) return <Spinner />;
  if (!rows.length) return <EmptyState title={emptyTitle} />;
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead className="border-b border-ink-700 bg-ink-800/60">
            <tr>{columns.map((c) => <th key={c.header} scope="col" className="table-th">{c.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-ink-700">
            {rows.map((r) => (
              <tr key={rowKey(r)} className="hover:bg-ink-800/40">
                {columns.map((c) => <td key={c.header} className={`table-td ${c.className || ''}`}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between border-t border-ink-700 px-4 py-3 text-sm text-paper-mute">
          <span>Page {pagination.page} of {pagination.pages}, {pagination.total} total</span>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" disabled={pagination.page <= 1} onClick={() => pagination.onPage(pagination.page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            <button className="btn btn-ghost btn-sm" disabled={pagination.page >= pagination.pages} onClick={() => pagination.onPage(pagination.page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-4xl font-black">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-paper-mute">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
