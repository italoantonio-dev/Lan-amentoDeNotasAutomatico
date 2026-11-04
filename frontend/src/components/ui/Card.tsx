import type { HTMLAttributes, ReactNode } from 'react';

// Cartao do design system Mitra: superficie elevada, borda de 1px, raio 20px
// e a sombra quase invisivel (--shadow-sm). Nunca cartao dentro de cartao.
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

interface CardHeaderProps extends CardProps {
  /** Acao no canto direito do cabecalho (botao, menu, badge). Titulo e descricao ficam empilhados a esquerda. */
  action?: ReactNode;
}

export function Card({ className = '', style, children, ...props }: CardProps) {
  return (
    <div
      className={`cartao ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, action, style, ...props }: CardHeaderProps) {
  const divisoria = { borderBottom: '1px solid var(--border-subtle)', ...style };
  if (action) {
    return (
      <div className={`px-5 py-4 flex items-center justify-between gap-4 ${className}`} style={divisoria} {...props}>
        <div className="flex flex-col gap-1 min-w-0">{children}</div>
        <div className="shrink-0">{action}</div>
      </div>
    );
  }
  return (
    <div className={`px-5 py-4 flex flex-col gap-1 ${className}`} style={divisoria} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, style, ...props }: CardProps) {
  return (
    <h3 className={`text-[14px] font-medium leading-tight ${className}`} style={{ color: 'var(--fg)', ...style }} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = '', children, style, ...props }: CardProps) {
  return (
    <p className={`text-[12.5px] leading-snug ${className}`} style={{ color: 'var(--fg-subtle)', ...style }} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = '', children, ...props }: CardProps) {
  return (
    <div className={`px-5 py-5 flex-1 flex flex-col ${className}`} {...props}>
      {children}
    </div>
  );
}

export default Card;
