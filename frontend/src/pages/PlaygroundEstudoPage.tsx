import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAgentTaskMitra } from 'mitra-interactions-sdk';
import { ArrowLeft, Check, Copy, History, Link2, Loader2, Send, Square, Unlink } from 'lucide-react';
import { callSF, execSF, paraB64, PROJECT_ID, SF, umaLinha } from '../lib/api';
import { agenteDisponivel, lerConfigIA } from '../lib/configIA';
import { formatarDataHora } from '../lib/formato';
import { getMitraErrorMessage } from '../lib/utils';
import { useToast } from '../hooks/useToast';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { ToastContainer } from '../components/ui/Toast';
import Robo from '../components/Robo';
import TextoRobo from '../components/TextoRobo';
import { Aviso, EstadoErro } from '../components/Comum';

type Linha = Record<string, any>;
interface Segmento { tipo: 'usuario' | 'fala' | 'passo'; texto: string; contador?: number; ativo?: boolean }

const SUGESTOES = [
  'Onde está concentrado o gasto por fornecedor neste ano?',
  'Quanto vence nas próximas semanas, por empresa?',
  'Quais lançamentos demoram mais entre a entrada e o envio ao ERP?',
];

// O contexto vai inteiro na primeira mensagem: sem isso a analista passa minutos se localizando.
// Os ids vem do mapa SF, nunca escritos no texto. Quantidades e nomes ela descobre consultando.
function contexto(e: Linha): string {
  return `Você é a analista de dados deste sistema de contas a pagar. Responda em português do Brasil.

ESTUDO
playgroundId: ${e.ID}
chave: ${e.CHAVE_IA}

COMO INVESTIGAR
- Consulte a base com a ferramenta runQuery (somente SELECT). Comece cada SQL com um comentário curto em português dizendo o que está olhando: /* titulo: Concentração de gastos por fornecedor */. Se o comentário for recusado, envie sem ele.
- Antes de cada consulta, escreva uma frase dizendo o que vai olhar. Não repita consultas iguais.
- Para ver as colunas, chame executeServerFunction da função ${SF.schema_resumo} (schema_resumo, sem parâmetros).
- Nomes de tabela e coluna são MAIÚSCULOS. Nunca invente número: todo valor da análise sai de uma consulta.

A BASE
- LANCAMENTOS: DOCUMENTO_ID, EMPRESA_ID, CNPJ_FORNECEDOR, NOME_FORNECEDOR, NUMERO_DOC, DATA_EMISSAO, DATA_VENCIMENTO, VALOR_TOTAL, TOP_ID, NATUREZA_ID, CENTRO_ID, CONTA_ID, ORIGEM_CLASSIFICACAO, STATUS_ID, CRIADO_EM.
- DOCUMENTOS (TIPO_DOCUMENTO_ID), TIPOS_DOCUMENTO, EMPRESAS (CODEMP, NOME), STATUS_LANCAMENTO (CODIGO, DESCRICAO), TOPS, NATUREZAS (CODNAT, DESCRICAO), CENTROS_RESULTADO, CONTAS_BANCARIAS, LANCAMENTO_ITENS, APROVACOES, LOG_EXECUCAO, ERP_ENVIO, ROBO_ANEXO, ROBO_EMAIL, ROBO_EXECUCAO.
- Datas são texto: AAAA-MM-DD; carimbos AAAA-MM-DDTHH:MM:SS. Filtre por SUBSTRING ou comparação de texto.
- Situações (STATUS_LANCAMENTO.CODIGO): AGUARDANDO_APROVACAO exige decisão; APROVADO pode ir ao ERP; LANCADO está no ERP; REJEITADO não segue; ERRO foi recusado pelo ERP; REVISAO_LEITURA espera conferência.

COMO ENTREGAR
- Grave a tela chamando executeServerFunction da função ${SF.playground_salvar_html} (playground_salvar_html) com input { "playgroundId": ${e.ID}, "chave": "${e.CHAVE_IA}", "html": "<HTML completo>" }.
- Ao terminar, dê ao estudo o título da análise: função ${SF.playground_renomear} (playground_renomear) com input { "playgroundId": ${e.ID}, "chave": "${e.CHAVE_IA}", "nome": "..." }.
- Nesta conversa você só lê e desenha: não lance, não aprove, não envie ao ERP, não chame outras funções.

COMO DESENHAR
- HTML completo e autônomo: roda em iframe com sandbox vazio. Sem script e sem CDN. Gráficos são SVG desenhado com os valores reais, com rótulos e legenda em texto.
- Interface clara e sóbria (Linear + Stripe): fundo #f8fafc, cartões #ffffff com borda #e2e8f0 e raio 12px, texto #0f172a, texto secundário #64748b, ação #2E3C50, verde #2F8F3F, âmbar #d97706, vermelho #dc2626, fonte system-ui. Números alinhados à direita. Faixa de indicadores, um gráfico principal e uma tabela de detalhe.
- Português com acentuação correta, valores em R$. Diga no rodapé o período e o que a análise considerou.`;
}

