import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ExternalLink, Pencil, Send, Trash2, X, SearchCheck } from 'lucide-react';
import { callSF, exigirAfetou, execSF, SF, umaLinha } from '../lib/api';
import { formatarCnpj, formatarData, formatarDataHora, formatarMoeda, ORIGEM_CLASSIFICACAO, rotulosDoTipo } from '../lib/formato';
import { usePermissoes } from '../lib/permissoes';
import { getMitraErrorMessage } from '../lib/utils';
import { GRAVACAO_ERP_LIBERADA, useEnvioErp } from '../hooks/useEnvioErp';
import { useToast } from '../hooks/useToast';
import { Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DatePicker from '../components/ui/DatePicker';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import { SkeletonPage } from '../components/ui/Skeleton';
import { ToastContainer } from '../components/ui/Toast';
import CampoFornecedor from '../components/CampoFornecedor';
import PainelRecusaErp from '../components/PainelRecusaErp';
import ConferenciaPedidos from '../components/ConferenciaPedidos';
import StatusBadge from '../components/StatusBadge';
import { Aviso, EstadoErro } from '../components/Comum';

type Linha = Record<string, any>;

const ETAPAS: Record<string, string> = {
  ENTRADA: 'Entrada', LEITURA: 'Leitura', CLASSIFICACAO: 'Classificação', ALCADA: 'Alçada', APROVACAO: 'Aprovação', PARCEIRO: 'Parceiro',
  ENVIO_ERP: 'Envio ao ERP', CORRECAO: 'Correção', CORRECAO_ERP: 'Correção no ERP',
};

const lista = (v: unknown): Linha[] => {
  const l = typeof v === 'string' ? JSON.parse(v) : v;
  return Array.isArray(l) ? l.slice().sort((a, b) => Number(a.ID) - Number(b.ID)) : [];
};

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-fg-muted">{rotulo}</dt>
      <dd className="text-[14px] text-fg mt-0.5 break-words">{valor || '—'}</dd>
    </div>
  );
}

type ResultadoCorrespondencia = ComponentProps<typeof ConferenciaPedidos>['resultado'];

