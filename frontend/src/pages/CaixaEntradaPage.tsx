import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadFilePrivateMitra } from 'mitra-interactions-sdk';
import { AlertTriangle, Check, ExternalLink, FileUp, Gauge, Inbox, Plug, RefreshCw, Settings2, Send, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { callSF, execSF, exigirAfetou, PROJECT_ID, SF, umaLinha } from '../lib/api';
import { formatarData, formatarDataHora, formatarMoeda } from '../lib/formato';
import { usePermissoes } from '../lib/permissoes';
import { getMitraErrorMessage } from '../lib/utils';
import { useToast } from '../hooks/useToast';
import { Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { SkeletonKpis, SkeletonTable } from '../components/ui/Skeleton';
import { ToastContainer } from '../components/ui/Toast';
import { Aviso, BarraConfianca, CabecalhoPagina, EstadoErro, EstadoVazio, Paginacao } from '../components/Comum';

type Linha = Record<string, any>;
const POR_PAGINA = 30;

const DESFECHOS: Record<string, { rotulo: string; variante: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  LANCADO: { rotulo: 'Lançado', variante: 'success' },
  PRONTO: { rotulo: 'Pronto para conferência', variante: 'success' },
  NOTA_PEDIDO: { rotulo: 'Nota conferida com pedidos', variante: 'info' },
  SIMULADO: { rotulo: 'Pronto (simulação)', variante: 'info' },
  APROVACAO: { rotulo: 'Para aprovação', variante: 'warning' },
  REVISAO: { rotulo: 'Revisão de leitura', variante: 'neutral' },
  SEM_EMPRESA: { rotulo: 'Sem empresa', variante: 'danger' },
  DUPLICADO: { rotulo: 'Duplicado', variante: 'neutral' },
  ERRO: { rotulo: 'Parou na conferência', variante: 'danger' },
};

function Indicador({ rotulo, valor, detalhe, icone, cor }: { rotulo: string; valor: string; detalhe?: string; icone: React.ReactNode; cor: string }) {
  return (
    <div className="cartao p-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[13px] text-fg-muted">{rotulo}</p>
        <p className="text-[22px] font-semibold tabular-nums text-fg mt-1">{valor}</p>
        {detalhe && <p className="text-[12.5px] text-fg-muted mt-1 truncate">{detalhe}</p>}
      </div>
      <span className="shrink-0" style={{ color: cor }}>{icone}</span>
    </div>
  );
}

export default function CaixaEntradaPage() {
  const nav = useNavigate();
  const perm = usePermissoes();
  const { toasts, addToast, removeToast } = useToast();
  const [kpis, setKpis] = useState<Linha | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [execucao, setExecucao] = useState<Linha | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [confirmaBusca, setConfirmaBusca] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [ajustes, setAjustes] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const corte = Number(config.CORTE_CONFIANCA ?? 90);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const [k, l, c, e] = await Promise.all([
        umaLinha(SF.roboKpis),
        callSF(SF.roboListarAnexos, { limite: POR_PAGINA, offset: pagina * POR_PAGINA }),
        callSF(SF.roboLerConfig),
        umaLinha(SF.roboUltimaExecucao),
      ]);
      setKpis(k);
      setLinhas(l);
      setTotal(Number(l[0]?.TOTAL_GERAL ?? 0));
      const m: Record<string, string> = {};
      c.forEach((x) => { m[String(x.CHAVE)] = String(x.VALOR ?? ''); });
      setConfig(m);
      setExecucao(e);
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setCarregando(false);
    }
  }, [pagina]);
  useEffect(() => { carregar(); }, [carregar]);

  async function buscarAgora() {
    setConfirmaBusca(false);
    setBuscando(true);
    try {
      const r = await execSF<Linha>(SF.roboVarrerEmails, { origem: 'BOTAO' });
      if (r.ok) addToast('success', `${r.mensagens} mensagem(ns), ${r.anexos} anexo(s) lidos: ${r.lancados} lançados, ${r.aprovacao} para aprovação, ${r.revisao} em revisão.`);
      else addToast('error', r.erro ?? 'A busca falhou.');
    } catch (e) {
      addToast('error', getMitraErrorMessage(e));
    } finally {
      setBuscando(false);
      carregar();
    }
  }

  async function entregar(f: File) {
    setEntregando(true);
    try {
      if (!/\.(xml|pdf)$/i.test(f.name)) throw new Error('O robô lê arquivos XML e PDF.');
      if (f.size > 12 * 1024 * 1024) throw new Error('Arquivo acima de 12 MB.');
      const buffer = new Uint8Array(await f.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buffer.length; i += 0x8000) bin += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
      const r = await execSF<Linha>(SF.roboProcessarAnexo, { nome: f.name, conteudoB64: btoa(bin) });
      if (!r.ok) addToast('error', r.erro ?? 'Não consegui processar.');
      else addToast('info', `${DESFECHOS[r.decisao]?.rotulo ?? r.decisao}: ${r.motivo}`);
    } catch (e) {
      addToast('error', getMitraErrorMessage(e));
    } finally {
      setEntregando(false);
      carregar();
    }
  }

  async function testarConexao() {
    setTestando(true);
    try {
      const r = await execSF<Linha>(SF.roboTestarCaixa);
      if (r.ok) addToast('success', r.caixas ? `Caixas conectadas: ${r.erro}.` : `Caixa conectada: ${r.email} (${r.mensagens} mensagens).`);
      else addToast('error', `Caixa não conectada: ${r.erro}`);
    } catch (e) {
      addToast('error', getMitraErrorMessage(e));
    } finally {
      setTestando(false);
    }
  }

  const erroBusca = execucao?.STATUS === 'ERRO' ? String(execucao.MENSAGEM ?? '') : '';

  return (
    <div className="p-4 md:p-8">
      <CabecalhoPagina
        titulo="Caixa de entrada"
        descricao={`O robô lê e classifica as notas do e-mail. Acima de ${corte}% de confiança e dentro da alçada, deixa pronto para conferência. Ele não grava no ERP e nunca confirma nota. A caixa só é lida quando você pede.`}
        acoes={
          <>
            <Button variant="secondary" disabled={testando} onClick={testarConexao}><Plug size={16} /> {testando ? 'Testando...' : 'Testar conexão'}</Button>
            <Button variant="secondary" disabled={entregando} onClick={() => arquivo.current?.click()}><FileUp size={16} /> {entregando ? 'Lendo...' : 'Entregar documento'}</Button>
            {perm.administrador && <Button variant="secondary" onClick={() => setAjustes(true)}><Settings2 size={16} /> Ajustes</Button>}
            <Button disabled={buscando} onClick={() => setConfirmaBusca(true)}><RefreshCw size={16} /> {buscando ? 'Buscando...' : 'Buscar agora'}</Button>
          </>
        }
      />
      <input ref={arquivo} type="file" accept=".xml,.pdf" className="hidden" onChange={(e) => { const a = e.target.files?.[0]; if (a) entregar(a); e.target.value = ''; }} />

      {erroBusca && (
        <Aviso tipo="danger">
          A última busca falhou{execucao?.FIM ? ` (${formatarDataHora(execucao.FIM)})` : ''}: {erroBusca}. Se a caixa ainda não foi conectada, siga o guia conectar-gmail. Você pode testar o robô agora com “Entregar documento”.
        </Aviso>
      )}

      {erro ? (
        <Card><EstadoErro mensagem={erro} onRetry={carregar} /></Card>
      ) : carregando ? (
        <div className="flex flex-col gap-5"><SkeletonKpis count={5} /><SkeletonTable /></div>
      ) : (
        <>
          <div className="cascata grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5 mb-5">
            <Indicador rotulo="Lidos" valor={String(kpis?.LIDOS ?? 0)} detalhe={kpis?.ULTIMA_BUSCA ? `Última busca: ${formatarDataHora(kpis.ULTIMA_BUSCA)}` : 'Nenhuma busca ainda'} icone={<Inbox size={16} />} cor="var(--fg-muted)" />
            <Indicador rotulo="Prontos para conferência" valor={String(kpis?.PRONTOS ?? 0)} icone={<Check size={16} />} cor="var(--success)" />
            <Indicador rotulo="Para aprovação" valor={String(kpis?.APROVACAO ?? 0)} icone={<ShieldCheck size={16} />} cor="var(--warning)" />
            <Indicador rotulo="Revisão de leitura" valor={String(kpis?.REVISAO ?? 0)} icone={<TriangleAlert size={16} />} cor="var(--danger)" />
            <Indicador rotulo="Confiança média" valor={`${kpis?.CONFIANCA_MEDIA ?? 0}%`} detalhe={`Corte em vigor: ${corte}%`} icone={<Gauge size={16} />} cor="var(--info)" />
          </div>

          <Card>
            {linhas.length === 0 ? (
              <EstadoVazio icone={<Inbox size={20} />} titulo="Nenhum documento lido ainda" descricao="Clique em Buscar agora, ou entregue um XML ou PDF para ver o robô decidir sem depender da caixa." acao={<Button variant="secondary" onClick={() => arquivo.current?.click()}><FileUp size={16} /> Entregar documento</Button>} />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="tabela">
                    <thead><tr><th>Documento</th><th>Remetente</th><th>Recebido</th><th>Confiança</th><th>Desfecho</th></tr></thead>
                    <tbody>
                      {linhas.map((l) => {
                        const d = DESFECHOS[l.DECISAO] ?? { rotulo: l.DECISAO, variante: 'neutral' as const };
                        return (
                          <tr key={l.ID} className="cursor-pointer" onClick={() => setDetalheId(l.ID)}>
                            <td><div className="font-medium text-fg break-all">{l.NOME}</div><div className="text-[12px] text-fg-muted truncate max-w-[280px]">{l.ASSUNTO}</div></td>
                            <td className="max-w-[220px] truncate">{l.REMETENTE || '—'}</td>
                            <td className="tabular-nums whitespace-nowrap">{formatarDataHora(l.RECEBIDO_EM ?? l.CRIADO_EM)}</td>
                            <td><BarraConfianca confianca={Number(l.CONFIANCA)} corte={corte} /></td>
                            <td><Badge variant={d.variante}>{d.rotulo}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Paginacao pagina={pagina} total={total} porPagina={POR_PAGINA} onMudar={setPagina} />
              </>
            )}
          </Card>
        </>
      )}

      <ConfirmDialog isOpen={confirmaBusca} onClose={() => setConfirmaBusca(false)} onConfirm={buscarAgora} title="Buscar agora" confirmLabel="Buscar e processar" loading={buscando}
        message={`O robô lê a caixa de e-mail, classifica os documentos e confere o que passar pelo corte de ${corte}% e pela alçada. Nada é gravado no ERP.`} />
      {detalheId !== null && <DetalheAnexo id={detalheId} corte={corte} onFechar={() => setDetalheId(null)} onAbrirLancamento={(id) => nav(`/lancamentos/${id}`)} onAviso={addToast} />}
      {ajustes && <AjustesRobo config={config} onFechar={() => setAjustes(false)} onSalvo={() => { setAjustes(false); addToast('success', 'Ajustes salvos. Valem na próxima rodada.'); carregar(); }} />}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function DetalheAnexo({ id, corte, onFechar, onAbrirLancamento, onAviso }: { id: number; corte: number; onFechar: () => void; onAbrirLancamento: (id: number) => void; onAviso: (t: 'error' | 'success', m: string) => void }) {
  const [a, setA] = useState<Linha | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { umaLinha(SF.roboObterAnexo, { id }).then(setA).catch((e) => setErro(getMitraErrorMessage(e))); }, [id]);
  const criterios: Linha[] = a?.CRITERIOS ? (() => { try { return JSON.parse(a.CRITERIOS); } catch { return []; } })() : [];
  const campos: Linha = a?.CAMPOS ? (() => { try { return JSON.parse(a.CAMPOS); } catch { return {}; } })() : {};
  async function abrirArquivo() {
    try {
      const r = await execSF<{ ok: boolean; url?: string; erro?: string }>(SF.obterLinkArquivo, { origem: 'ANEXO_ROBO', id });
      if (r.ok && r.url) window.open(r.url, '_blank', 'noopener');
      else onAviso('error', r.erro ?? 'Arquivo indisponível.');
    } catch (e) { onAviso('error', getMitraErrorMessage(e)); }
  }
  return (
    <Modal isOpen onClose={onFechar} title={a?.NOME ?? 'Leitura'} size="lg">
      {erro && <Aviso tipo="danger">{erro}</Aviso>}
      {a && (
        <div className="flex flex-col gap-4">
          <div>
            <BarraConfianca confianca={Number(a.CONFIANCA)} corte={corte} />
            <p className="text-[13.5px] text-fg mt-2">{a.MOTIVO}</p>
            <p className="text-[12px] text-fg-muted mt-1">{a.REMETENTE} · {a.ASSUNTO}</p>
          </div>
          <div>
            <p className="text-[13px] font-medium text-fg-muted mb-2">Por que esta nota</p>
            <ul className="flex flex-col gap-2">
              {criterios.map((c) => (
                <li key={c.codigo} className="flex items-start gap-2">
                  {c.situacao === 'ok' ? <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} /> : c.situacao === 'parcial' ? <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} /> : <X size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] text-fg"><strong className="font-medium">{c.rotulo}</strong> <span className="text-fg-muted tabular-nums">{c.pontos} de {c.peso}</span></p>
                    <p className="text-[12.5px] text-fg-muted">{c.detalhe}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[13px]">
            <div><dt className="text-fg-muted text-[12px]">Fornecedor</dt><dd className="text-fg">{campos.fornecedor || '—'}</dd></div>
            <div><dt className="text-fg-muted text-[12px]">Empresa</dt><dd className="text-fg">{campos.empresa || '—'}</dd></div>
            <div><dt className="text-fg-muted text-[12px]">Número</dt><dd className="text-fg tabular-nums">{campos.numero || '—'}</dd></div>
            <div><dt className="text-fg-muted text-[12px]">Emissão</dt><dd className="text-fg tabular-nums">{formatarData(campos.dataEmissao)}</dd></div>
            <div><dt className="text-fg-muted text-[12px]">Vencimento</dt><dd className="text-fg tabular-nums">{formatarData(campos.dataVencimento)}</dd></div>
            <div><dt className="text-fg-muted text-[12px]">Valor</dt><dd className="text-fg tabular-nums">{formatarMoeda(campos.valorTotal)}</dd></div>
          </dl>
          <div className="flex flex-wrap justify-end gap-2">
            {a.ARQUIVO_URL && <Button variant="secondary" onClick={abrirArquivo}><ExternalLink size={16} /> Abrir arquivo</Button>}
            {a.LANCAMENTO_ID && <Button onClick={() => onAbrirLancamento(Number(a.LANCAMENTO_ID))}><Send size={16} /> Abrir lançamento</Button>}
          </div>
        </div>
      )}
    </Modal>
  );
}

function AjustesRobo({ config, onFechar, onSalvo }: { config: Record<string, string>; onFechar: () => void; onSalvo: () => void }) {
  const [corte, setCorte] = useState(config.CORTE_CONFIANCA ?? '');
  const [busca, setBusca] = useState(config.GMAIL_QUERY ?? '');
  const [max, setMax] = useState(config.MAX_MENSAGENS ?? '');
  const ehImap = config.INTEGRACAO === 'imap';
  const [palavras, setPalavras] = useState(config.IMAP_PALAVRAS ?? '');
  const [senha, setSenha] = useState('');
  const [senhaNotas, setSenhaNotas] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const corteOk = /^(100|[0-9]{1,2})$/.test(corte.trim());
  const maxOk = /^([1-9]|[1-4][0-9]|50)$/.test(max.trim());

  async function salvar() {
    if (!corteOk) { setErro('O corte precisa ser um número inteiro de 0 a 100.'); return; }
    if (!maxOk) { setErro('Mensagens por rodada: um número inteiro de 1 a 50.'); return; }
    if (ehImap ? !palavras.trim() : !busca.trim()) { setErro('Informe a busca na caixa.'); return; }
    setSalvando(true);
    setErro('');
    try {
      const semPermissao = 'Sem permissão ou valor inválido — nada foi alterado.';
      for (const [caixa, valor] of [['boletos', senha], ['notas', senhaNotas]]) {
        if (!valor) continue;
        // Vai como arquivo privado: o input de uma SF fica no log, e a senha nao pode ficar la.
        const nome = `caixa-${crypto.randomUUID()}.txt`;
        const up = await uploadFilePrivateMitra({ projectId: PROJECT_ID, file: new File([valor], nome, { type: 'text/plain' }) });
        const r = await execSF<Linha>(SF.roboImapGuardarSenha, { key: up.result.key, caixa });
        if (!r.ok) throw new Error(String(r.erro ?? 'Não consegui guardar a senha.'));
      }
      for (const [chave, valor] of [['CORTE_CONFIANCA', corte.trim()], ehImap ? ['IMAP_PALAVRAS', palavras.trim()] : ['GMAIL_QUERY', busca.trim()], ['MAX_MENSAGENS', max.trim()]]) {
        if (config[chave] === valor) continue;
        await exigirAfetou(SF.roboSalvarConfig, { chave, valor }, semPermissao);
      }
      onSalvo();
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal isOpen onClose={onFechar} title="Ajustes do robô">
      <div className="flex flex-col gap-4">
        {erro && <Aviso tipo="danger">{erro}</Aviso>}
        <div>
          <Input label="Corte de leitura (0 a 100)" inputMode="numeric" value={corte} onChange={(e) => setCorte(e.target.value)} error={corte && !corteOk ? 'Número inteiro de 0 a 100.' : undefined} />
          <p className="text-[12.5px] text-fg-muted mt-1.5">Nota mínima para o robô lançar no ERP sem ninguém conferir. Baixar o corte não “destrava” tudo: acima dele, o documento ainda passa pela alçada e por todas as guardas do envio.</p>
        </div>
        {ehImap ? (
          <>
            <Input label={`Senha da caixa ${config.IMAP_USUARIO ?? ''}`} type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <Input label={`Senha da caixa de notas ${config.IMAP_NOTAS_USUARIO ?? ''}`} type="password" autoComplete="new-password" value={senhaNotas} onChange={(e) => setSenhaNotas(e.target.value)} />
            <p className="text-[12.5px] text-fg-muted -mt-2.5">Deixe em branco para manter a atual. Fica guardada em arquivo privado do projeto e só é usada na leitura pedida por um administrador.</p>
            <div>
              <Input label="Palavras da busca (separadas por vírgula)" value={palavras} onChange={(e) => setPalavras(e.target.value)} />
              <p className="text-[12.5px] text-fg-muted mt-1.5">Caixa de boletos: lê os e-mails dos últimos 7 dias com PDF e alguma dessas palavras no assunto ou no nome do anexo. Caixa de notas: lê só o XML de NF-e, sem usar as palavras.</p>
            </div>
          </>
        ) : (
          <div>
          <Input label="Busca na caixa" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <p className="text-[12.5px] text-fg-muted mt-1.5">Mesma sintaxe da busca do Gmail. Ex.: <code>label:notas-fiscais has:attachment</code></p>
        </div>
        )}
        <Input label="Mensagens por rodada" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} error={max && !maxOk ? 'Número inteiro de 1 a 50.' : undefined} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
          <Button disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </div>
    </Modal>
  );
}
