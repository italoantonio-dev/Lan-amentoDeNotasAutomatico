import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// 'info' e o aviso que nao e nem vitoria nem falha (ex.: a acao mudou o status
// de outro item). Verde diria "deu certo" e vermelho diria "quebrou"; os dois enganam.
const ESTILO = {
  success: { icone: CheckCircle, cor: 'var(--success)', fundo: 'var(--success-soft)' },
  error:   { icone: XCircle,     cor: 'var(--danger)',  fundo: 'var(--danger-soft)' },
  info:    { icone: Info,        cor: 'var(--info)',    fundo: 'var(--info-soft)' },
} as const;

interface ToastProps {
  toast: ToastData;
  onRemove: (id: string) => void;
}

export default function Toast({ toast, onRemove }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const estilo = ESTILO[toast.type] ?? ESTILO.error;
  const Icone = estilo.icone;

  return (
    <div
      className="group flex items-start gap-3 pl-3.5 pr-10 py-3 rounded-2xl border animate-riseIn relative"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 92%, transparent)',
        backdropFilter: 'blur(12px)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-pop)',
      }}
    >
      <span
        className="w-8 h-8 shrink-0 rounded-full inline-flex items-center justify-center"
        style={{ backgroundColor: estilo.fundo, color: estilo.cor }}
      >
        <Icone size={16} />
      </span>
      <span className="flex-1 text-[12.5px] leading-snug pt-1.5" style={{ color: 'var(--fg-muted)' }}>
        {toast.message}
      </span>
      <button
        onClick={() => onRemove(toast.id)}
        aria-label="Fechar aviso"
        className="absolute right-2 top-2 w-7 h-7 inline-flex items-center justify-center rounded-lg transition-colors md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
        style={{ color: 'var(--fg-subtle)' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 left-5 z-[300] flex flex-col gap-2.5 w-[380px] max-w-[calc(100vw-40px)]">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
