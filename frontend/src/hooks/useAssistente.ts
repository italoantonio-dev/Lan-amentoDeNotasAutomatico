import { useCallback, useEffect, useRef, useState } from 'react';
import { getAgentTaskMitra } from 'mitra-interactions-sdk';
import { execSF, paraB64, PROJECT_ID, SF } from '../lib/api';
import { descreverAnexo, processarAnexo } from '../lib/anexos';
import type { AnexoPipeline } from '../lib/anexos';
import { atualizarMensagem, criarConversa, excluirConversa, listarAnexos, listarConversas, listarFerramentas, listarMensagens, resumoDaTranscricao, salvarMensagem } from '../lib/chatDb';
import { agenteDisponivel, lerConfigIA } from '../lib/configIA';
import { executarFerramenta, extrairBloco, formatarResultado, PREAMBULO, textoVisivel } from '../lib/ferramentas';
import { getMitraErrorMessage } from '../lib/utils';

type Linha = Record<string, any>;
export interface Mensagem { id: number; autor: string; conteudo: string; sequencia: number }
export interface Chip { id: string; mensagemId: number; ferramenta: string; resultado: string; sucesso: boolean; duracaoMs: number }
export interface AnexoMsg { id: number; mensagemId: number; nome: string; status: string; lancamentoId: number }

const TETO_IDAS = 5;

