import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-paper-mute" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> <span>{label}…</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="panel mx-auto my-10 flex max-w-md flex-col items-center gap-3 p-8 text-center" role="alert">
      <AlertTriangle className="h-8 w-8 text-accent-hover" aria-hidden />
      <p className="text-paper-dim">{message}</p>
      {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="panel mx-auto my-8 flex max-w-md flex-col items-center gap-2 p-8 text-center">
      <Inbox className="h-8 w-8 text-paper-mute" aria-hidden />
      <h3 className="text-xl font-bold">{title}</h3>
      {hint && <p className="text-sm text-paper-mute">{hint}</p>}
      {action}
    </div>
  );
}

const TONES = {
  CONFIRMED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  PAID: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  REFUNDED: 'border-velvet/40 bg-velvet/10 text-velvet',
  CANCELLED: 'border-accent/40 bg-accent/10 text-accent-hover',
  FAILED: 'border-accent/40 bg-accent/10 text-accent-hover',
  EXPIRED: 'border-ink-600 bg-ink-800 text-paper-mute',
  PENDING_PAYMENT: 'border-gold/40 bg-gold/10 text-gold',
  CONFIRMING: 'border-gold/40 bg-gold/10 text-gold',
  REFUND_PENDING: 'border-gold/40 bg-gold/10 text-gold',
  CREATED: 'border-ink-600 bg-ink-800 text-paper-dim',
  SCHEDULED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  now_showing: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  upcoming: 'border-gold/40 bg-gold/10 text-gold',
  archived: 'border-ink-600 bg-ink-800 text-paper-mute',
  admin: 'border-accent/40 bg-accent/10 text-accent-hover',
  customer: 'border-ink-600 bg-ink-800 text-paper-dim',
};

export function StatusBadge({ status }) {
  const label = String(status).replace(/_/g, ' ').toLowerCase();
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES[status] || TONES.CREATED}`}>{label}</span>;
}
