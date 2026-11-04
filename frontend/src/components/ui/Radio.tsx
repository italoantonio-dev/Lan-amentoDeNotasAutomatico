// Radio do design system Mitra: 18px, borda --border-strong; selecionado = anel e miolo em --accent.
interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  label?: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  direction?: 'vertical' | 'horizontal';
  className?: string;
  name?: string;
}

export default function RadioGroup({
  label,
  options,
  value,
  onChange,
  disabled = false,
  direction = 'vertical',
  className = '',
  name: _name,
}: RadioGroupProps) {
  return (
    <fieldset className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <legend className="text-[13px] font-medium mb-1" style={{ color: 'var(--fg-muted)' }}>
          {label}
        </legend>
      )}
      <div className={`flex ${direction === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'} gap-2.5`} role="radiogroup">
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <label
              key={opt.value}
              className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => !disabled && onChange?.(opt.value)}
                className={`
                  w-[18px] h-[18px] rounded-full shrink-0
                  border-2 flex items-center justify-center
                  transition-colors duration-150
                `}
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border-strong)',
                }}
              >
                {isSelected && (
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: 'var(--accent)' }}
                  />
                )}
              </button>
              <span className="text-[14px]" style={{ color: 'var(--fg)' }}>
                {opt.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
