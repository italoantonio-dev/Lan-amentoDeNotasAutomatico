import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

// Campo de texto do design system Mitra: 36px de altura, raio 12px, 14px de
// corpo (classe .controle). Rotulo 13px/500 em --fg-muted; erro 12px em --danger.
// O anel duplo de foco vem da regra global de :focus-visible no index.css.
// onChange recebe o evento nativo, como um <input> comum.
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, style, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[13px] font-medium" style={{ color: 'var(--fg-muted)' }}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`controle w-full disabled:cursor-not-allowed ${className}`}
          style={error ? { borderColor: 'var(--danger)', ...style } : style}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {error && <p className="text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
