/**
 * Skeleton — placeholders de carregamento.
 *
 * POR QUE EXISTE: a tela monta com lista vazia enquanto a rede responde, e o
 * estado vazio ("Nenhum item cadastrado") acabaria aparecendo nesse intervalo —
 * afirmando ausencia de dado quando o dado ainda esta vindo. Estes componentes
 * dao a terceira resposta, "ainda carregando", e ja reservam a altura final,
 * eliminando o salto de layout.
 *
 * Shimmer da classe .skeleton (index.css) — nao criar variacao nova de animacao.
 */

type SkStyle = Record<string, string | number>;

const CARD_STYLE: SkStyle = {
  backgroundColor: 'var(--color-surface)',
  borderColor: 'var(--color-border)',
  boxShadow: 'var(--shadow-sm)',
};

// Larguras ciclicas: barras de tamanho igual parecem roboticas, e Math.random
// mudaria a cada render. O offset por linha+coluna quebra o padrao visual sem
// abrir mao do determinismo.
const CELL_W = ['78%', '52%', '66%', '44%', '60%', '48%'];

/** Barra base com shimmer. Dimensione via className (h-4 w-24) ou style. */
export function Skeleton({ className = '', style }: { className?: string; style?: SkStyle }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

/** Moldura de card do app — mesma borda/sombra dos cards reais. */
export function SkeletonCard({
  children,
  className = '',
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: SkStyle;
}) {
  return (
    <div className={`rounded-2xl border ${className}`} style={{ ...CARD_STYLE, ...style }}>
      {children}
    </div>
  );
}

/**
 * Faixa de KPIs — mesma anatomia do KPI do design system (rotulo, numero,
 * badge de variacao; icone pequeno no canto). Passe o mesmo `className` de
 * grid usado pelos KPIs da tela para a faixa ocupar exatamente o mesmo espaco.
 */
export function SkeletonKpis({
  count = 4,
  className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} className="px-5 py-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="w-4 h-4 rounded-md" />
          </div>
          <Skeleton className="h-6 w-28 mt-3" />
          <Skeleton className="h-[22px] w-16 mt-3 rounded-full" />
        </SkeletonCard>
      ))}
    </div>
  );
}

/**
 * Tabela — cabecalho + N linhas dentro da moldura de card, replicando o
 * espacamento da `.tabela` do design system (px-4 py-3).
 * `footer` reserva a barra de paginacao para a altura nao colapsar entre paginas.
 */
export function SkeletonTable({
  columns = 5,
  rows = 8,
  firstColWidth,
  footer = false,
  className = '',
}: {
  columns?: number;
  rows?: number;
  firstColWidth?: string;
  footer?: boolean;
  className?: string;
}) {
  const cols = Array.from({ length: columns }, (_, i) => i);
  return (
    <SkeletonCard className={`overflow-hidden ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c}
                className="text-left px-4 py-2.5"
                style={c === 0 && firstColWidth ? { width: firstColWidth } : undefined}
              >
                <Skeleton className="h-3" style={{ width: c === 0 ? 90 : 64 }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r} style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {cols.map((c) => (
                <td key={c} className="px-4 py-3">
                  <Skeleton className="h-4" style={{ width: CELL_W[(r + c) % CELL_W.length] }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footer && (
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <Skeleton className="h-3 w-40" />
        </div>
      )}
    </SkeletonCard>
  );
}

/**
 * Cards em grid — para kanban e listas de cards. `className` deve repetir o
 * grid da tela; `height` deve bater com a altura do card real.
 */
export function SkeletonCards({
  count = 3,
  height = 120,
  className = '',
}: {
  count?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} className="p-4" style={{ height }}>
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-3" style={{ width: '40%' }} />
            <Skeleton className="h-4" style={{ width: '72%' }} />
            <Skeleton className="h-1.5 mt-1 rounded-full" style={{ width: '100%' }} />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

/**
 * Pagina inteira — fallback do Suspense enquanto o chunk da rota lazy baixa.
 *
 * POR QUE EXISTE: um spinner redondo generico no lugar da rota destoa do resto
 * do app e ainda e seguido pelo skeleton real da tela. Aqui o fallback ja tem a
 * forma de pagina (titulo, faixa de filtros, tabela), entao a transicao
 * chunk -> tela e continua: mesmo shimmer, mesmo layout.
 */
export function SkeletonPage() {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5" style={{ width: 220 }} />
        <Skeleton className="h-3" style={{ width: 340 }} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {[200, 160, 240, 180].map((w, i) => (
          <Skeleton key={i} className="h-9" style={{ width: w }} />
        ))}
      </div>
      <SkeletonTable columns={6} rows={8} firstColWidth="260px" />
    </div>
  );
}

/** Itens de lista simples (sem moldura propria) — ex: lista lateral. */
export function SkeletonListItems({
  count = 6,
  height = 40,
  className = '',
}: {
  count?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} style={{ height, width: CELL_W[i % CELL_W.length] }} />
      ))}
    </div>
  );
}
