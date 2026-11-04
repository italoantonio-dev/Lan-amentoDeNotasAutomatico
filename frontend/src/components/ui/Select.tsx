import { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';

interface SelectProps {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Limite minimo de opcoes para mostrar busca. Default 3. Use 0 para forcar sempre. */
  searchThreshold?: number;
  /**
   * 'inline' deixa o gatilho sem caixa: parece texto comum na celula e so
   * revela fundo/contorno no hover e no foco. Usado em tabela editavel, onde
   * uma borda por celula transforma a grade num formulario poluido.
   */
  variant?: 'default' | 'inline';
}

export default function Select({ label, error, options, placeholder = 'Selecione...', value, onChange, disabled, className = '', id, searchThreshold = 3, variant = 'default' }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const showSearch = options.length >= searchThreshold;
  const inline = variant === 'inline';

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const s = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, search]);

  // Reset busca/highlight ao abrir/fechar
  useEffect(() => {
    if (open) {
      setSearch('');
      setHighlightIndex(0);
      if (showSearch) {
        // foco no input apos animacao
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    }
  }, [open, showSearch]);

  // Mantem highlight visivel ao mudar
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-opt-idx="${highlightIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      const inAnchor = ref.current && ref.current.contains(t);
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(t);
      if (!inAnchor && !inDropdown) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, Math.max(filteredOptions.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const opt = filteredOptions[highlightIndex];
        if (opt) { onChange?.(opt.value); setOpen(false); }
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open, filteredOptions, highlightIndex, onChange]);

  // Calcula posicao do dropdown ancorado no botao (portal, escapa overflow ancestral)
  useLayoutEffect(() => {
    if (!open) { setDropPos(null); return; }
    const recompute = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const estHeight = Math.min(296, options.length * 36 + (showSearch ? 44 : 0) + 8);
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < estHeight && spaceAbove > spaceBelow;
      setDropPos({
        top: openUp ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        openUp,
      });
    };
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open, options.length, showSearch]);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="text-[13px] font-medium" style={{ color: 'var(--fg-muted)' }}>
          {label}
        </label>
      )}
      <div ref={ref} className="relative">
        <button
          ref={buttonRef}
          type="button"
          id={selectId}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-invalid={error ? true : undefined}
          onClick={() => !disabled && setOpen(!open)}
          onKeyDown={(e) => {
            if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true); }
          }}
          className={`
            w-full text-[14px] rounded-lg border text-left overflow-hidden
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-[border-color,box-shadow] duration-150 cursor-pointer
            ${inline ? 'celula-inline celula-inline-marca pl-2 pr-7 py-1' : 'h-[var(--altura-controle)] pl-3 pr-9'}
          `}
          style={{
            backgroundColor: inline ? undefined : 'var(--bg-elevated)',
            borderColor: inline ? undefined : (error ? 'var(--danger)' : 'var(--border)'),
            color: selected ? 'var(--fg)' : 'var(--fg-subtle)',
            opacity: disabled ? 0.5 : undefined,
            cursor: disabled ? 'not-allowed' : 'pointer',
          } as any}
          disabled={disabled}
        >
          <span className="block truncate">{selected?.label || placeholder}</span>
        </button>
        <ChevronDown
          size={inline ? 13 : 16}
          className={`absolute top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200 ${open ? 'rotate-180' : ''} ${inline ? 'right-1.5' : 'right-2.5'} ${inline && !open ? 'celula-inline-seta' : ''}`}
          aria-hidden="true"
          style={{ color: 'var(--color-text-secondary)' }}
        />
      </div>
      {open && dropPos && createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          className="rounded-xl py-1 animate-scaleIn overflow-hidden"
          style={{
            position: 'fixed',
            top: dropPos.openUp ? undefined : dropPos.top,
            bottom: dropPos.openUp ? window.innerHeight - dropPos.top : undefined,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          {showSearch && (
            <div className="px-2 pt-1 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setHighlightIndex(0); }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                  className="w-full pl-7 pr-2 py-1.5 text-[12px] rounded-md border bg-transparent focus:outline-none"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
            </div>
          )}
          <div ref={listRef} className="max-h-[240px] overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-center text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                Nenhuma opção encontrada.
              </div>
            ) : filteredOptions.map((opt, idx) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                data-opt-idx={idx}
                onClick={() => { onChange?.(opt.value); setOpen(false); }}
                onMouseEnter={(e) => { setHighlightIndex(idx); e.currentTarget.style.backgroundColor = 'var(--color-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = highlightIndex === idx ? 'var(--color-hover)' : 'transparent'; }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left"
                style={{
                  color: opt.value === value ? 'var(--color-primary)' : 'var(--color-text)',
                  backgroundColor: highlightIndex === idx ? 'var(--color-hover)' : 'transparent',
                }}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && <Check size={14} className="shrink-0 ml-2" style={{ color: 'var(--color-primary)' }} />}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
      {error && <p className="text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}
