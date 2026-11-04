import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react';
import { callSF, execSF, paraB64, SF, umaLinha } from '../lib/api';
import { formatarDataHora } from '../lib/formato';
import { getMitraErrorMessage } from '../lib/utils';
import { useToast } from '../hooks/useToast';
import { Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { SkeletonCards } from '../components/ui/Skeleton';
import { ToastContainer } from '../components/ui/Toast';
import { CabecalhoPagina, EstadoErro, EstadoVazio } from '../components/Comum';

type Linha = Record<string, any>;

export default function PlaygroundListaPage() {
  const nav = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [lista, setLista] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [criando, setCriando] = useState(false);
  const [renomear, setRenomear] = useState<{ id: number; nome: string } | null>(null);
  const [excluir, setExcluir] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try { setLista(await callSF(SF.playground_listar, { limite: 60, offset: 0 })); } catch (e) { setErro(getMitraErrorMessage(e)); } finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function novo() {
    setCriando(true);
    try {
      await execSF(SF.playground_criar);
      const r = await umaLinha(SF.playground_ultimo);
      if (r?.ID) nav(`/playground/${r.ID}`);
    } catch (e) { addToast('error', getMitraErrorMessage(e)); } finally { setCriando(false); }
  }

  return (
    <div className="p-4 md:p-8">
      <CabecalhoPagina titulo="Playground" descricao="Faça a pergunta que nenhuma tela previu: a analista investiga a base e desenha a resposta." acoes={<Button disabled={criando} onClick={novo}><Plus size={16} /> Novo estudo</Button>} />
      {erro ? <Card><EstadoErro mensagem={erro} onRetry={carregar} /></Card> : carregando ? <SkeletonCards count={3} /> : lista.length === 0 ? (
        <Card>
          <EstadoVazio icone={<FlaskConical size={20} />} titulo="Um estudo é uma pergunta que vira tela" descricao="Você escreve o que quer saber, a analista consulta a base do sistema e desenha a análise ao lado da conversa. O estudo fica guardado, com versões, e pode ser compartilhado por link." acao={<Button disabled={criando} onClick={novo}><Plus size={16} /> Começar o primeiro estudo</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 cascata">
          {lista.map((e) => (
            <div key={e.ID} role="link" tabIndex={0} onClick={() => nav(`/playground/${e.ID}`)} onKeyDown={(ev) => { if (ev.key === 'Enter') nav(`/playground/${e.ID}`); }} className="group cartao cartao-vivo p-5 cursor-pointer flex flex-col gap-2 min-h-[120px]">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[14px] font-medium text-fg">{e.NOME}</h2>
                <span className="hidden group-hover:flex gap-0.5 shrink-0">
                  <button aria-label="Renomear" className="p-1 rounded hover:bg-surface-active text-fg-muted" onClick={(ev) => { ev.stopPropagation(); setRenomear({ id: e.ID, nome: e.NOME }); }}><Pencil size={14} /></button>
                  <button aria-label="Excluir" className="p-1 rounded hover:bg-surface-active text-fg-muted" onClick={(ev) => { ev.stopPropagation(); setExcluir(e.ID); }}><Trash2 size={14} /></button>
                </span>
              </div>
              <p className="text-[12.5px] text-fg-muted">Atualizado {formatarDataHora(e.ATUALIZADO_EM)}</p>
              <div className="flex gap-1.5 mt-auto">
                {Number(e.TEM_TELA) === 1 ? <Badge variant="success">Com análise</Badge> : <Badge variant="neutral">Sem análise</Badge>}
                {e.SHARE_TOKEN && <Badge variant="info">Compartilhado</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={Boolean(renomear)} onClose={() => setRenomear(null)} title="Renomear estudo" size="sm">
        {renomear && (
          <div className="flex flex-col gap-3">
            <Input label="Nome" value={renomear.nome} onChange={(e) => setRenomear({ ...renomear, nome: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRenomear(null)}>Cancelar</Button>
              <Button disabled={!renomear.nome.trim()} onClick={async () => { await execSF(SF.playground_renomear_dono, { id: renomear.id, nome: paraB64(renomear.nome.trim()) }); setRenomear(null); carregar(); }}>Salvar</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog isOpen={excluir !== null} onClose={() => setExcluir(null)} onConfirm={async () => { if (excluir !== null) await execSF(SF.playground_excluir, { id: excluir }); setExcluir(null); carregar(); }} title="Excluir estudo" confirmLabel="Excluir" message="O estudo some da lista e o link público, se houver, para de funcionar." />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
