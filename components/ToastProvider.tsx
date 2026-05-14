'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastCtx {
  addToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={[
              'px-4 py-3 rounded-lg text-sm font-medium shadow-xl border pointer-events-auto',
              'max-w-xs animate-toast',
              toast.type === 'success' && 'bg-[#0d1f0d] border-green-800/60 text-green-300',
              toast.type === 'error'   && 'bg-[#1f0d0d] border-red-800/60 text-red-300',
              toast.type === 'info'    && 'bg-[#18181b] border-[#2e2e35] text-zinc-200',
            ].filter(Boolean).join(' ')}
          >
            {toast.type === 'success' && <span className="mr-1.5">✓</span>}
            {toast.type === 'error'   && <span className="mr-1.5">✕</span>}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