function descreverPasso(tool: string, input: string): string {
  const entrada = input ?? '';
  if (/runQuery/i.test(tool)) {
    const t = /titulo:\s*([^*"\\]{3,120})/i.exec(entrada);
    if (t) return t[1].trim();
    const tab = /FROM\s+([A-Z_]{3,})/i.exec(entrada);
    return tab ? `Consultando ${tab[1].toUpperCase()}` : 'Consultando a base';
  }
  if (/executeServerFunction/i.test(tool)) {
    // O input chega truncado: casa o id ou o nome por texto, sem exigir JSON valido.
    const id = /(?:serverFunctionId|functionId)["\\:\s]*"?(\d+)/i.exec(entrada)?.[1];
    if (Number(id) === SF.playground_salvar_html || /playground_salvar_html/.test(entrada)) return 'Desenhando a análise';
    if (Number(id) === SF.playground_renomear || /playground_renomear/.test(entrada)) return 'Dando título ao estudo';
    if (Number(id) === SF.schema_resumo || /schema_resumo/.test(entrada)) return 'Lendo a estrutura da base';
    return 'Executando uma função';
  }
  if (/getProjectContext/i.test(tool)) return 'Entendendo o sistema';
  return 'Trabalhando nos dados';
}

export default function PlaygroundEstudoPage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const { toasts, addToast, removeToast } = useToast();
  const [estudo, setEstudo] = useState<Linha | null>(null);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [erroIA, setErroIA] = useState('');
  const [semConexao, setSemConexao] = useState(false);
  const [texto, setTexto] = useState('');
  const [trabalhando, setTrabalhando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [atualizadoEm, setAtualizadoEm] = useState('');
  const [versoes, setVersoes] = useState<Linha[] | null>(null);
  const [compartilhar, setCompartilhar] = useState(false);
  const disponivel = agenteDisponivel();
  const sessao = useRef<ReturnType<typeof getAgentTaskMitra> | null>(null);
  const segRef = useRef<Segmento[]>([]);
  const fim = useRef<HTMLDivElement>(null);
  const estudoRef = useRef<Linha | null>(null);

  const atualizarSeg = (fn: (s: Segmento[]) => Segmento[]) => { segRef.current = fn(segRef.current); setSegmentos(segRef.current); };

  const recarregarEstudo = useCallback(async () => {
    const e = await umaLinha(SF.playground_get, { id });
    setEstudo(e);
    estudoRef.current = e;
    return e;
  }, [id]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const e = await recarregarEstudo();
        if (!vivo) return;
        if (e?.CONVERSA) {
          try {
            const salvo = JSON.parse(String(e.CONVERSA)) as Segmento[];
            segRef.current = salvo.map((s) => ({ ...s, ativo: false }));
            setSegmentos(segRef.current);
          } catch { /* conversa ilegivel nao impede abrir o estudo */ }
        }
      } catch (err) {
        if (vivo) setErro(getMitraErrorMessage(err));
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; sessao.current?.close(); };
  }, [recarregarEstudo]);

  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [segmentos]);
  useEffect(() => {
    if (!trabalhando) { setSegundos(0); return undefined; }
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [trabalhando]);

  const guardarConversa = useCallback(() => {
    execSF(SF.playground_salvar_conversa, { id, conversa: paraB64(JSON.stringify(segRef.current.map(({ ativo: _a, ...r }) => r))) }).catch(() => {});
  }, [id]);

  const abrirSessao = useCallback(async (e: Linha) => {
    if (sessao.current) return { s: sessao.current, nova: false };
    const cfg = await lerConfigIA();
    const s = e.TASK_ID
      ? getAgentTaskMitra({ taskId: String(e.TASK_ID), projectId: PROJECT_ID })
      : getAgentTaskMitra({ create: true, projectId: PROJECT_ID, ...(cfg.connectionId ? { connectionId: cfg.connectionId } : {}), ...(cfg.modelo ? { modelId: cfg.modelo } : {}) });
    s.on('delta', (ev) => {
      if (ev.kind !== 'text' || !ev.delta) return;
      atualizarSeg((l) => {
        const ultimo = l[l.length - 1];
        const fechados = l.map((x) => (x.tipo === 'passo' ? { ...x, ativo: false } : x));
        if (ultimo?.tipo === 'fala') return [...fechados.slice(0, -1), { ...ultimo, texto: ultimo.texto + ev.delta }];
        return [...fechados, { tipo: 'fala', texto: ev.delta }];
      });
    });
    s.on('tool', (ev) => {
      const rotulo = descreverPasso(ev.tool, ev.input ?? '');
      // Chamadas repetidas viram contador, nao linhas empilhadas. A frase que anuncia vem antes.
      atualizarSeg((l) => {
        const ultimo = l[l.length - 1];
        if (ultimo?.tipo === 'passo' && ultimo.texto === rotulo) return [...l.slice(0, -1), { ...ultimo, contador: (ultimo.contador ?? 1) + 1, ativo: true }];
        return [...l.map((x) => (x.tipo === 'passo' ? { ...x, ativo: false } : x)), { tipo: 'passo', texto: rotulo, contador: 1, ativo: true }];
      });
      if (rotulo === 'Desenhando a análise' && ev.content) recarregarEstudo().then(() => setAtualizadoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))).catch(() => {});
    });
    s.on('taskCreated', (ev) => { execSF(SF.playground_set_task, { id, taskId: ev.task.id }).catch(() => {}); });
    s.on('turnEnd', async () => {
      atualizarSeg((l) => l.map((x) => (x.tipo === 'passo' ? { ...x, ativo: false } : x)));
      setTrabalhando(false);
      guardarConversa();
      try {
        const antes = estudoRef.current?.HTML;
        const novo = await recarregarEstudo();
        if (novo?.HTML !== antes) setAtualizadoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      } catch { /* a conversa ja esta na tela */ }
    });
    s.on('error', (ev) => {
      const m = typeof ev.error === 'string' ? ev.error : getMitraErrorMessage(ev.error);
      if (/credent|api key|n[aã]o conectad|connection|subscription/i.test(m)) setSemConexao(true);
      else setErroIA(m);
      setTrabalhando(false);
      guardarConversa();
    });
    sessao.current = s;
    return { s, nova: !e.TASK_ID };
  }, [id, recarregarEstudo, guardarConversa]);

  async function perguntar(pergunta: string) {
    const q = pergunta.trim();
    if (!q || trabalhando || !estudo) return;
    setTexto('');
    setErroIA('');
    setSemConexao(false);
    atualizarSeg((l) => [...l, { tipo: 'usuario', texto: q }]);
    setTrabalhando(true);
    try {
      const { s, nova } = await abrirSessao(estudo);
      s.send(nova ? `${contexto(estudo)}\n\nPERGUNTA\n${q}` : q);
      guardarConversa();
    } catch (e) {
      setErroIA(getMitraErrorMessage(e));
      setTrabalhando(false);
    }
  }

  async function abrirVersoes() {
    try { setVersoes(await callSF(SF.playground_versoes, { id })); } catch (e) { addToast('error', getMitraErrorMessage(e)); }
  }
  async function restaurar(versaoId: number) {
    try {
      await execSF(SF.playground_versionar_atual, { id });
      await execSF(SF.playground_restaurar, { id, versaoId });
      await recarregarEstudo();
      setVersoes(null);
      addToast('success', 'Versão restaurada. A tela anterior ficou no histórico.');
    } catch (e) { addToast('error', getMitraErrorMessage(e)); }
  }
  async function ligarLink() {
    try {
      await execSF(SF.playground_compartilhar, { id });
      await recarregarEstudo();
      setCompartilhar(true);
    } catch (e) { addToast('error', getMitraErrorMessage(e)); }
  }
  async function desligarLink() {
    try {
      await execSF(SF.playground_descompartilhar, { id });
      await recarregarEstudo();
      setCompartilhar(false);
      addToast('success', 'Link desligado: quem tinha o endereço perde o acesso.');
    } catch (e) { addToast('error', getMitraErrorMessage(e)); }
  }

  if (carregando) return <div className="p-4 md:p-8 flex flex-col gap-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-96 w-full" /></div>;
  if (erro) return <div className="p-8"><EstadoErro mensagem={erro} /></div>;
  if (!estudo) return <div className="p-8"><EstadoErro mensagem="Estudo não encontrado." /></div>;
  const link = estudo.SHARE_TOKEN ? `${window.location.origin}/estudo/${estudo.SHARE_TOKEN}` : '';

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] lg:h-screen min-[1100px]:overflow-hidden">
      <header className="h-14 shrink-0 flex items-center gap-2 px-4 border-b border-border bg-surface">
        <Link to="/playground" aria-label="Voltar para os estudos" className="p-1.5 rounded-lg text-fg-muted hover:bg-surface-hover"><ArrowLeft size={16} /></Link>
        <h1 className="text-[14px] font-medium text-fg truncate flex-1">{estudo.NOME}</h1>
        <Button size="sm" variant="ghost" onClick={abrirVersoes}><History size={16} /> Versões</Button>
        <Button size="sm" variant="secondary" disabled={!estudo.HTML} onClick={ligarLink}><Link2 size={16} /> Compartilhar</Button>
      </header>
      <div className="flex-1 min-h-0 flex flex-col min-[1100px]:flex-row">
        <section className="flex-1 min-w-0 min-h-[420px] flex flex-col bg-bg">
          <div className="h-8 shrink-0 flex items-center px-4 text-[12px] text-fg-muted border-b border-border-subtle">
            {trabalhando ? 'Analisando os dados' : atualizadoEm ? `Atualizado às ${atualizadoEm}` : estudo.HTML ? `Atualizado ${formatarDataHora(estudo.ATUALIZADO_EM)}` : 'A análise aparece aqui'}
          </div>
          {estudo.HTML ? (
            <iframe title={estudo.NOME} sandbox="" srcDoc={String(estudo.HTML)} className="flex-1 w-full border-0 bg-surface" />
          ) : (
            <div className="flex-1 p-6 flex flex-col gap-5 overflow-hidden" aria-hidden>
              <div className="grid grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className={`h-20 rounded-xl border border-border bg-surface ${trabalhando ? 'skeleton' : ''}`} />)}</div>
              <div className={`h-56 rounded-xl border border-border bg-surface ${trabalhando ? 'skeleton' : ''}`} />
              <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className={`h-8 rounded-lg border border-border-subtle bg-surface ${trabalhando ? 'skeleton' : ''}`} />)}</div>
            </div>
          )}
        </section>

        <aside className="w-full min-[1100px]:w-[400px] shrink-0 flex flex-col min-h-[420px] border-t min-[1100px]:border-t-0 min-[1100px]:border-l border-border bg-surface">
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 conversa-fundo">
            {!disponivel && <Aviso tipo="info">A IA só responde na aplicação publicada. Você continua abrindo e relendo este estudo.</Aviso>}
            {semConexao && (
              <div className="cartao p-4 flex flex-col gap-2">
                <p className="text-[14px] font-medium text-fg">Conecte a IA para continuar</p>
                <p className="text-[13px] text-fg-muted">Crie a connection nas configurações da plataforma, aba AI, e cole o identificador na engrenagem do <Link to="/assistente" className="underline">Assistente</Link>. Sem ela, cada usuário precisa da própria credencial.</p>
              </div>
            )}
            {erroIA && <Aviso tipo="danger">{erroIA}</Aviso>}
            {segmentos.length === 0 && disponivel && !semConexao && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2"><Robo tamanho={26} /><p className="text-[13.5px] text-fg">O que você quer saber?</p></div>
                {SUGESTOES.map((s) => <button key={s} className="cartao cartao-vivo text-left px-3 py-2.5 text-[13px] text-fg" onClick={() => perguntar(s)}>{s}</button>)}
              </div>
            )}
            {segmentos.map((s, i) => {
              if (s.tipo === 'usuario') return <div key={i} className="bolha-usuario self-end max-w-[90%] rounded-2xl px-3.5 py-2 text-[13.5px]">{s.texto}</div>;
              if (s.tipo === 'fala') return <div key={i} className="bolha-robo self-start max-w-[95%] rounded-2xl px-3.5 py-2"><TextoRobo texto={s.texto} /></div>;
              return (
                <div key={i} className="flex items-center gap-2 text-[12.5px] text-fg-muted pl-1">
                  {s.ativo ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} style={{ color: 'var(--success)' }} />}
                  <span>{s.texto}</span>
                  {(s.contador ?? 1) > 1 && <span className={`tabular-nums ${s.ativo ? 'animate-pulse' : ''}`}>×{s.contador}</span>}
                </div>
              );
            })}
            {trabalhando && segundos >= 3 && <p className="text-[12px] text-fg-muted tabular-nums pl-1">{segundos}s</p>}
            <div ref={fim} />
          </div>
          <div className="shrink-0 border-t border-border px-3 py-3 flex gap-2">
            <input className="controle h-10 flex-1" aria-label="Sua pergunta" placeholder="Pergunte ou peça um ajuste" disabled={!disponivel} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') perguntar(texto); }} />
            {trabalhando
              ? <Button variant="secondary" aria-label="Parar" onClick={() => { sessao.current?.cancel().catch(() => {}); setTrabalhando(false); }}><Square size={16} /></Button>
              : <Button aria-label="Enviar" disabled={!disponivel || !texto.trim()} onClick={() => perguntar(texto)}><Send size={16} /></Button>}
          </div>
        </aside>
      </div>

      <Modal isOpen={versoes !== null} onClose={() => setVersoes(null)} title="Versões do estudo">
        {versoes?.length === 0 && <p className="text-[13px] text-fg-muted">Ainda não há versão anterior: ela aparece quando a analista redesenha a tela.</p>}
        <ul className="flex flex-col gap-2">
          {(versoes ?? []).map((v) => (
            <li key={v.ID} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span className="text-[13px] text-fg">{formatarDataHora(v.CRIADO_EM)}</span>
              <Button size="sm" variant="secondary" onClick={() => restaurar(v.ID)}>Restaurar</Button>
            </li>
          ))}
        </ul>
      </Modal>
      <Modal isOpen={compartilhar} onClose={() => setCompartilhar(false)} title="Compartilhar estudo">
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-fg-muted">Quem tiver este endereço vê a análise sem login, somente leitura. Só compartilhe o que pode sair daqui: a análise pode conter valores e nomes de fornecedores.</p>
          <div className="flex gap-2">
            <input readOnly aria-label="Link do estudo" className="controle h-10 flex-1" value={link} />
            <Button variant="secondary" aria-label="Copiar link" onClick={() => { navigator.clipboard.writeText(link); addToast('success', 'Link copiado.'); }}><Copy size={16} /></Button>
          </div>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={desligarLink}><Unlink size={16} /> Desligar link</Button>
            <Button onClick={() => setCompartilhar(false)}>Fechar</Button>
          </div>
        </div>
      </Modal>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
