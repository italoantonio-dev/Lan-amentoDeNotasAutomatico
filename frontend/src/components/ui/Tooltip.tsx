import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** Lado em que o tooltip aparece. Default: 'top'. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Quando true, não renderiza o tooltip. Útil pra desativar dinamicamente. */
  disabled?: boolean;
  /** Largura máxima do tooltip. Default 360px. */
  maxWidth?: number;
  className?: string;
}

export default function Tooltip({ content, children, side = 'top', disabled, maxWidth = 360, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const ttRect = tooltipRef.current?.getBoundingClientRect();
    const ttW = ttRect?.width || 0;
    const ttH = ttRect?.height || 0;
    const gap = 6;
    let top = 0; let left = 0;
    if (side === 'top') { top = rect.top - ttH - gap; left = rect.left + rect.width / 2 - ttW / 2; }
    else if (side === 'bottom') { top = rect.bottom + gap; left = rect.left + rect.width / 2 - ttW / 2; }
    else if (side === 'left') { top = rect.top + rect.height / 2 - ttH / 2; left = rect.left - ttW - gap; }
    else { top = rect.top + rect.height / 2 - ttH / 2; left = rect.right + gap; }
    const viewportPadding = 8;
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - ttW - viewportPadding));
    top = Math.max(viewportPadding, Math.min(top, window.innerHeight - ttH - viewportPadding));
    setPos({ top, left });
  }, [open, side]);

  if (disabled || !content) return <>{children}</>;

  return (
    <>
      <span
        ref={wrapRef}
        className={`relative inline-flex ${className || ''}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => { setOpen(false); setPos(null); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setOpen(false); setPos(null); }}
      >
        {children}
      </span>
      {open && createPortal(
        <span
          ref={tooltipRef}
          role="tooltip"
          className="pointer-events-none fixed z-[1000] animate-fadeIn block"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
        >
          <span
            className="block rounded-md px-2.5 py-1.5 text-[12px] leading-snug shadow-md whitespace-normal"
            style={{
              backgroundColor: 'var(--color-text)',
              color: 'var(--color-surface)',
              maxWidth,
              width: 'max-content',
            }}
          >
            {content}
          </span>
        </span>,
        document.body
      )}
    </>
  );
}
