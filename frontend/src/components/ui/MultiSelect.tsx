import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

interface MultiSelectProps {
  label?: string;
  options: { value: string; label: string }[];
  /** Valores atualmente selecionados. */
  values: string[];
  onChange: (values: string[]) => void;
  /** Placeholder quando nenhum item esta selecionado. Default: "Selecione...". */
  placeholder?: string;
  /** Texto quando todas as opcoes estao selecionadas (ou nenhuma — significa "todos"). Default: "Todos". */
  allLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Limite minimo de opcoes para mostrar busca. Default 3. Use 0 para forcar sempre. */
  searchThreshold?: number;
  /** Quando true, lista vazia (values = []) significa "todos" (filtro nao aplicado). Default true. */
  emptyMeansAll?: boolean;
}

export default function MultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder = 'Selecione...',
  allLabel = 'Todos',
  disabled,
  className = '',
  id,
  searchThreshold = 3,
  emptyMeansAll = true,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const showSearch = options.length >= searchThreshold;

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const s = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, search]);

  const valuesSet = useMemo(() => new Set(values), [values]);
  const allFilteredSelected = filteredOptions.length > 0 && filteredOptions.every((o) => valuesSet.has(o.value));

  // Texto do botao
  const buttonText = useMemo(() => {
    if (values.length === 0 || (emptyMeansAll && values.length === options.length)) return allLabel;
    if (values.length === 1) {
      const single = options.find((o) => o.value === values[0]);
      return single?.label || placeholder;
    }
    if (values.length === options.length) return allLabel;
    return `${values.length} selecionado${values.length === 1 ? '' : 's'}`;
  }, [values, options, allLabel, placeholder, emptyMeansAll]);

  const isPlaceholder = values.length === 0 && !emptyMeansAll;

  useEffect(() => {
    if (open) {
      setSearch('');
      if (showSearch) requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [open, showSearch]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  const toggleOne = (val: string) => {
    if (valuesSet.has(val)) onChange(values.filter((v) => v !== val));
    else onChange([...values, val]);
  };

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      // Desmarca apenas as filtradas
      const toRemove = new Set(filteredOptions.map((o) => o.value));
      onChange(values.filter((v) => !toRemove.has(v)));
    } else {
      // Marca todas as filtradas (mantendo as ja selecionadas fora do filtro)
      const merged = new Set(values);
      filteredOptions.forEach((o) => merged.add(o.value));
      onChange(Array.from(merged));
    }
  };

  const clearAll = () => onChange([]);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="text-[13px] font-medium" style={{ color: 'var(--fg-muted)' }}>
          {label}
        </label>
      )}
      <div ref={ref} className="relative">
        <button
          type="button"
          id={selectId}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => !disabled && setOpen(!open)}
          className="w-full h-9 pl-3 pr-9 text-[14px] rounded-lg border text-left overflow-hidden transition-all duration-200 cursor-pointer"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: isPlaceholder ? 'var(--color-text-muted)' : 'var(--color-text)',
            opacity: disabled ? 0.5 : undefined,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          disabled={disabled}
        >
          <span className="block truncate">{buttonText}</span>
        </button>
        <ChevronDown
          size={16}
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
          style={{ color: 'var(--color-text-secondary)' }}
        />
        {open && (
          <div
            role="listbox"
            aria-multiselectable="true"
            className="absolute left-0 top-full mt-1 w-full min-w-[220px] rounded-xl z-50 animate-scaleIn overflow-hidden"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-pop)' }}
          >
            {showSearch && (
              <div className="px-2 pt-2 pb-1.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                    className="w-full pl-7 pr-2 py-1.5 text-[12px] rounded-md border bg-transparent focus:outline-none"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                </div>
              </div>
            )}
            <div className="px-2 py-1.5 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <button
                type="button"
                onClick={toggleAllFiltered}
                className="text-[11px] font-medium px-2 py-1 rounded transition-colors cursor-pointer"
                style={{ color: 'var(--color-primary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-primary-bg)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {allFilteredSelected ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
              {values.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] font-medium px-2 py-1 rounded transition-colors cursor-pointer"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  Limpar ({values.length})
                </button>
              )}
            </div>
            <div className="max-h-[240px] overflow-y-auto py-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-3 text-center text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                  Nenhuma opção encontrada.
                </div>
              ) : filteredOptions.map((opt) => {
                const checked = valuesSet.has(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggleOne(opt.value)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left"
                    style={{ color: 'var(--color-text)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span
                      className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-surface)',
                        borderColor: checked ? 'var(--color-primary)' : 'var(--color-border)',
                      }}
                    >
                      {checked && <Check size={11} style={{ color: 'var(--accent-fg)' }} />}
                    </span>
                    <span className="truncate flex-1">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
