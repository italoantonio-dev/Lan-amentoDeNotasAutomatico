const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarMoeda = (v: unknown) => moeda.format(Number(v) || 0);

export function formatarData(v: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

export function formatarDataHora(v: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(v ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]} às ${m[4]}:${m[5]}` : '—';
}

export function formatarCnpj(v: unknown): string {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return d || '—';
}

export const ORIGEM_CLASSIFICACAO: Record<string, string> = {
  PARAMETRO: 'Parâmetro',
  PADRAO_HISTORICO: 'Padrão histórico',
  MANUAL: 'Manual',
};

// Os campos seguem o documento: nota tem emissao, quem vence e a duplicata.
export function rotulosDoTipo(codigo: string): { data: string; vencimento: string | null } {
  if (codigo === 'NOTA_FISCAL') return { data: 'Data de emissão', vencimento: null };
  if (codigo === 'GUIA_IMPOSTO') return { data: 'Data de apuração', vencimento: 'Vencimento' };
  if (codigo === 'FOLHA_PAGAMENTO') return { data: 'Competência', vencimento: 'Vencimento' };
  return { data: 'Data de emissão', vencimento: 'Vencimento' };
}
