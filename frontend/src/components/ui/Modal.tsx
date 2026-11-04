import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
};

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn"
      style={{ backgroundColor: 'var(--bg-overlay)' }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className={`w-full ${sizeClasses[size]} rounded-2xl border animate-scaleIn relative`}
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)' }}
      >
        {title ? (
          <div className="flex items-center justify-between gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 className="text-[16px] font-medium" style={{ color: 'var(--fg)' }}>{title}</h2>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg transition-colors duration-150"
              style={{ color: 'var(--fg-subtle)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--fg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--fg-subtle)'; }}
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-4 top-4 h-8 w-8 inline-flex items-center justify-center rounded-lg transition-colors duration-150 z-10"
            style={{ color: 'var(--fg-subtle)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--fg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--fg-subtle)'; }}
          >
            <X size={18} />
          </button>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
