import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`panel max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 shadow-lift focus:outline-none sm:rounded-b-2xl sm:p-6 ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button className="rounded-md p-1.5 text-paper-mute hover:bg-ink-700 hover:text-paper" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', busy = false, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-paper-dim">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Keep it</button>
        <button className="btn btn-primary" onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