export default function LancamentoDetalhePage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const nav = useNavigate();
  const perm = usePermissoes();
  const { toasts, addToast, removeToast } = useToast();
  const [l, setL] = useState<Linha | null>(null);
  const [itens, setItens] = useState<Linha[]>([]);
  const [trilha, setTrilha] = useState<Linha[]>([]);
  const [decisoes, setDecisoes] = useState<Linha[]>([]);
  const [envios, setEnvios] = useState<Linha[]>([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [confirmaEnvio, setConfirmaEnvio] = useState(false);
  const [confirmaExclusao, setConfirmaExclusao] = useState(false);
  const [editaDados, setEditaDados] = useState(false);
  const [editaClass, setEditaClass] = useState(false);
  const [rejeitando, setRejeitando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [escolha, setEscolha] = useState('');

  const carregar = useCallback(async () => {
    try {
      // Uma chamada so: toda execucao conta no limite por minuto do projeto.
      const det = await umaLinha(SF.detalheLancamento, { id });
      setL(det);
      setItens(lista(det?.ITENS_JSON));
      setTrilha(lista(det?.TRILHA_JSON));
      setDecisoes(lista(det?.DECISOES_JSON));
      setEnvios(lista(det?.ENVIOS_JSON).reverse());
      setErro('');
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setCarregando(false);
    }
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  const envio = useEnvioErp(id, carregar);
  const [conferindoNota, setConferindoNota] = useState(false);
  const [notaConferida, setNotaConferida] = useState<{ resultado: ResultadoCorrespondencia; origem?: string } | null>(null);
  const ultimoEnvio = envios[0];
  const enviado = envios.some((e) => e.STATUS === 'OK');
  const parcial = envios.some((e) => e.STATUS === 'PARCIAL');
  const status = String(l?.STATUS ?? '');
  const podeEnviar = !enviado && !parcial && (status === 'APROVADO' || status === 'ERRO');
  const podeCorrigir = !enviado && !parcial && ['REVISAO_LEITURA', 'AGUARDANDO_APROVACAO', 'APROVADO', 'ERRO'].includes(status);
  const mensagemRecusa = envio.recusa?.mensagem ?? (status === 'ERRO' && ultimoEnvio?.STATUS === 'ERRO' ? String(ultimoEnvio.MENSAGEM ?? '') : '');
  const rot = rotulosDoTipo(String(l?.TIPO ?? ''));
  // Nota fiscal nao tem caminho de gravacao: continua so com a conferencia.
  const gravaNoErp = GRAVACAO_ERP_LIBERADA && l?.TIPO !== 'NOTA_FISCAL';

  async function decidir(acao: 'APROVAR' | 'REJEITAR') {
    setOcupado(true);
    try {
      const r = await execSF<{ ok: boolean; erro?: string }>(SF.aplicarDecisaoAprovacao, { lancamentoId: id, acao, motivo });
      if (!r.ok) addToast('error', r.erro ?? 'Não consegui aplicar a decisão.');
      else { addToast('success', acao === 'APROVAR' ? 'Lançamento aprovado.' : 'Lançamento rejeitado.'); setRejeitando(false); setMotivo(''); }
      await carregar();
    } catch (e) { addToast('error', getMitraErrorMessage(e)); } finally { setOcupado(false); }
  }

  async function enviarAgora(codparc?: number) {
    setConfirmaEnvio(false);
    if (!gravaNoErp) {
      const c = await envio.conferir(codparc);
      if (c.ok) addToast('success', c.jaEnviado ? c.mensagem ?? 'Já enviado.' : 'Conferência concluída. Nada foi gravado no ERP.');
      return;
    }
    const r = await envio.enviar(codparc);
    if (r.ok) addToast('success', r.jaEnviado ? r.mensagem ?? 'Já enviado.' : `Gravado no ERP: chave ${r.chave}.`);
  }

  // Conferencia da NF-e com os pedidos: so leitura, disponivel em qualquer situacao do lancamento.
  const [pedido, setPedido] = useState<{ nunota: number | null; ativa: boolean } | null>(null);
  const [lancandoPedido, setLancandoPedido] = useState(false);
  useEffect(() => {
    if (!l || l.TIPO !== 'NOTA_FISCAL') return;
    umaLinha(SF.rotinaPedidoDoLancamento, { id: Number(l.ID) })
      .then((r) => setPedido(r ? { nunota: Number(r.PEDIDO_NUNOTA) || null, ativa: Number(r.ATIVO) === 1 } : null))
      .catch(() => setPedido(null));
  }, [l]);
  async function lancarPedido() {
    setLancandoPedido(true);
    try {
      const r = await execSF<{ ok: boolean; nunota?: number; mensagem?: string }>(SF.lancarPedidoErp, { lancamentoId: Number(l?.ID) });
      if (r.ok) { addToast('success', r.mensagem ?? 'Pedido lançado.'); setPedido({ nunota: r.nunota ?? null, ativa: true }); }
      else addToast('error', r.mensagem ?? 'O pedido não foi lançado.');
    } catch (e) { addToast('error', getMitraErrorMessage(e)); } finally { setLancandoPedido(false); }
  }

  async function conferirNota() {
    setConferindoNota(true);
    try {
      const r = await execSF<{ ok: boolean; erro?: string; origem?: string; resultado?: ResultadoCorrespondencia }>(SF.conferirNfePedidos, { lancamentoId: id });
      if (!r.ok || !r.resultado) addToast('error', r.erro ?? 'Não consegui conferir a nota.');
      else setNotaConferida({ resultado: r.resultado, origem: r.origem });
    } catch (e) {
      addToast('error', getMitraErrorMessage(e));
    } finally {
      setConferindoNota(false);
    }
  }

  async function abrirArquivo() {
    try {
      const r = await execSF<{ ok: boolean; url?: string; erro?: string }>(SF.obterLinkArquivo, { origem: 'DOCUMENTO', id: l?.DOCUMENTO_ID });
      if (r.ok && r.url) window.open(r.url, '_blank', 'noopener');
      else addToast('error', r.erro ?? 'Arquivo indisponível.');
    } catch (e) { addToast('error', getMitraErrorMessage(e)); }
  }

  async function excluir() {
    setOcupado(true);
    try {
      await exigirAfetou(SF.excluirLancamento, { id }, 'Não foi excluído: lançamento já enviado ao ERP, ou só quem criou e o administrador podem excluir.');
      nav('/lancamentos', { replace: true });
    } catch (e) { addToast('error', getMitraErrorMessage(e)); setConfirmaExclusao(false); } finally { setOcupado(false); }
  }

  if (carregando) return <div className="p-4 md:p-8"><SkeletonPage /></div>;
  if (erro) return <div className="p-4 md:p-8"><Card><EstadoErro mensagem={erro} onRetry={carregar} /></Card></div>;
  if (!l) return <div className="p-4 md:p-8"><Card><EstadoErro mensagem="Lançamento não encontrado, ou fora dos tipos que você enxerga." /></Card></div>;

  return (
    <div className="p-4 md:p-8">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg mb-3"><ArrowLeft size={16} /> Voltar</button>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold text-fg truncate">{l.NOME_FORNECEDOR || 'Sem fornecedor'}</h1>
          <p className="text-[13px] text-fg-muted mt-0.5">{l.TIPO_DESC} · lançamento {l.ID} · {formatarDataHora(l.CRIADO_EM)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={status} />
          <span className="text-[20px] font-semibold tabular-nums text-fg">{formatarMoeda(l.VALOR_TOTAL)}</span>
        </div>
      </div>

      {status === 'REVISAO_LEITURA' && (
        <Aviso tipo="warning" acao={<Button size="sm" onClick={() => setEditaDados(true)}><Pencil size={16} /> Conferir leitura</Button>}>
          A leitura ficou abaixo do corte de confiança. Confira os campos antes de seguir: ao confirmar, o valor passa pela alçada.
        </Aviso>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          <Card>
            <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-fg">Dados do documento</h2>
              {podeCorrigir && <Button size="sm" variant="ghost" onClick={() => setEditaDados(true)}><Pencil size={16} /> Corrigir</Button>}
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 px-5 py-5">
              <Campo rotulo="Empresa" valor={l.EMPRESA} />
              <Campo rotulo="Fornecedor" valor={l.NOME_FORNECEDOR} />
              <Campo rotulo="CNPJ" valor={formatarCnpj(l.CNPJ_FORNECEDOR)} />
              <Campo rotulo="Número" valor={l.NUMERO_DOC} />
              <Campo rotulo="Série" valor={l.SERIE} />
              <Campo rotulo={rot.data} valor={formatarData(l.DATA_EMISSAO)} />
              {rot.vencimento && <Campo rotulo={rot.vencimento} valor={formatarData(l.DATA_VENCIMENTO)} />}
              <Campo rotulo="Parceiro no ERP" valor={l.CODPARC} />
              <Campo rotulo="Arquivo" valor={l.ARQUIVO_NOME && l.ARQUIVO_NOME !== 'Sem arquivo' ? <button onClick={abrirArquivo} className="underline inline-flex items-center gap-1 text-left">{l.ARQUIVO_NOME} <ExternalLink size={14} /></button> : 'Sem arquivo'} />
            </dl>
          </Card>

          <Card>
            <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-medium text-fg">Classificação</h2>
                <Badge variant="neutral">{ORIGEM_CLASSIFICACAO[l.ORIGEM_CLASSIFICACAO] ?? 'Sem classificação'}</Badge>
              </div>
              {podeCorrigir && <Button size="sm" variant="ghost" onClick={() => setEditaClass(true)}><Pencil size={16} /> Corrigir</Button>}
            </div>
            <dl className="grid grid-cols-2 gap-4 px-5 py-5">
              <Campo rotulo="TOP" valor={l.TOP_DESC ? `${l.CODTIPOPER} · ${l.TOP_DESC}` : ''} />
              <Campo rotulo="Natureza" valor={l.NATUREZA_DESC ? `${l.CODNAT} · ${l.NATUREZA_DESC}` : ''} />
              <Campo rotulo="Centro de resultado" valor={l.CENTRO_DESC ? `${l.CODCENCUS} · ${l.CENTRO_DESC}` : ''} />
              <Campo rotulo="Conta bancária" valor={l.CONTA_DESC ? `${l.CODCTABCO} · ${l.CONTA_DESC}` : ''} />
            </dl>
          </Card>

          {(l.TIPO === 'NOTA_FISCAL' || itens.length > 0) && (
            <ItensCard itens={itens} editavel={podeCorrigir} onSalvo={carregar} onAviso={addToast} />
          )}

          <Card>
            <div className="px-5 py-4 border-b border-border-subtle"><h2 className="text-[14px] font-medium text-fg">Trilha</h2></div>
            <ol className="px-5 py-4 flex flex-col gap-3">
              {trilha.length === 0 && <li className="text-[13px] text-fg-muted">Sem registros.</li>}
              {trilha.map((t) => (
                <li key={t.ID} className="flex gap-3">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: t.STATUS === 'OK' ? 'var(--success)' : t.STATUS === 'ATENCAO' || t.STATUS === 'RECUSADO' ? 'var(--warning)' : 'var(--danger)' }} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] text-fg break-words">{t.MENSAGEM}</p>
                    <p className="text-[12px] text-fg-muted">{ETAPAS[t.ETAPA] ?? t.ETAPA} · {formatarDataHora(t.CRIADO_EM)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex flex-col gap-5 min-w-0">
          {status === 'AGUARDANDO_APROVACAO' && (
            <Card>
              <div className="px-5 py-4 border-b border-border-subtle"><h2 className="text-[14px] font-medium text-fg">Aprovação</h2></div>
              <div className="px-5 py-5 flex flex-col gap-3">
                <p className="text-[13px] text-fg-muted">Este valor precisa de uma decisão antes de ir ao ERP.</p>
                <div className="flex gap-2">
                  <Button disabled={ocupado} onClick={() => decidir('APROVAR')}><Check size={16} /> Aprovar</Button>
                  <Button variant="secondary" disabled={ocupado} onClick={() => setRejeitando(true)}><X size={16} /> Rejeitar</Button>
                </div>
              </div>
            </Card>
          )}

          {l.TIPO === 'NOTA_FISCAL' && (
            <Card>
              <div className="px-5 py-4 border-b border-border-subtle"><h2 className="text-[14px] font-medium text-fg">Conferência com pedidos</h2></div>
              <div className="px-5 py-5 flex flex-col gap-3">
                <p className="text-[13px] text-fg-muted">Compara a nota com os pedidos de compra: candidatos, quantidades, preços, vínculos e divergências. Somente leitura: não cria nota, não altera pedido e não gera provisão.</p>
                <Button variant="secondary" disabled={conferindoNota} onClick={conferirNota}><SearchCheck size={16} /> {conferindoNota ? 'Conferindo...' : 'Conferir com pedidos'}</Button>
                {pedido?.nunota === -1 && <Aviso tipo="warning">O lançamento do pedido foi iniciado e não terminou. Confira no Sankhya antes de qualquer nova tentativa.</Aviso>}
                {pedido?.nunota && pedido.nunota > 0 && <p className="text-[13.5px] text-fg">Pedido <strong className="font-semibold tabular-nums">{pedido.nunota}</strong> lançado no Sankhya, sem confirmar. O ADM da loja confirma e pede a liberação.</p>}
                {pedido && !pedido.nunota && pedido.ativa && (
                  <Button disabled={lancandoPedido} onClick={lancarPedido}><Send size={16} /> {lancandoPedido ? 'Lançando...' : 'Lançar pedido no Sankhya'}</Button>
                )}
                {pedido && !pedido.nunota && !pedido.ativa && <p className="text-[12.5px] text-fg-subtle">Rotina de pedido desligada para esta empresa (Configurações → Rotina de pedidos).</p>}
              </div>
            </Card>
          )}

          <Card>
            <div className="px-5 py-4 border-b border-border-subtle"><h2 className="text-[14px] font-medium text-fg">{gravaNoErp ? 'Enviar ao ERP' : 'Conferir para o ERP'}</h2></div>
            <div className="px-5 py-5 flex flex-col gap-3">
              {!gravaNoErp && !enviado && !parcial && <p className="text-[13px] text-fg-muted">Nota fiscal não é gravada no ERP por aqui. A conferência só lê o Sankhya e mostra o que seria enviado.</p>}
              {enviado && <p className="text-[13.5px] text-fg">Gravado no ERP. Chave <strong className="font-semibold tabular-nums">{envios.find((e) => e.STATUS === 'OK')?.CHAVE_ERP}</strong>.</p>}
              {parcial && <Aviso tipo="danger">A nota entrou no ERP com itens faltando. Reenviar criaria uma segunda nota: a correção é dentro do Sankhya.</Aviso>}
              {!enviado && !parcial && !podeEnviar && <p className="text-[13px] text-fg-muted">{status === 'AGUARDANDO_APROVACAO' ? `${gravaNoErp ? 'O envio' : 'A conferência'} fica disponível depois da aprovação.` : status === 'REVISAO_LEITURA' ? `${gravaNoErp ? 'O envio' : 'A conferência'} fica disponível depois da conferência da leitura.` : 'Lançamento rejeitado não vai ao ERP.'}</p>}
              {gravaNoErp && podeEnviar && !mensagemRecusa && !envio.candidatos && (
                <>
                  <p className="text-[13px] text-fg-muted">Gravar no ERP é irreversível e vale na produção do Sankhya. Confira os dados antes de enviar.</p>
                  <Button variant="secondary" disabled={envio.enviando} onClick={() => envio.conferir()}><SearchCheck size={16} /> Conferir sem gravar</Button>
                  <Button disabled={envio.enviando} onClick={() => setConfirmaEnvio(true)}><Send size={16} /> {envio.enviando ? 'Enviando...' : 'Enviar ao ERP'}</Button>
                </>
              )}
              {!gravaNoErp && podeEnviar && !mensagemRecusa && !envio.candidatos && (
                <Button variant="secondary" disabled={envio.enviando} onClick={() => enviarAgora()}><SearchCheck size={16} /> {envio.enviando ? 'Conferindo...' : 'Conferir sem gravar'}</Button>
              )}
              {envio.conferencia?.correspondencia && (
                <div className="rounded-xl border border-border-subtle p-4 flex flex-col gap-2">
                  <p className="text-[13.5px] text-fg">{envio.conferencia.correspondencia.resumo}</p>
                  <Button variant="secondary" onClick={() => setNotaConferida({ resultado: envio.conferencia?.correspondencia as unknown as ResultadoCorrespondencia, origem: envio.conferencia?.origemDocumento })}><SearchCheck size={16} /> Ver a conferência</Button>
                </div>
              )}
              {envio.conferencia && !envio.conferencia.correspondencia && (
                <div className="rounded-xl border border-border-subtle p-4 flex flex-col gap-1.5">
                  <p className="text-[13.5px] font-medium text-fg">Conferência sem gravar: passou por todas as guardas.</p>
                  <p className="text-[13px] text-fg-muted">Parceiro {envio.conferencia.parceiro?.codparc} · {envio.conferencia.parceiro?.nome ?? 'sem nome'}</p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] mt-1">
                    {Object.entries(envio.conferencia.campos ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2 min-w-0"><dt className="text-fg-muted">{k}</dt><dd className="text-fg tabular-nums truncate">{String(v)}</dd></div>
                    ))}
                  </dl>
                </div>
              )}
              {envio.candidatos && (
                <div className="flex flex-col gap-2">
                  <p className="text-[13.5px] text-fg">Há mais de um parceiro com este CNPJ. Qual recebe o lançamento?</p>
                  {envio.candidatos.map((c) => (
                    <button key={c.codparc} type="button" aria-pressed={escolha === String(c.codparc)} onClick={() => setEscolha(String(c.codparc))} className={`rounded-lg border px-3 py-2 text-left text-[13px] ${escolha === String(c.codparc) ? 'border-brand-border bg-brand-soft' : 'border-border hover:bg-surface-hover'}`}>
                      <span className="font-medium text-fg tabular-nums">{c.codparc}</span> · {c.nome}
                      <span className="block text-[12px] text-fg-muted">{c.fornecedor ? 'Fornecedor no ERP' : 'Não marcado como fornecedor'}</span>
                    </button>
                  ))}
                  <Button disabled={!escolha || envio.enviando} onClick={() => enviarAgora(Number(escolha))}><Send size={16} /> {gravaNoErp ? 'Enviar para este parceiro' : 'Conferir com este parceiro'}</Button>
                </div>
              )}
              {envio.recusa?.motivo === 'CRIACAO_NOTA_BLOQUEADA' && !envio.candidatos && <Aviso tipo="info">{envio.recusa.mensagem}</Aviso>}
              {!enviado && !parcial && mensagemRecusa && envio.recusa?.motivo !== 'CRIACAO_NOTA_BLOQUEADA' && !envio.candidatos && (
                <PainelRecusaErp lancamentoId={id} mensagem={mensagemRecusa} semParceiro={envio.recusa?.semParceiro} nomeFornecedor={String(l.NOME_FORNECEDOR ?? '')} administrador={perm.administrador} enviando={envio.enviando} onTentar={() => enviarAgora()} onAviso={addToast} />
              )}
              {envios.length > 0 && (
                <div className="border-t border-border-subtle pt-3">
                  <p className="text-[12px] text-fg-muted mb-2">Histórico de envios</p>
                  <ul className="flex flex-col gap-2">
                    {envios.map((e) => (
                      <li key={e.ID} className="text-[12.5px] text-fg-muted">
                        <Badge variant={e.STATUS === 'OK' ? 'success' : e.STATUS === 'PARCIAL' ? 'warning' : 'danger'}>{e.STATUS}</Badge>{' '}
                        {formatarDataHora(e.CRIADO_EM)}{e.CHAVE_ERP ? ` · chave ${e.CHAVE_ERP}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          {decisoes.length > 0 && (
            <Card>
              <div className="px-5 py-4 border-b border-border-subtle"><h2 className="text-[14px] font-medium text-fg">Decisões</h2></div>
              <ul className="px-5 py-4 flex flex-col gap-3">
                {decisoes.map((d) => (
                  <li key={d.ID} className="text-[13px] text-fg">
                    <strong className="font-medium">{d.ACAO === 'APROVAR' ? 'Aprovado' : 'Rejeitado'}</strong> por {d.USUARIO ?? 'usuário'}
                    <span className="block text-[12px] text-fg-muted">{formatarDataHora(d.CRIADO_EM)}</span>
                    {d.MOTIVO && <span className="block text-[13px] text-fg-muted mt-1">{d.MOTIVO}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {!enviado && !parcial && status !== 'LANCADO' && (
            <Button variant="ghost" onClick={() => setConfirmaExclusao(true)}><Trash2 size={16} /> Excluir lançamento</Button>
          )}
        </div>
      </div>

      <ConfirmDialog isOpen={confirmaEnvio} onClose={() => setConfirmaEnvio(false)} onConfirm={() => enviarAgora()} title="Enviar ao ERP" confirmLabel="Gravar no ERP" loading={envio.enviando}
        message={`Grava ${formatarMoeda(l.VALOR_TOTAL)} de ${l.NOME_FORNECEDOR || 'fornecedor sem nome'} no Sankhya de produção. Esta ação não pode ser desfeita por aqui.`} />
      <ConfirmDialog isOpen={confirmaExclusao} onClose={() => setConfirmaExclusao(false)} onConfirm={excluir} title="Excluir lançamento" confirmLabel="Excluir" loading={ocupado}
        message="Apaga o lançamento, os itens, a trilha e o documento deste sistema. O mesmo arquivo poderá entrar de novo." />

      <Modal isOpen={notaConferida !== null} onClose={() => setNotaConferida(null)} title="Conferência com pedidos" size="xl">
        {notaConferida && <ConferenciaPedidos resultado={notaConferida.resultado} origem={notaConferida.origem} />}
      </Modal>

      <Modal isOpen={rejeitando} onClose={() => setRejeitando(false)} title="Rejeitar lançamento" size="sm">
        <div className="flex flex-col gap-3">
          <Input label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por que este lançamento não segue?" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejeitando(false)}>Cancelar</Button>
            <Button variant="danger" disabled={!motivo.trim() || ocupado} onClick={() => decidir('REJEITAR')}>Rejeitar</Button>
          </div>
        </div>
      </Modal>

      {editaDados && <EditarDadosModal l={l} onFechar={() => setEditaDados(false)} onSalvo={() => { setEditaDados(false); carregar(); addToast('success', 'Dados corrigidos. A alçada foi reavaliada.'); }} />}
      {editaClass && <EditarClassificacaoModal l={l} onFechar={() => setEditaClass(false)} onSalvo={() => { setEditaClass(false); carregar(); addToast('success', 'Classificação corrigida.'); }} />}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function ItensCard({ itens, editavel, onSalvo, onAviso }: { itens: Linha[]; editavel: boolean; onSalvo: () => void; onAviso: (t: 'success' | 'error', m: string) => void }) {
  const [editando, setEditando] = useState<Linha | null>(null);
  const [termo, setTermo] = useState('');
  const [produtos, setProdutos] = useState<{ value: string; label: string }[]>([]);
  const [codprod, setCodprod] = useState('');

  async function buscar() {
    try {
      const r = await execSF<{ itens?: Linha[] }>(SF.sankhyaProdutos, { busca: termo });
      setProdutos((r?.itens ?? []).map((p) => ({ value: String(p.CODPROD), label: `${p.CODPROD} · ${p.DESCRPROD}` })));
    } catch (e) { onAviso('error', getMitraErrorMessage(e)); }
  }
  async function salvar() {
    if (!editando) return;
    try {
      await exigirAfetou(SF.atualizarItemLancamento, { id: editando.ID, descricao: editando.DESCRICAO, quantidade: editando.QUANTIDADE, valorUnitario: editando.VALOR_UNITARIO, codprod: Number(codprod) || 0 }, 'Item não alterado: o lançamento já foi enviado.');
      setEditando(null);
      onSalvo();
    } catch (e) { onAviso('error', getMitraErrorMessage(e)); }
  }
  return (
    <Card>
      <div className="px-5 py-4 border-b border-border-subtle"><h2 className="text-[14px] font-medium text-fg">Itens</h2></div>
      {itens.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-fg-muted">Sem itens: o envio usa o produto padrão do parâmetro.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead><tr><th>Descrição</th><th className="text-right">Qtd.</th><th className="text-right">Unitário</th><th>Produto ERP</th><th /></tr></thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.ID}>
                  <td>{i.DESCRICAO}</td>
                  <td className="text-right tabular-nums">{Number(i.QUANTIDADE)}</td>
                  <td className="text-right tabular-nums">{formatarMoeda(i.VALOR_UNITARIO)}</td>
                  <td className="tabular-nums">{i.CODPROD ?? '—'}</td>
                  <td className="text-right">{editavel && <Button size="sm" variant="ghost" aria-label="Definir produto" onClick={() => { setEditando(i); setCodprod(String(i.CODPROD ?? '')); setProdutos([]); setTermo(''); }}><Pencil size={16} /></Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal isOpen={Boolean(editando)} onClose={() => setEditando(null)} title="Produto do ERP" size="sm">
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-fg-muted">{editando?.DESCRICAO}</p>
          <div className="flex items-end gap-2">
            <div className="flex-1"><Input label="Buscar produto" value={termo} onChange={(e) => setTermo(e.target.value)} /></div>
            <Button variant="secondary" disabled={termo.trim().length < 2} onClick={buscar}>Buscar</Button>
          </div>
          <Select label="Produto" options={produtos} value={codprod} onChange={setCodprod} placeholder={produtos.length ? 'Selecione...' : 'Busque acima'} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button disabled={!codprod} onClick={salvar}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function EditarDadosModal({ l, onFechar, onSalvo }: { l: Linha; onFechar: () => void; onSalvo: () => void }) {
  const [f, setF] = useState({ nome: String(l.NOME_FORNECEDOR ?? ''), cnpj: String(l.CNPJ_FORNECEDOR ?? ''), codparc: Number(l.CODPARC ?? 0), numeroDoc: String(l.NUMERO_DOC ?? ''), serie: String(l.SERIE ?? ''), dataEmissao: String(l.DATA_EMISSAO ?? ''), dataVencimento: String(l.DATA_VENCIMENTO ?? ''), valorTotal: String(l.VALOR_TOTAL ?? '') });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const rot = rotulosDoTipo(String(l.TIPO));
  async function salvar() {
    const valor = Number(f.valorTotal.replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) { setErro('Informe um valor válido.'); return; }
    setSalvando(true);
    try {
      await exigirAfetou(SF.corrigirDadosLancamento, { id: l.ID, ...f, cnpj: f.cnpj.replace(/\D/g, ''), valorTotal: valor }, 'Não foi alterado: o lançamento mudou de situação ou já foi enviado ao ERP.');
      await execSF(SF.registrarLog, { lancamentoId: l.ID, etapa: 'CORRECAO', statusLog: 'OK', mensagem: `Dados corrigidos por uma pessoa (valor ${formatarMoeda(l.VALOR_TOTAL)} para ${formatarMoeda(valor)}). Alçada reavaliada.` });
      onSalvo();
    } catch (e) { setErro(getMitraErrorMessage(e)); } finally { setSalvando(false); }
  }
  return (
    <Modal isOpen onClose={onFechar} title="Corrigir dados" size="lg">
      <div className="flex flex-col gap-4">
        {erro && <Aviso tipo="danger">{erro}</Aviso>}
        <p className="text-[13px] text-fg-muted">Ao salvar, a alçada é reavaliada: mudar o valor invalida uma aprovação anterior.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CampoFornecedor nome={f.nome} onNome={(v) => setF((a) => ({ ...a, nome: v, codparc: 0 }))} onEscolher={(p) => setF((a) => ({ ...a, nome: p.nome, cnpj: p.cnpj, codparc: p.codparc }))} />
          <Input label="CNPJ" value={f.cnpj} onChange={(e) => setF((a) => ({ ...a, cnpj: e.target.value }))} />
          <Input label="Número" value={f.numeroDoc} onChange={(e) => setF((a) => ({ ...a, numeroDoc: e.target.value }))} />
          <Input label="Série" value={f.serie} onChange={(e) => setF((a) => ({ ...a, serie: e.target.value }))} />
          <DatePicker label={rot.data} value={f.dataEmissao} onChange={(v) => setF((a) => ({ ...a, dataEmissao: v }))} />
          {rot.vencimento && <DatePicker label={rot.vencimento} value={f.dataVencimento} onChange={(v) => setF((a) => ({ ...a, dataVencimento: v }))} />}
          <Input label="Valor total" inputMode="decimal" value={f.valorTotal} onChange={(e) => setF((a) => ({ ...a, valorTotal: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
          <Button disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function EditarClassificacaoModal({ l, onFechar, onSalvo }: { l: Linha; onFechar: () => void; onSalvo: () => void }) {
  const [op, setOp] = useState<Linha[]>([]);
  const [f, setF] = useState({ topId: String(l.TOP_ID ?? ''), naturezaId: String(l.NATUREZA_ID ?? ''), centroId: String(l.CENTRO_ID ?? ''), contaId: String(l.CONTA_ID ?? '') });
  const [erro, setErro] = useState('');
  useEffect(() => { callSF(SF.listarOpcoesCadastro).then(setOp).catch((e) => setErro(getMitraErrorMessage(e))); }, []);
  const opcoes = useMemo(() => (grupo: string) => op.filter((o) => o.GRUPO === grupo && Number(o.ATIVO) === 1).map((o) => ({ value: String(o.ID), label: `${o.CODIGO} · ${o.DESCRICAO}` })), [op]);
  async function salvar() {
    try {
      await exigirAfetou(SF.atualizarClassificacaoLancamento, { id: l.ID, topId: Number(f.topId) || 0, naturezaId: Number(f.naturezaId) || 0, centroId: Number(f.centroId) || 0, contaId: Number(f.contaId) || 0 }, 'Não foi alterado: lançamento já enviado ou rejeitado.');
      await execSF(SF.registrarLog, { lancamentoId: l.ID, etapa: 'CLASSIFICACAO', statusLog: 'OK', mensagem: 'Classificação corrigida por uma pessoa.' });
      onSalvo();
    } catch (e) { setErro(getMitraErrorMessage(e)); }
  }
  return (
    <Modal isOpen onClose={onFechar} title="Corrigir classificação">
      <div className="flex flex-col gap-3">
        {erro && <Aviso tipo="danger">{erro}</Aviso>}
        <Select label="TOP" options={opcoes('TOP')} value={f.topId} onChange={(v) => setF((a) => ({ ...a, topId: v }))} />
        <Select label="Natureza" options={opcoes('NATUREZA')} value={f.naturezaId} onChange={(v) => setF((a) => ({ ...a, naturezaId: v }))} />
        <Select label="Centro de resultado" options={opcoes('CENTRO')} value={f.centroId} onChange={(v) => setF((a) => ({ ...a, centroId: v }))} />
        <Select label="Conta bancária" options={opcoes('CONTA')} value={f.contaId} onChange={(v) => setF((a) => ({ ...a, contaId: v }))} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}
