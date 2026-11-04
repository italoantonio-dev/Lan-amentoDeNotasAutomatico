import { Check } from 'lucide-react';

// Checkbox do design system Mitra: 18px, raio 6px, marcado = --accent cheio.

interface CheckboxProps {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export default function Checkbox({
  label,
  checked = false,
  onChange,
  disabled = false,
  className = '',
  id,
}: CheckboxProps) {
  const checkboxId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <label
      htmlFor={checkboxId}
      className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <button
        type="button"
        role="checkbox"
        id={checkboxId}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={`
          w-[18px] h-[18px] rounded-[6px] shrink-0
          border flex items-center justify-center
          transition-colors duration-150
        `}
        style={{
          backgroundColor: checked ? 'var(--accent)' : 'var(--bg-elevated)',
          borderColor: checked ? 'var(--accent)' : 'var(--border-strong)',
        }}
      >
        {checked && <Check size={13} strokeWidth={3} style={{ color: 'var(--accent-fg)' }} />}
      </button>
      {label && (
        <span className="text-[14px]" style={{ color: 'var(--fg)' }}>
          {label}
        </span>
      )}
    </label>
  );
}
