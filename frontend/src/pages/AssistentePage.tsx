import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, Check, CircleSlash, FileText, Paperclip, Pencil, Plus, Search, Send, Settings, Square, Trash2, X } from 'lucide-react';
import { execSF, SF } from '../lib/api';
import { lerConfigIA, listarModelos, salvarConfigIA } from '../lib/configIA';
import type { OpcaoModelo } from '../lib/configIA';
import { ROTULOS } from '../lib/ferramentas';
import { getMitraErrorMessage } from '../lib/utils';
import { useAssistente } from '../hooks/useAssistente';
import { useToast } from '../hooks/useToast';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import { ToastContainer } from '../components/ui/Toast';
import Robo from '../components/Robo';
import TextoRobo from '../components/TextoRobo';
import { Aviso } from '../components/Comum';

const SUGESTOES = [
  'Quais lançamentos estão aguardando a minha aprovação?',
  'Resuma o estado de hoje: pendências, lançados e erros.',
  'Mostre os lançamentos com erro e explique o motivo.',
  'Busque este fornecedor no ERP: ',
];

export default function AssistentePage() {
  const a = useAssistente();
  const { toasts, addToast, removeToast } = useToast();
  const [texto, setTexto] = useState('');
  const [arrastando, setArrastando] = useState(false);
  const [engrenagem, setEngrenagem] = useState(false);
  const [renomeando, setRenomeando] = useState<{ id: number; titulo: string } | null>(null);
  const [excluindo, setExcluindo] = useState<number | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const lendo = a.pendentes.some((p) => p.status === 'LENDO');
  const ocupado = a.estado === 'pensando' || a.estado === 'executando';

  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [a.mensagens.length, a.rascunho, a.estado, a.chips.length]);
  useEffect(() => {
    const c = campo.current;
    if (!c) return;
    c.style.height = 'auto';
    c.style.height = `${Math.min(c.scrollHeight, 10 * 22 + 16)}px`;
  }, [texto]);

  // Enviar enquanto um anexo e lido faria a IA pedir dados que o sistema teria em um segundo.
  const podeEnviar = !lendo && !ocupado && (texto.trim() || a.pendentes.some((p) => p.status !== 'ERRO'));
  const enviar = () => { if (podeEnviar) { a.enviar(texto); setTexto(''); } };

  async function abrirArquivoAnexo(id: number) {
    try {
      const r = await execSF<{ ok: boolean; url?: string; erro?: string }>(SF.obterLinkArquivo, { origem: 'ANEXO_CHAT', id });
      if (r.ok && r.url) window.open(r.url, '_blank', 'noopener');
      else addToast('error', r.erro ?? 'Arquivo indisponível.');
    } catch (e) { addToast('error', getMitraErrorMessage(e)); }
  }

  const estadoRobo = a.estado === 'erro' ? 'erro' : a.estado === 'executando' ? 'executando' : a.estado === 'pensando' ? 'pensando' : a.conversa ? 'feliz' : 'ocioso';

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-screen">
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-border bg-surface">
        <div className="p-3 flex flex-col gap-2 border-b border-border-subtle">
          <Button onClick={() => { a.abrir(null); setTexto(''); }}><Plus size={16} /> Nova conversa</Button>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-fg-subtle" />
            <input className="controle controle-com-icone h-10 w-full" aria-label="Buscar conversa" placeholder="Buscar" value={a.busca} onChange={(e) => a.setBusca(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
          {a.conversas.length === 0 && <p className="text-[12.5px] text-fg-muted p-3">{a.arquivadas ? 'Nenhuma conversa arquivada.' : 'Nenhuma conversa ainda.'}</p>}
          {a.conversas.map((c) => {
            const ativa = a.conversa?.ID === c.ID;
            return (
              <div key={c.ID} className={`group rounded-lg px-3 py-2 cursor-pointer transition-colors ${ativa ? 'bg-brand-soft' : 'hover:bg-surface-hover'}`} onClick={() => a.abrir(c)}>
                <div className="text-[13.5px] text-fg truncate">{c.TITULO || 'Sem título'}</div>
                <div className="flex items-center justify-between gap-1 h-6">
                  <span className="text-[12px] text-fg-muted tabular-nums">{Number(c.TOTAL_MENSAGENS)} mensagens</span>
                  <span className="hidden group-hover:flex gap-0.5">
                    <button aria-label="Renomear" className="p-1 rounded hover:bg-surface-active text-fg-muted" onClick={(e) => { e.stopPropagation(); setRenomeando({ id: c.ID, titulo: c.TITULO ?? '' }); }}><Pencil size={14} /></button>
                    <button aria-label={a.arquivadas ? 'Desarquivar' : 'Arquivar'} className="p-1 rounded hover:bg-surface-active text-fg-muted" onClick={(e) => { e.stopPropagation(); a.arquivar(c.ID, !a.arquivadas); }}>{a.arquivadas ? <ArchiveRestore size={14} /> : <Archive size={14} />}</button>
                    <button aria-label="Excluir" className="p-1 rounded hover:bg-surface-active text-fg-muted" onClick={(e) => { e.stopPropagation(); setExcluindo(c.ID); }}><Trash2 size={14} /></button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <button className="p-3 text-[12.5px] text-fg-muted hover:text-fg border-t border-border-subtle text-left" onClick={() => a.setArquivadas(!a.arquivadas)}>
          {a.arquivadas ? 'Voltar às conversas' : 'Ver arquivadas'}
        </button>
      </aside>

      <section className="flex-1 min-w-0 flex flex-col"
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); const l = [...e.dataTransfer.files]; if (l.length) a.anexar(l); }}>
        <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-border bg-surface">
          <Robo estado={estadoRobo} tamanho={30} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[14px] font-medium text-fg truncate">{a.conversa?.TITULO ?? 'Assistente'}</h1>
            <p className="text-[12px] text-fg-muted">{a.estado === 'pensando' ? 'Pensando...' : a.estado === 'executando' ? 'Consultando o sistema...' : 'Consulta, lança e aprova com as mesmas regras das telas'}</p>
          </div>
          <Button variant="ghost" aria-label="Configurar a IA" onClick={() => setEngrenagem(true)}><Settings size={16} /></Button>
        </header>

        <div className={`flex-1 overflow-y-auto conversa-fundo px-4 py-5 ${arrastando ? 'outline-2 outline-dashed -outline-offset-8' : ''}`} style={arrastando ? { outlineColor: 'var(--color-primary-light)' } : undefined}>
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {!a.disponivel && (
              <Aviso tipo="info">
                A IA só responde na aplicação publicada: fora dela, a plataforma não abre a conexão com o agente. Você continua abrindo e relendo todas as conversas gravadas.
              </Aviso>
            )}
            {a.erro && <Aviso tipo="danger" acao={<Button size="sm" variant="ghost" onClick={a.limparErro}>Fechar</Button>}>{a.erro}</Aviso>}

            {!a.carregando && a.mensagens.length === 0 && !a.rascunho && (
              <div className="flex flex-col items-center text-center py-10 gap-4">
                <Robo tamanho={56} />
                <div>
                  <p className="text-[15px] font-medium text-fg">Como posso ajudar?</p>
                  <p className="text-[13px] text-fg-muted mt-1">Pergunte sobre os lançamentos ou arraste uma nota para esta área.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                  {SUGESTOES.map((s) => (
                    <button key={s} className="cartao cartao-vivo text-left px-4 py-3 text-[13px] text-fg" onClick={() => { setTexto(s); campo.current?.focus(); }}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {a.mensagens.map((m) => {
              const usuario = m.autor === 'USUARIO';
              const anexos = a.anexosMsg.filter((x) => x.mensagemId === m.id);
              const fer = a.chips.filter((c) => c.mensagemId === m.id);
              return (
                <div key={m.id} className="flex flex-col gap-2">
                  <div className={`flex gap-2.5 ${usuario ? 'justify-end' : 'justify-start'}`}>
                    {!usuario && <span className="shrink-0 mt-0.5"><Robo tamanho={26} /></span>}
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${usuario ? 'bolha-usuario' : 'bolha-robo'}`}>
                      {usuario ? <span className="text-[14px]">{m.conteudo}</span> : <TextoRobo texto={m.conteudo} />}
                      {anexos.map((x) => (
                        <button key={x.id} onClick={() => abrirArquivoAnexo(x.id)} className="flex items-center gap-2 mt-2 rounded-lg px-2.5 py-1.5 text-[12.5px] w-full text-left" style={{ backgroundColor: 'color-mix(in srgb, white 14%, transparent)' }}>
                          <FileText size={14} /> <span className="underline truncate flex-1">{x.nome}</span>
                          <span className="opacity-80 shrink-0">{x.status === 'DUPLICADO' ? `Já lançado${x.lancamentoId ? ` (${x.lancamentoId})` : ''}` : x.status === 'LANCADO' ? `Lançamento ${x.lancamentoId}` : x.status === 'SEM_LEITURA' ? 'Sem leitura' : 'Lido'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {fer.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-9">
                      {fer.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[12px] text-fg-muted">
                          {c.sucesso ? <Check size={12} style={{ color: 'var(--success)' }} /> : <CircleSlash size={12} style={{ color: 'var(--danger)' }} />}
                          <span className="text-fg">{ROTULOS[c.ferramenta] ?? c.ferramenta}</span>
                          {c.resultado && <span className="max-w-[260px] truncate">{c.resultado}</span>}
                          <span className="tabular-nums">{(c.duracaoMs / 1000).toFixed(1)}s</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {(a.rascunho || ocupado) && (
              <div className="flex gap-2.5">
                <span className="shrink-0 mt-0.5"><Robo estado={a.estado === 'executando' ? 'executando' : 'pensando'} tamanho={26} /></span>
                <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bolha-robo">
                  {a.rascunho ? <TextoRobo texto={a.rascunho} /> : <span className="text-[13px] text-fg-muted">{a.estado === 'executando' ? 'Consultando o sistema...' : 'Pensando...'}</span>}
                </div>
              </div>
            )}
            <div ref={fim} />
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-surface px-4 py-3">
          <div className="max-w-3xl mx-auto">
            {a.pendentes.length > 0 && (
              <div className="flex flex-col gap-2 mb-2">
                {a.pendentes.map((p) => (
                  <div key={p.chave} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-2 text-[12.5px]">
                      <FileText size={14} className="text-fg-muted shrink-0" />
                      <span className="truncate flex-1 text-fg">{p.nome}</span>
                      <span className="text-fg-muted shrink-0">{p.status === 'DUPLICADO' ? `Já lançado${p.lancamentoId ? ` no lançamento ${p.lancamentoId}` : ''}` : p.status === 'ERRO' ? p.erro : `${p.etapa}${p.progresso !== undefined ? ` · ${p.progresso}%` : ''}`}</span>
                      {p.status !== 'LENDO' && <button aria-label="Remover anexo" onClick={() => a.removerPendente(p.chave)} className="text-fg-muted hover:text-fg"><X size={14} /></button>}
                    </div>
                    {p.status === 'LENDO' && <div className="barra-confianca mt-1.5"><span style={{ width: `${p.progresso ?? 20}%`, backgroundColor: 'var(--color-primary-light)' }} /></div>}
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <Button variant="ghost" aria-label="Anexar documento" onClick={() => arquivo.current?.click()}><Paperclip size={16} /></Button>
              <input ref={arquivo} type="file" multiple accept=".xml,.pdf,image/*" className="hidden" onChange={(e) => { const l = [...(e.target.files ?? [])]; if (l.length) a.anexar(l); e.target.value = ''; }} />
              <textarea ref={campo} rows={1} className="controle flex-1 resize-none py-2 leading-[22px]" style={{ height: 'var(--altura-controle)' }} aria-label="Mensagem" placeholder="Escreva sua mensagem" value={texto} onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
              {ocupado
                ? <Button variant="secondary" onClick={a.parar}><Square size={16} /> Parar</Button>
                : <Button disabled={!podeEnviar} aria-label="Enviar" onClick={enviar}><Send size={16} /></Button>}
            </div>
            <p className="text-[12px] text-fg-muted mt-1.5">Enter envia, Shift+Enter quebra a linha. <Link to="/ajuda" className="underline">Como funciona</Link></p>
          </div>
        </div>
      </section>

      {engrenagem && <ConfigIAModal onFechar={() => setEngrenagem(false)} onAviso={addToast} />}
      <Modal isOpen={Boolean(renomeando)} onClose={() => setRenomeando(null)} title="Renomear conversa" size="sm">
        {renomeando && (
          <div className="flex flex-col gap-3">
            <Input label="Título" value={renomeando.titulo} onChange={(e) => setRenomeando({ ...renomeando, titulo: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRenomeando(null)}>Cancelar</Button>
              <Button disabled={!renomeando.titulo.trim()} onClick={async () => { await a.renomear(renomeando.id, renomeando.titulo.trim()); setRenomeando(null); }}>Salvar</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog isOpen={excluindo !== null} onClose={() => setExcluindo(null)} onConfirm={async () => { if (excluindo !== null) await a.excluir(excluindo); setExcluindo(null); }} title="Excluir conversa" confirmLabel="Excluir"
        message="O histórico some: mensagens, ferramentas executadas e anexos desta conversa. Se quer só tirar da lista, arquive." />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function ConfigIAModal({ onFechar, onAviso }: { onFechar: () => void; onAviso: (t: 'success' | 'error', m: string) => void }) {
  const [connectionId, setConnectionId] = useState('');
  const [modelo, setModelo] = useState('');
  const [modelos, setModelos] = useState<OpcaoModelo[]>([]);
  const [lendo, setLendo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    lerConfigIA().then(async (c) => {
      setConnectionId(c.connectionId);
      setModelo(c.modelo);
      setModelos(await listarModelos(c.connectionId));
      setLendo(false);
    });
  }, []);
  useEffect(() => {
    if (lendo) return undefined;
    const t = setTimeout(() => { listarModelos(connectionId.trim()).then(setModelos); }, 500);
    return () => clearTimeout(t);
  }, [connectionId, lendo]);

  async function salvar() {
    setSalvando(true);
    try {
      await salvarConfigIA({ connectionId, modelo });
      onAviso('success', 'Configuração salva. Vale nas próximas conversas.');
      onFechar();
    } catch (e) { onAviso('error', getMitraErrorMessage(e)); } finally { setSalvando(false); }
  }

  return (
    <Modal isOpen onClose={onFechar} title="Configurar a IA">
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-fg-muted">Com uma connection do projeto, todos os usuários conversam pela mesma credencial: ninguém precisa conectar chave própria. Crie a connection nas configurações da plataforma, aba <strong>AI</strong>, e cole o identificador dela aqui.</p>
        <Input label="Identificador da connection" placeholder="deixe vazio para usar a credencial pessoal de cada usuário" value={connectionId} onChange={(e) => setConnectionId(e.target.value)} />
        {modelos.length > 0
          ? <Select label="Modelo" options={[{ value: '', label: 'Padrão da connection' }, ...modelos]} value={modelo} onChange={setModelo} />
          : <Input label="Modelo" placeholder={lendo ? 'Lendo...' : 'vazio = padrão da connection'} value={modelo} onChange={(e) => setModelo(e.target.value)} />}
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
          <Button disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </div>
    </Modal>
  );
}
