import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { callSF, execSF, SF } from '../lib/api';
import { formatarDataHora } from '../lib/formato';
import { usePermissoes } from '../lib/permissoes';
import { getMitraErrorMessage } from '../lib/utils';
import { useToast } from '../hooks/useToast';
import { SkeletonPage } from '../components/ui/Skeleton';
import { ToastContainer } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import { Aviso, CabecalhoPagina, EstadoErro, SemPermissao } from '../components/Comum';
import CadastroTab from './config/CadastroTab';
import ParametrosTab from './config/ParametrosTab';
import AprovadoresTab from './config/AprovadoresTab';
import PermissoesTab from './config/PermissoesTab';

type Linha = Record<string, any>;

const ABAS = [
  { id: 'empresas', rotulo: 'Empresas' },
  { id: 'tops', rotulo: 'TOPs' },
  { id: 'naturezas', rotulo: 'Naturezas' },
  { id: 'centros', rotulo: 'Centros' },
  { id: 'contas', rotulo: 'Contas' },
  { id: 'parametros', rotulo: 'Parâmetros' },
  { id: 'aprovadores', rotulo: 'Aprovadores' },
  { id: 'permissoes', rotulo: 'Permissões' },
];

const CADASTROS: Record<string, { listar: number; criar: number; atualizar: number; excluir: number; rotulo: string; colCodigo: string; rotuloCodigo: string; colDescricao: string; codigoNumerico: boolean; extras: { col: string; param: string; rotulo: string }[] }> = {
  empresas: { listar: SF.listarEmpresas, criar: SF.criarEmpresa, atualizar: SF.atualizarEmpresa, excluir: SF.excluirEmpresa, rotulo: 'empresa', colCodigo: 'CODEMP', rotuloCodigo: 'Código no ERP', colDescricao: 'NOME', codigoNumerico: true, extras: [{ col: 'CNPJ', param: 'cnpj', rotulo: 'CNPJ' }] },
  tops: { listar: SF.listarTops, criar: SF.criarTop, atualizar: SF.atualizarTop, excluir: SF.excluirTop, rotulo: 'TOP', colCodigo: 'CODTIPOPER', rotuloCodigo: 'Código da TOP', colDescricao: 'DESCRICAO', codigoNumerico: true, extras: [{ col: 'TIPMOV', param: 'tipmov', rotulo: 'Tipo de movimento' }, { col: 'MOVIMENTO', param: 'movimento', rotulo: 'Movimento' }, { col: 'ATUALIZA_FINANCEIRO', param: 'atualizaFinanceiro', rotulo: 'Atualiza financeiro' }] },
  naturezas: { listar: SF.listarNaturezas, criar: SF.criarNatureza, atualizar: SF.atualizarNatureza, excluir: SF.excluirNatureza, rotulo: 'natureza', colCodigo: 'CODNAT', rotuloCodigo: 'Código da natureza', colDescricao: 'DESCRICAO', codigoNumerico: false, extras: [] },
  centros: { listar: SF.listarCentros, criar: SF.criarCentro, atualizar: SF.atualizarCentro, excluir: SF.excluirCentro, rotulo: 'centro de resultado', colCodigo: 'CODCENCUS', rotuloCodigo: 'Código do centro', colDescricao: 'DESCRICAO', codigoNumerico: false, extras: [] },
  contas: { listar: SF.listarContas, criar: SF.criarConta, atualizar: SF.atualizarConta, excluir: SF.excluirConta, rotulo: 'conta bancária', colCodigo: 'CODCTABCO', rotuloCodigo: 'Código da conta', colDescricao: 'DESCRICAO', codigoNumerico: true, extras: [{ col: 'BANCO', param: 'banco', rotulo: 'Banco' }] },
};

