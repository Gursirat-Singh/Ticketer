import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((type, message) => {
    const id = nextId++;
    setToasts((t) => [...t.slice(-3), { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const api = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  const icon = { success: CheckCircle2, error: XCircle, info: Info };
  const tone = { success: 'text-emerald-400', error: 'text-accent-hover', info: 'text-velvet' };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => {
          const Icon = icon[t.type];
          return (
            <div key={t.id} role="status" className="panel pointer-events-auto flex max-w-md items-start gap-3 px-4 py-3 text-sm shadow-lift">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone[t.type]}`} />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
