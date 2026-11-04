import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

// Botao do design system Mitra.
//   sm 32px / 13px / raio 10 · md 36px / 13.5px / raio 12 · lg 40px / 14px / raio 12
// md tem a altura e o raio do Input/Select (--altura-controle, --raio-controle).
// Uma acao primaria por tela; o acento (--accent) so aparece nela.
// Cores e hover vem das classes (nada de estilo mutado no mouse): `style`,
// `onMouseEnter` e `onMouseLeave` passados por quem usa funcionam normalmente.
// Sem `type`, vale o padrao do HTML (submit dentro de <form>), como no <button>.
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-[10px]',
  md: 'h-[var(--altura-controle)] px-3.5 text-[13.5px] rounded-lg',
  lg: 'h-10 px-4 text-[14px] rounded-lg',
};

const variantClasses: Record<Variant, string> = {
  primary: 'shadow-sm bg-[var(--accent)] text-[var(--accent-fg)] enabled:hover:bg-[var(--accent-hover)]',
  secondary: 'border shadow-sm bg-[var(--bg-elevated)] text-[var(--fg)] border-[var(--border)] enabled:hover:bg-[var(--surface-hover)] enabled:hover:border-[var(--border-strong)]',
  danger: 'shadow-sm bg-[var(--danger)] text-[var(--fg-inverted)] enabled:hover:brightness-110',
  ghost: 'text-[var(--fg-muted)] enabled:hover:bg-[var(--surface-hover)] enabled:hover:text-[var(--fg)]',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap select-none
          transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150
          enabled:active:scale-[0.98] disabled:opacity-50
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