export default function ConfiguracaoPage() {
  const perm = usePermissoes();
  const [params, setParams] = useSearchParams();
  const { toasts, addToast, removeToast } = useToast();
  const [ultima, setUltima] = useState<Linha[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [naoConfigurada, setNaoConfigurada] = useState('');
  const [versao, setVersao] = useState(0);
  const aba = ABAS.some((a) => a.id === params.get('aba')) ? String(params.get('aba')) : 'empresas';

  const lerUltima = useCallback(async () => {
    try { setUltima(await callSF(SF.ultimaSincronizacao)); } catch { /* a data da carga e informativa */ }
  }, []);
  useEffect(() => { if (perm.administrador) lerUltima(); }, [perm.administrador, lerUltima]);

  async function sincronizar() {
    setSincronizando(true);
    setNaoConfigurada('');
    try {
      const r = await execSF<{ ok: boolean; erro?: string; naoConfigurada?: boolean; resultado?: Linha[] }>(SF.sincronizarCadastrosSankhya);
      if (r.naoConfigurada) setNaoConfigurada(r.erro ?? 'Integração com o ERP não configurada.');
      else if (r.ok) addToast('success', (r.resultado ?? []).map((x) => `${x.cadastro}: ${x.novos} novos, ${x.atualizados} atualizados`).join(' · '));
      else if (r.erro) addToast('error', r.erro);
      else addToast('error', (r.resultado ?? []).filter((x) => !x.ok).map((x) => `${x.cadastro}: ${x.erro}`).join(' · '));
      setVersao((v) => v + 1);
      await lerUltima();
    } catch (e) {
      const m = getMitraErrorMessage(e);
      if (/PREENCHER|401|403|n[aã]o autorizado|Authentication/i.test(m)) setNaoConfigurada(m);
      else addToast('error', m);
    } finally {
      setSincronizando(false);
    }
  }

  // A guarda espera a resposta do servidor: decidir com "ainda nao sei" joga o administrador para fora.
  if (perm.carregando) return <div className="p-4 md:p-8"><SkeletonPage /></div>;
  if (perm.erro) return <div className="p-4 md:p-8"><EstadoErro mensagem={perm.erro} onRetry={perm.recarregar} /></div>;
  if (!perm.administrador) return <div className="p-4 md:p-8"><SemPermissao /></div>;

  const dataCarga = ultima.map((u) => String(u.CRIADO_EM)).sort().pop();
  const c = CADASTROS[aba];

  return (
    <div className="p-4 md:p-8">
      <CabecalhoPagina
        titulo="Configuração"
        descricao={dataCarga ? `Cadastros sincronizados em ${formatarDataHora(dataCarga)}.` : 'Cadastros ainda não sincronizados com o ERP. Você também pode digitá-los à mão.'}
        acoes={<Button variant="secondary" disabled={sincronizando} onClick={sincronizar}><RefreshCw size={16} /> {sincronizando ? 'Sincronizando...' : 'Sincronizar com o ERP'}</Button>}
      />
      {perm.totalAdmins === 0 && (
        <Aviso tipo="warning" acao={<Button size="sm" variant="secondary" onClick={() => setParams({ aba: 'permissoes' }, { replace: true })}>Definir administrador</Button>}>
          Ninguém é administrador ainda, então todo usuário logado entra aqui. Defina quem administra para fechar esta área.
        </Aviso>
      )}
      {naoConfigurada && <Aviso tipo="info">Integração com o ERP não configurada: substitua os valores da conexão sankhya em Integrações (guia conectar-sankhya). Detalhe: {naoConfigurada}</Aviso>}

      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto" role="tablist">
        {ABAS.map((a) => {
          const ativa = a.id === aba;
          return (
            <button key={a.id} role="tab" aria-selected={ativa} onClick={() => setParams({ aba: a.id }, { replace: true })}
              className={`px-3 h-10 text-[13.5px] whitespace-nowrap border-b-2 -mb-px transition-colors ${ativa ? 'font-medium text-fg' : 'text-fg-muted hover:text-fg border-transparent'}`}
              style={ativa ? { borderColor: 'var(--color-primary-light)' } : undefined}>
              {a.rotulo}
            </button>
          );
        })}
      </div>

      {c && <CadastroTab key={`${aba}-${versao}`} {...c} onAviso={addToast} />}
      {aba === 'parametros' && <ParametrosTab key={versao} onAviso={addToast} />}
      {aba === 'aprovadores' && <AprovadoresTab onAviso={addToast} />}
      {aba === 'permissoes' && <PermissoesTab perm={perm} onAviso={addToast} />}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
