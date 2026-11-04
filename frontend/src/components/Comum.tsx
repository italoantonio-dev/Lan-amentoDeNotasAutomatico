import type { ReactNode } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Lock, RefreshCw } from 'lucide-react';
import Button from './ui/Button';

export function CabecalhoPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold text-fg">{titulo}</h1>
        {descricao && <p className="text-[13px] text-fg-muted mt-0.5">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export function EstadoVazio({ titulo, descricao, acao, icone }: { titulo: string; descricao?: string; acao?: ReactNode; icone?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 gap-3">
      <div className="w-11 h-11 rounded-full flex items-center justify-center bg-surface-muted text-fg-muted">{icone ?? <Inbox size={20} />}</div>
      <div>
        <p className="text-[14px] font-medium text-fg">{titulo}</p>
        {descricao && <p className="text-[13px] text-fg-muted mt-1 max-w-md">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

export function EstadoErro({ mensagem, onRetry }: { mensagem: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 gap-3">
      <div className="w-11 h-11 rounded-full flex items-center justify-center bg-danger-soft" style={{ color: 'var(--danger)' }}><AlertTriangle size={20} /></div>
      <div>
        <p className="text-[14px] font-medium text-fg">Não consegui carregar</p>
        <p className="text-[13px] text-fg-muted mt-1 max-w-lg break-words">{mensagem}</p>
      </div>
      {onRetry && <Button variant="secondary" onClick={onRetry}><RefreshCw size={16} /> Tentar novamente</Button>}
    </div>
  );
}

export function SemPermissao({ mensagem }: { mensagem?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 gap-3">
      <div className="w-11 h-11 rounded-full flex items-center justify-center bg-surface-muted text-fg-muted"><Lock size={20} /></div>
      <div>
        <p className="text-[14px] font-medium text-fg">Sem permissão</p>
        <p className="text-[13px] text-fg-muted mt-1 max-w-md">{mensagem ?? 'Esta área é restrita ao administrador.'}</p>
      </div>
    </div>
  );
}

export function Aviso({ tipo = 'warning', children, acao }: { tipo?: 'warning' | 'info' | 'danger' | 'success'; children: ReactNode; acao?: ReactNode }) {
  const cor = { warning: 'var(--warning)', info: 'var(--info)', danger: 'var(--danger)', success: 'var(--success)' }[tipo];
  const fundo = { warning: 'var(--warning-soft)', info: 'var(--info-soft)', danger: 'var(--danger-soft)', success: 'var(--success-soft)' }[tipo];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 mb-5 text-[13px] text-fg border" style={{ backgroundColor: fundo, borderColor: cor }}>
      <AlertTriangle size={16} style={{ color: cor, flexShrink: 0 }} />
      <div className="flex-1 min-w-[200px]">{children}</div>
      {acao}
    </div>
  );
}

export function Paginacao({ pagina, total, porPagina, onMudar }: { pagina: number; total: number; porPagina: number; onMudar: (p: number) => void }) {
  const ultima = Math.max(0, Math.ceil(total / porPagina) - 1);
  if (total <= porPagina) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border-subtle">
      <span className="text-[12.5px] text-fg-muted tabular-nums">{pagina * porPagina + 1}–{Math.min((pagina + 1) * porPagina, total)} de {total}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={pagina === 0} onClick={() => onMudar(pagina - 1)} aria-label="Página anterior"><ChevronLeft size={16} /></Button>
        <Button size="sm" variant="secondary" disabled={pagina >= ultima} onClick={() => onMudar(pagina + 1)} aria-label="Próxima página"><ChevronRight size={16} /></Button>
      </div>
    </div>
  );
}

// Cor contra o corte em vigor: verde a partir dele, ambar ate 20 pontos abaixo. Nunca contra 90 fixo.
export function corConfianca(confianca: number, corte: number): string {
  if (confianca >= corte) return 'var(--success)';
  if (confianca >= corte - 20) return 'var(--warning)';
  return 'var(--danger)';
}

export function BarraConfianca({ confianca, corte }: { confianca: number; corte: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="barra-confianca flex-1"><span style={{ width: `${Math.max(2, confianca)}%`, backgroundColor: corConfianca(confianca, corte) }} /></div>
      <span className="text-[12.5px] font-medium tabular-nums text-fg w-9 text-right">{confianca}%</span>
    </div>
  );
}