export function useAssistente() {
  const [conversas, setConversas] = useState<Linha[]>([]);
  const [conversa, setConversa] = useState<Linha | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [anexosMsg, setAnexosMsg] = useState<AnexoMsg[]>([]);
  const [pendentes, setPendentes] = useState<AnexoPipeline[]>([]);
  const [rascunho, setRascunho] = useState('');
  const [estado, setEstado] = useState<'ocioso' | 'pensando' | 'executando' | 'erro'>('ocioso');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [arquivadas, setArquivadas] = useState(false);
  const disponivel = agenteDisponivel();

  const r = useRef({
    sessao: null as ReturnType<typeof getAgentTaskMitra> | null,
    sessaoConversaId: 0,
    desligar: [] as (() => void)[],
    conversa: null as Linha | null,
    sequencia: 0,
    acumulado: '',
    rascunhoId: 0,
    timer: 0 as unknown as ReturnType<typeof setTimeout>,
    gravando: Promise.resolve() as Promise<unknown>,
    idas: 0,
    mensagemUsuarioId: 0,
    transcricao: [] as { autor: string; conteudo: string }[],
    processarFim: async (_: string) => {},
  });

  const recarregarLista = useCallback(async () => {
    try { setConversas(await listarConversas(busca, arquivadas)); } catch (e) { setErro(getMitraErrorMessage(e)); }
  }, [busca, arquivadas]);

  const fecharSessao = useCallback(() => {
    r.current.desligar.forEach((d) => d());
    r.current.desligar = [];
    r.current.sessao?.close();
    r.current.sessao = null;
    r.current.sessaoConversaId = 0;
  }, []);

  const abrir = useCallback(async (c: Linha | null) => {
    fecharSessao();
    r.current.conversa = c;
    setConversa(c);
    setRascunho('');
    setPendentes([]);
    setErro('');
    setEstado('ocioso');
    if (!c) {
      setMensagens([]); setChips([]); setAnexosMsg([]);
      r.current.sequencia = 0; r.current.transcricao = [];
      return;
    }
    const [m, f, a] = await Promise.all([listarMensagens(c.ID), listarFerramentas(c.ID), listarAnexos(c.ID)]);
    const msgs = m.map((x) => ({ id: Number(x.ID), autor: String(x.AUTOR), conteudo: String(x.CONTEUDO ?? ''), sequencia: Number(x.SEQUENCIA) }));
    setMensagens(msgs);
    setChips(f.map((x) => {
      let resultado = '';
      try { resultado = JSON.parse(String(x.RESULTADO ?? '""')).resumo ?? ''; } catch { /* registro antigo */ }
      return { id: String(x.ID), mensagemId: Number(x.MENSAGEM_ID ?? 0), ferramenta: String(x.FERRAMENTA), resultado, sucesso: Number(x.SUCESSO) === 1, duracaoMs: Number(x.DURACAO_MS ?? 0) };
    }));
    setAnexosMsg(a.map((x) => ({ id: Number(x.ID), mensagemId: Number(x.MENSAGEM_ID ?? 0), nome: String(x.NOME), status: String(x.STATUS), lancamentoId: Number(x.LANCAMENTO_ID ?? 0) })));
    r.current.sequencia = msgs.reduce((s, x) => Math.max(s, x.sequencia), 0);
    r.current.transcricao = msgs.map((x) => ({ autor: x.autor, conteudo: x.conteudo }));
  }, [fecharSessao]);

  // Ao entrar, retoma a conversa mais recente: carregar a lista sem abrir nada parece historico perdido.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lista = await listarConversas('', false);
        if (!vivo) return;
        setConversas(lista);
        if (lista[0]) await abrir(lista[0]);
      } catch (e) {
        if (vivo) setErro(getMitraErrorMessage(e));
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; fecharSessao(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (!carregando) { const t = setTimeout(recarregarLista, 250); return () => clearTimeout(t); } return undefined; }, [busca, arquivadas, carregando, recarregarLista]);

  const garantirConversa = useCallback(async (titulo: string): Promise<Linha> => {
    if (r.current.conversa) return r.current.conversa;
    const cfg = await lerConfigIA();
    const c = await criarConversa(titulo.slice(0, 80) || 'Nova conversa', cfg.modelo);
    r.current.conversa = c;
    setConversa(c);
    return c;
  }, []);

  const garantirSessao = useCallback(async (c: Linha) => {
    if (r.current.sessao && r.current.sessaoConversaId === Number(c.ID)) return { sessao: r.current.sessao, nova: false };
    fecharSessao();
    const cfg = await lerConfigIA();
    // Espalhar condicional: connectionId vazio nao e o mesmo que omitir.
    const sessao = getAgentTaskMitra({ create: true, projectId: PROJECT_ID, ...(cfg.connectionId ? { connectionId: cfg.connectionId } : {}), ...(cfg.modelo ? { modelId: cfg.modelo } : {}) });
    r.current.sessao = sessao;
    r.current.sessaoConversaId = Number(c.ID);
    r.current.desligar = [
      sessao.on('delta', (ev) => {
        if (ev.kind !== 'text') return;
        r.current.acumulado += ev.delta;
        const visivel = textoVisivel(r.current.acumulado);
        setRascunho(visivel);
        // Checkpoint: fechar a aba durante o streaming nao apaga a resposta inteira.
        clearTimeout(r.current.timer);
        r.current.timer = setTimeout(() => {
          const atual = textoVisivel(r.current.acumulado);
          if (!atual) return;
          r.current.gravando = r.current.gravando.then(async () => {
            if (r.current.rascunhoId) await atualizarMensagem(r.current.rascunhoId, atual, 'PARCIAL');
            else r.current.rascunhoId = await salvarMensagem(Number(c.ID), 'ASSISTENTE', atual, ++r.current.sequencia, 'PARCIAL');
          }).catch(() => { /* o texto final regrava */ });
        }, 1200);
      }),
      sessao.on('turnEnd', (ev) => { r.current.processarFim(ev.content || r.current.acumulado); }),
      sessao.on('taskCreated', (ev) => { execSF(SF.chatVincularTask, { id: c.ID, taskId: ev.task.id }).catch(() => {}); }),
      sessao.on('error', (ev) => {
        setErro(typeof ev.error === 'string' ? ev.error : getMitraErrorMessage(ev.error));
        setEstado('erro');
        setRascunho('');
      }),
      sessao.on('cancelled', () => { setEstado('ocioso'); setRascunho(''); }),
    ];
    return { sessao, nova: true };
  }, [fecharSessao]);

  const mandarAoAgente = useCallback(async (c: Linha, corpo: string) => {
    const { sessao, nova } = await garantirSessao(c);
    r.current.acumulado = '';
    r.current.rascunhoId = 0;
    setEstado('pensando');
    let prompt = corpo;
    if (nova) {
      const historico = r.current.transcricao.slice(0, -1);
      const resumo = historico.length ? `\n\nEsta conversa já existia. Resumo do que foi dito:\n${resumoDaTranscricao(historico)}\n` : '';
      prompt = `${PREAMBULO}${resumo}\n\nMensagem do usuário:\n${corpo}`;
    }
    sessao.send(prompt);
  }, [garantirSessao]);

  r.current.processarFim = async (conteudo: string) => {
    const c = r.current.conversa;
    if (!c) return;
    clearTimeout(r.current.timer);
    await r.current.gravando.catch(() => {});
    const bloco = extrairBloco(conteudo);
    const visivel = textoVisivel(conteudo);
    // Promove a mesma linha; turno so de ferramenta descarta o rascunho.
    let idMsg = r.current.rascunhoId;
    if (visivel) {
      if (idMsg) await atualizarMensagem(idMsg, visivel, 'OK');
      else idMsg = await salvarMensagem(Number(c.ID), 'ASSISTENTE', visivel, ++r.current.sequencia, 'OK');
      setMensagens((m) => [...m, { id: idMsg, autor: 'ASSISTENTE', conteudo: visivel, sequencia: r.current.sequencia }]);
      r.current.transcricao.push({ autor: 'ASSISTENTE', conteudo: visivel });
    } else if (idMsg) {
      await atualizarMensagem(idMsg, '', 'DESCARTADA');
    }
    setRascunho('');
    r.current.rascunhoId = 0;

    if (!bloco) {
      setEstado('ocioso');
      execSF(SF.chatTocarConversa, { id: c.ID }).catch(() => {});
      recarregarLista();
      return;
    }
    r.current.idas += 1;
    if (r.current.idas > TETO_IDAS) {
      const aviso = 'Parei aqui: foram muitas consultas para uma pergunta só. Refine o pedido e eu continuo.';
      const id = await salvarMensagem(Number(c.ID), 'ASSISTENTE', aviso, ++r.current.sequencia, 'OK');
      setMensagens((m) => [...m, { id, autor: 'ASSISTENTE', conteudo: aviso, sequencia: r.current.sequencia }]);
      setEstado('ocioso');
      return;
    }
    setEstado('executando');
    const inicio = Date.now();
    let dados: unknown;
    let sucesso = false;
    let resumo = '';
    try {
      ({ dados, sucesso, resumo } = await executarFerramenta(bloco, Number(c.ID)));
    } catch (e) {
      dados = { erro: getMitraErrorMessage(e) };
      resumo = getMitraErrorMessage(e);
    }
    const duracaoMs = Date.now() - inicio;
    const mensagemId = r.current.mensagemUsuarioId;
    setChips((l) => [...l, { id: `${Date.now()}`, mensagemId, ferramenta: bloco.nome, resultado: resumo, sucesso, duracaoMs }]);
    execSF(SF.chatRegistrarFerramenta, { conversaId: c.ID, mensagemId, ferramenta: bloco.nome, argumentos: paraB64(JSON.stringify(bloco.args)), resultado: paraB64(JSON.stringify({ resumo, dados })), sucesso: sucesso ? 1 : 0, duracaoMs }).catch(() => {});
    await mandarAoAgente(c, formatarResultado(bloco.nome, dados, sucesso));
  };

  const anexar = useCallback(async (arquivos: File[]) => {
    setErro('');
    try {
      const c = await garantirConversa(arquivos[0]?.name ?? 'Documento');
      for (const arquivo of arquivos) {
        await processarAnexo(arquivo, Number(c.ID), (a) => {
          setPendentes((lista) => {
            const i = lista.findIndex((x) => x.chave === a.chave);
            if (i < 0) return [...lista, a];
            const nova = [...lista];
            nova[i] = a;
            return nova;
          });
        });
      }
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    }
  }, [garantirConversa]);

  const removerPendente = (chave: string) => setPendentes((l) => l.filter((a) => a.chave !== chave));

  const enviar = useCallback(async (texto: string) => {
    const prontos = pendentes.filter((a) => a.status !== 'LENDO' && a.status !== 'ERRO');
    const corpo = texto.trim() || (prontos.length ? `Enviei o documento ${prontos.map((a) => a.nome).join(', ')}.` : '');
    if (!corpo) return;
    setErro('');
    try {
      const c = await garantirConversa(corpo);
      const seq = ++r.current.sequencia;
      const id = await salvarMensagem(Number(c.ID), 'USUARIO', corpo, seq, 'OK');
      r.current.mensagemUsuarioId = id;
      r.current.idas = 0;
      r.current.transcricao.push({ autor: 'USUARIO', conteudo: corpo });
      setMensagens((m) => [...m, { id, autor: 'USUARIO', conteudo: corpo, sequencia: seq }]);
      for (const a of prontos) {
        if (a.id) await execSF(SF.chatVincularAnexoMensagem, { id: a.id, mensagemId: id });
      }
      setAnexosMsg((l) => [...l, ...prontos.map((a) => ({ id: a.id ?? 0, mensagemId: id, nome: a.nome, status: a.status, lancamentoId: a.lancamentoId ?? 0 }))]);
      setPendentes([]);
      if (!disponivel) {
        setErro('A IA só responde na aplicação publicada. Sua mensagem foi gravada na conversa.');
        recarregarLista();
        return;
      }
      await mandarAoAgente(c, [corpo, ...prontos.map(descreverAnexo)].join('\n\n'));
      recarregarLista();
    } catch (e) {
      setErro(getMitraErrorMessage(e));
      setEstado('erro');
    }
  }, [pendentes, garantirConversa, disponivel, mandarAoAgente, recarregarLista]);

  const parar = useCallback(() => { r.current.sessao?.cancel().catch(() => {}); setEstado('ocioso'); }, []);

  const renomear = useCallback(async (id: number, titulo: string) => {
    await execSF(SF.chatRenomearConversa, { id, titulo });
    if (r.current.conversa?.ID === id) setConversa({ ...r.current.conversa, TITULO: titulo });
    recarregarLista();
  }, [recarregarLista]);
  const arquivar = useCallback(async (id: number, arquivada: boolean) => {
    await execSF(SF.chatArquivarConversa, { id, arquivada: arquivada ? 1 : 0 });
    if (r.current.conversa?.ID === id) await abrir(null);
    recarregarLista();
  }, [abrir, recarregarLista]);
  const excluir = useCallback(async (id: number) => {
    await excluirConversa(id);
    if (r.current.conversa?.ID === id) await abrir(null);
    recarregarLista();
  }, [abrir, recarregarLista]);

  return { conversas, conversa, mensagens, chips, anexosMsg, pendentes, rascunho, estado, erro, carregando, busca, setBusca, arquivadas, setArquivadas, disponivel, abrir, enviar, parar, anexar, removerPendente, renomear, arquivar, excluir, limparErro: () => setErro('') };
}
