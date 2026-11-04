import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  id?: string;
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function formatDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function DatePicker({ label, value, onChange, placeholder = 'DD/MM/AAAA', disabled, error, id }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pickerId = id || label?.toLowerCase().replace(/\s+/g, '-');

  const today = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  useEffect(() => {
    if (open && parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }, [open]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const selectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange?.(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };

  const isSelected = (day: number) => {
    if (!parsed) return false;
    return parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth && parsed.getDate() === day;
  };

  const isToday = (day: number) => {
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={pickerId} className="text-[13px] font-medium" style={{ color: 'var(--fg-muted)' }}>
          {label}
        </label>
      )}
      <div ref={ref} className="relative">
        <button
          type="button"
          id={pickerId}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-invalid={error ? true : undefined}
          onClick={() => !disabled && setOpen(!open)}
          className={`
            w-full min-w-[160px] h-9 pl-3 pr-9 text-[14px] rounded-lg border text-left
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 cursor-pointer
          `}
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: error ? 'var(--danger)' : 'var(--color-border)',
            color: value ? 'var(--color-text)' : 'var(--color-text-muted)',
            opacity: disabled ? 0.5 : undefined,
            cursor: disabled ? 'not-allowed' : 'pointer',
          } as any}
          disabled={disabled}
        >
          {value ? formatDisplay(value) : placeholder}
        </button>
        <Calendar
          size={16}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
          style={{ color: 'var(--color-text-secondary)' }}
        />
        {open && (
          <div
            role="dialog"
            className="absolute left-0 top-full mt-1 rounded-xl z-50 p-3 animate-scaleIn"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-pop)',
              width: 280,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={prevMonth} className="p-1 rounded transition-colors" style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button type="button" onClick={nextMonth} className="p-1 rounded transition-colors" style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-medium uppercase py-1" style={{ color: 'var(--color-text-muted)' }}>{d}</div>
              ))}
              {cells.map((day, i) => (
                <div key={i} className="flex items-center justify-center" style={{ height: 32 }}>
                  {day !== null && (
                    <button
                      type="button"
                      onClick={() => selectDay(day)}
                      className="w-8 h-8 rounded-lg text-xs font-medium transition-all duration-150 flex items-center justify-center"
                      style={{
                        backgroundColor: isSelected(day) ? 'var(--color-primary)' : 'transparent',
                        color: isSelected(day) ? 'var(--accent-fg)' : isToday(day) ? 'var(--color-primary)' : 'var(--color-text)',
                        fontWeight: isToday(day) || isSelected(day) ? 600 : 400,
                      }}
                      onMouseEnter={(e) => { if (!isSelected(day)) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                      onMouseLeave={(e) => { if (!isSelected(day)) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {day}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}
