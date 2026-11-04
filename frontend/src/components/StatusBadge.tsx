import Badge from './ui/Badge';

const MAPA: Record<string, { variante: 'warning' | 'info' | 'success' | 'danger' | 'neutral'; rotulo: string }> = {
  AGUARDANDO_APROVACAO: { variante: 'warning', rotulo: 'Aguardando aprovação' },
  APROVADO: { variante: 'info', rotulo: 'Aprovado' },
  LANCADO: { variante: 'success', rotulo: 'Lançado' },
  REJEITADO: { variante: 'danger', rotulo: 'Rejeitado' },
  ERRO: { variante: 'danger', rotulo: 'Erro' },
  REVISAO_LEITURA: { variante: 'neutral', rotulo: 'Revisão de leitura' },
};

export default function StatusBadge({ status }: { status: string }) {
  const m = MAPA[status] ?? { variante: 'neutral' as const, rotulo: status };
  return <Badge variant={m.variante} dot>{m.rotulo}</Badge>;
}
