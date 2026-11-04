import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Wallet, X } from 'lucide-react';
import { callSF, SF, umaLinha } from '../lib/api';
import { formatarData, formatarMoeda } from '../lib/formato';
import { getMitraErrorMessage } from '../lib/utils';
import { useHighlight } from '../hooks/useHighlight';
import { ChartContainer, ShadcnBarChart } from '../components/ui/Chart';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { SkeletonKpis, SkeletonTable } from '../components/ui/Skeleton';
import StatusBadge from '../components/StatusBadge';
import { Aviso, CabecalhoPagina, EstadoErro, EstadoVazio } from '../components/Comum';

type Linha = Record<string, any>;

function Kpi({ rotulo, valor, detalhe, icone, cor, fundo, onClick }: { rotulo: string; valor: string; detalhe?: string; icone: React.ReactNode; cor: string; fundo: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="cartao cartao-vivo text-left p-5 flex items-start justify-between gap-3 w-full">
      <div className="min-w-0">
        <p className="text-[13px] text-fg-muted">{rotulo}</p>
        <p className="text-[22px] font-semibold tabular-nums text-fg mt-1 truncate">{valor}</p>
        {detalhe && <p className="text-[12.5px] text-fg-muted mt-1">{detalhe}</p>}
      </div>
      <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ color: cor, backgroundColor: fundo }}>{icone}</span>
    </button>
  );
}

