import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Plus, Search } from 'lucide-react';
import { callSF, SF } from '../lib/api';
import { formatarCnpj, formatarData, formatarMoeda, ORIGEM_CLASSIFICACAO, rotulosDoTipo } from '../lib/formato';
import { getMitraErrorMessage } from '../lib/utils';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { SkeletonTable } from '../components/ui/Skeleton';
import StatusBadge from '../components/StatusBadge';
import NovoLancamentoModal from '../components/NovoLancamentoModal';
import { CabecalhoPagina, EstadoErro, EstadoVazio, Paginacao } from '../components/Comum';

type Linha = Record<string, any>;
interface Tipo { ID: number; CODIGO: string; DESCRICAO: string }
const POR_PAGINA = 30;

export default function LancamentosPage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tipos, setTipos] = useState<Tipo[] | null>(null);
  const [empresas, setEmpresas] = useState<{ value: string; label: string }[]>([]);
  const [situacoes, setSituacoes] = useState<{ value: string; label: string }[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0);
  const [novo, setNovo] = useState(false);
  const [busca, setBusca] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState('');

  const status = params.get('status') ?? '';
  const empresaId = params.get('empresa') ?? '';
  const tipoAtual = useMemo(() => (tipos ? tipos.find((t) => t.CODIGO === params.get('tipo')) ?? tipos[0] ?? null : null), [tipos, params]);

  useEffect(() => {
    let vivo = true;
    Promise.all([callSF<Tipo>(SF.tiposVisiveisUsuario), callSF(SF.listarOpcoesCadastro), callSF(SF.listarStatusLancamento)])
      .then(([t, op, st]) => {
        if (!vivo) return;
        setTipos(t);
        setEmpresas(op.filter((o) => o.GRUPO === 'EMPRESA').map((o) => ({ value: String(o.ID), label: `${o.CODIGO} · ${o.DESCRICAO}` })));
        setSituacoes(st.map((s) => ({ value: String(s.CODIGO), label: String(s.DESCRICAO) })));
      })
      .catch((e) => { if (vivo) { setErro(getMitraErrorMessage(e)); setCarregando(false); } });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setBuscaAtiva(busca.trim()); setPagina(0); }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  // A busca so dispara depois que a aba existe: antes mostraria a lista misturada que as abas eliminam.
  const carregar = useCallback(async () => {
    if (!tipoAtual) { if (tipos) setCarregando(false); return; }
    setCarregando(true);
    setErro('');
    try {
      const r = await callSF(SF.listarLancamentos, { tipoId: tipoAtual.ID, status, empresaId, busca: buscaAtiva, limite: POR_PAGINA, offset: pagina * POR_PAGINA });
      setLinhas(r);
      setTotal(Number(r[0]?.TOTAL_GERAL ?? 0));
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setCarregando(false);
    }
  }, [tipoAtual, tipos, status, empresaId, buscaAtiva, pagina]);

  useEffect(() => { carregar(); }, [carregar, versao]);

  const mudarParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
    setPagina(0);
  };
  const rot = rotulosDoTipo(tipoAtual?.CODIGO ?? '');

  if (tipos && tipos.length === 0) {
    return (
      <div className="p-4 md:p-8">
        <CabecalhoPagina titulo="Lançamentos" />
        <Card><EstadoVazio titulo="Você não enxerga nenhum tipo de documento" descricao="Peça ao administrador para liberar os tipos em Configuração → Permissões." /></Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <CabecalhoPagina
        titulo="Lançamentos"
        descricao="Envie o documento: o sistema lê, classifica e passa pela aprovação quando o valor exige."
        acoes={tipoAtual && <Button onClick={() => setNovo(true)}><Plus size={16} /> Novo — {tipoAtual.DESCRICAO}</Button>}
      />

      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto" role="tablist">
        {(tipos ?? []).map((t) => {
          const ativa = tipoAtual?.ID === t.ID;
          return (
            <button key={t.ID} role="tab" aria-selected={ativa} onClick={() => mudarParam('tipo', t.CODIGO)}
              className={`px-3 h-10 text-[13.5px] whitespace-nowrap border-b-2 -mb-px transition-colors ${ativa ? 'font-medium text-fg' : 'text-fg-muted hover:text-fg border-transparent'}`}
              style={ativa ? { borderColor: 'var(--color-primary-light)' } : undefined}>
              {t.DESCRICAO}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-3 text-fg-subtle" />
          <input className="controle controle-com-icone h-10 w-full" aria-label="Buscar" placeholder="Fornecedor, número ou CNPJ" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="w-full sm:w-56"><Select options={[{ value: '', label: 'Todas as empresas' }, ...empresas]} value={empresaId} onChange={(v) => mudarParam('empresa', v)} placeholder="Empresa" /></div>
        <div className="w-full sm:w-52"><Select options={[{ value: '', label: 'Todas as situações' }, ...situacoes]} value={status} onChange={(v) => mudarParam('status', v)} placeholder="Situação" /></div>
      </div>

      <Card>
        {erro ? (
          <EstadoErro mensagem={erro} onRetry={() => setVersao((v) => v + 1)} />
        ) : carregando || !tipos ? (
          <SkeletonTable />
        ) : linhas.length === 0 ? (
          <EstadoVazio icone={<FileText size={20} />} titulo={status || empresaId || buscaAtiva ? 'Nada com estes filtros' : `Nenhum lançamento de ${tipoAtual?.DESCRICAO ?? 'este tipo'}`} descricao={status || empresaId || buscaAtiva ? undefined : 'Envie o primeiro documento para começar.'}
            acao={tipoAtual && !status && !empresaId && !buscaAtiva ? <Button onClick={() => setNovo(true)}><Plus size={16} /> Novo — {tipoAtual.DESCRICAO}</Button> : undefined} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Fornecedor</th><th>Empresa</th><th>Número</th><th>{rot.data}</th>
                    {rot.vencimento && <th>{rot.vencimento}</th>}
                    <th className="text-right">Valor</th><th>Classificação</th><th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.ID} className="cursor-pointer" onClick={() => nav(`/lancamentos/${l.ID}`)}>
                      <td>
                        <div className="font-medium text-fg">{l.NOME_FORNECEDOR || '—'}</div>
                        <div className="text-[12px] text-fg-muted tabular-nums">{formatarCnpj(l.CNPJ_FORNECEDOR)}</div>
                      </td>
                      <td>{l.EMPRESA}</td>
                      <td className="tabular-nums">{l.NUMERO_DOC || '—'}</td>
                      <td className="tabular-nums">{formatarData(l.DATA_EMISSAO)}</td>
                      {rot.vencimento && <td className="tabular-nums">{formatarData(l.DATA_VENCIMENTO)}</td>}
                      <td className="text-right tabular-nums">{formatarMoeda(l.VALOR_TOTAL)}</td>
                      <td className="text-fg-muted">{ORIGEM_CLASSIFICACAO[l.ORIGEM_CLASSIFICACAO] ?? '—'}</td>
                      <td><StatusBadge status={l.STATUS} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} total={total} porPagina={POR_PAGINA} onMudar={setPagina} />
          </>
        )}
      </Card>

      <NovoLancamentoModal aberto={novo} tipo={tipoAtual} empresas={empresas} onFechar={() => setNovo(false)} onCriado={(id) => { setNovo(false); nav(`/lancamentos/${id}`); }} />
    </div>
  );
}