export default function DashboardPage() {
  const nav = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [kpis, setKpis] = useState<Linha | null>(null);
  const [porStatus, setPorStatus] = useState<Linha[]>([]);
  const [porEmpresa, setPorEmpresa] = useState<Linha[]>([]);
  const [recentes, setRecentes] = useState<Linha[]>([]);
  const [versao, setVersao] = useState(0);

  const hlStatus = useHighlight();
  const hlEmpresa = useHighlight();
  const statusRef = useRef(porStatus);
  statusRef.current = porStatus;
  const empresaRef = useRef(porEmpresa);
  empresaRef.current = porEmpresa;
  const versaoFiltro = useRef(0);
  const [filtroStatus, setFiltroStatus] = useState<{ codigo: string; nome: string } | null>(null);
  const [filtroEmpresa, setFiltroEmpresa] = useState<{ id: string; nome: string } | null>(null);

  // Clique em um grafico filtra os outros, nunca a si mesmo. Deps so nos .selected: dados dos
  // graficos como dependencia gerariam laco infinito.
  useEffect(() => {
    const v = ++versaoFiltro.current;
    const st = hlStatus.selected.length === 1 ? statusRef.current[hlStatus.selected[0]] : null;
    const em = hlEmpresa.selected.length === 1 ? empresaRef.current[hlEmpresa.selected[0]] : null;
    const status = st ? String(st.CODIGO) : '';
    const empresaId = em ? String(em.EMPRESA_ID) : '';
    setFiltroStatus(st ? { codigo: status, nome: String(st.name) } : null);
    setFiltroEmpresa(em ? { id: empresaId, nome: String(em.name) } : null);
    (async () => {
      if (v === 1) setCarregando(true);
      setErro('');
      const [k, s, e, r] = await Promise.allSettled([
        umaLinha(SF.kpisDashboard, { empresaId, status }),
        callSF(SF.resumoPorStatus, { empresaId }),
        callSF(SF.resumoPorEmpresa, { status }),
        callSF(SF.lancamentosRecentes, { empresaId, status }),
      ]);
      if (versaoFiltro.current !== v) return;
      if (k.status === 'rejected') setErro(getMitraErrorMessage(k.reason));
      else setKpis(k.value);
      if (s.status === 'fulfilled') setPorStatus(s.value.map((x) => ({ ...x, value: Number(x.value) })));
      if (e.status === 'fulfilled') setPorEmpresa(e.value.map((x) => ({ ...x, value: Number(x.value) })));
      if (r.status === 'fulfilled') setRecentes(r.value);
      setCarregando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hlStatus.selected, hlEmpresa.selected, versao]);

  const total = Number(kpis?.TOTAL ?? 0);
  const filtrado = Boolean(filtroStatus || filtroEmpresa);
  const semDados = !carregando && !erro && total === 0 && !filtrado;

  return (
    <div className="p-4 md:p-8">
      <CabecalhoPagina titulo="Painel" descricao="O estado do dia: o que espera você, o que entrou e o que deu errado." />

      {filtrado && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-[12.5px] text-fg-muted">Filtros:</span>
          {filtroStatus && <button onClick={hlStatus.clear} className="pilula flex items-center gap-1">{filtroStatus.nome} <X size={12} /></button>}
          {filtroEmpresa && <button onClick={hlEmpresa.clear} className="pilula flex items-center gap-1">{filtroEmpresa.nome} <X size={12} /></button>}
          {filtroStatus && filtroEmpresa && <button onClick={() => { hlStatus.clear(); hlEmpresa.clear(); }} className="text-[12.5px] underline text-fg-muted">Limpar tudo</button>}
        </div>
      )}

      {kpis && Number(kpis.TOTAL_EMPRESAS) === 0 && (
        <Aviso tipo="info" acao={<Button size="sm" variant="secondary" onClick={() => nav('/configuracao')}>Abrir Configuração</Button>}>
          Nenhuma empresa cadastrada. Cadastre à mão ou sincronize com o ERP em Configuração.
        </Aviso>
      )}
      {kpis && Number(kpis.TOTAL_EMPRESAS) > 0 && Number(kpis.TOTAL_PARAMETROS) === 0 && (
        <Aviso tipo="warning" acao={<Button size="sm" variant="secondary" onClick={() => nav('/configuracao?aba=parametros')}>Cadastrar alçada</Button>}>
          Sem parâmetro de lançamento, nenhum valor cabe em alçada: todo documento para em “Aguardando aprovação”, mesmo com leitura perfeita.
        </Aviso>
      )}

      {erro ? (
        <Card><EstadoErro mensagem={erro} onRetry={() => setVersao((v) => v + 1)} /></Card>
      ) : carregando ? (
        <div className="flex flex-col gap-5"><SkeletonKpis /><SkeletonTable /></div>
      ) : (
        <>
          <div className="cascata grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-5">
            <Kpi rotulo="Pendências de aprovação" valor={String(kpis?.PENDENTES ?? 0)} detalhe="esperando uma decisão" icone={<Clock size={16} />} cor="var(--warning)" fundo="var(--warning-soft)" onClick={() => nav('/aprovacoes')} />
            <Kpi rotulo="Lançados no ERP" valor={String(kpis?.LANCADOS ?? 0)} detalhe={`${kpis?.ENTRARAM_HOJE ?? 0} entraram hoje`} icone={<CheckCircle2 size={16} />} cor="var(--success)" fundo="var(--success-soft)" onClick={() => nav('/lancamentos?status=LANCADO')} />
            <Kpi rotulo="Com erro" valor={String(kpis?.ERROS ?? 0)} detalhe={Number(kpis?.REVISAO) ? `${kpis?.REVISAO} em revisão de leitura` : 'recusados pelo ERP'} icone={<AlertTriangle size={16} />} cor="var(--danger)" fundo="var(--danger-soft)" onClick={() => nav('/lancamentos?status=ERRO')} />
            <Kpi rotulo="Valor processado" valor={formatarMoeda(kpis?.VALOR_LANCADO)} detalhe="em lançamentos enviados" icone={<Wallet size={16} />} cor="var(--info)" fundo="var(--info-soft)" onClick={() => nav('/lancamentos?status=LANCADO')} />
          </div>

          {semDados ? (
            <Card>
              <EstadoVazio titulo="Nenhum lançamento ainda" descricao="Envie o primeiro documento: o sistema lê, classifica e leva até o ERP." acao={<Button onClick={() => nav('/lancamentos')}>Novo lançamento</Button>} />
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
                <ChartContainer title="Lançamentos por situação" subtitle="Clique em uma barra para filtrar o painel">
                  <ShadcnBarChart data={porStatus} xKey="name" bars={[{ dataKey: 'value', name: 'Lançamentos' }]} activeIndex={hlStatus.activeIndex} onBarClick={hlStatus.handler} height={240} />
                </ChartContainer>
                <ChartContainer title="Lançamentos por empresa" subtitle="Clique em uma barra para filtrar o painel">
                  <ShadcnBarChart data={porEmpresa} xKey="name" layout="vertical" bars={[{ dataKey: 'value', name: 'Lançamentos' }]} activeIndex={hlEmpresa.activeIndex} onBarClick={hlEmpresa.handler} height={240} />
                </ChartContainer>
              </div>
              <Card>
                <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
                  <h2 className="text-[14px] font-medium text-fg">Últimos lançamentos</h2>
                  <Button size="sm" variant="ghost" onClick={() => nav('/lancamentos')}>Ver todos</Button>
                </div>
                {recentes.length === 0 ? (
                  <EstadoVazio titulo="Nada com estes filtros" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="tabela">
                      <thead><tr><th>Fornecedor</th><th>Tipo</th><th>Empresa</th><th>Data</th><th className="text-right">Valor</th><th>Situação</th></tr></thead>
                      <tbody>
                        {recentes.map((l) => (
                          <tr key={l.ID} className="cursor-pointer" onClick={() => nav(`/lancamentos/${l.ID}`)}>
                            <td className="font-medium text-fg">{l.NOME_FORNECEDOR || '—'}</td>
                            <td>{l.TIPO_DESC}</td>
                            <td>{l.EMPRESA}</td>
                            <td className="tabular-nums">{formatarData(l.DATA_EMISSAO)}</td>
                            <td className="text-right tabular-nums">{formatarMoeda(l.VALOR_TOTAL)}</td>
                            <td><StatusBadge status={l.STATUS} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
