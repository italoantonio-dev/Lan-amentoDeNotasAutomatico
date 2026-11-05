import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import Input from './ui/Input';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { execSF, SF } from '../lib/api';
import { formatarCnpj } from '../lib/formato';

interface Parceiro { CODPARC: number; NOMEPARC: string; RAZAOSOCIAL?: string; CGC_CPF?: string; FORNECEDOR?: string }

// Busca no ERP enquanto se digita: a partir de 2 caracteres, com espera de 400ms. Escolher preenche
// nome e CNPJ juntos. Texto livre continua valendo: nem todo fornecedor esta cadastrado.
export default function CampoFornecedor({ label = 'Fornecedor', nome, onNome, onEscolher }: { label?: string; nome: string; onNome: (v: string) => void; onEscolher: (p: { nome: string; cnpj: string; codparc: number }) => void }) {
  const [lista, setLista] = useState<Parceiro[]>([]);
  const [aberto, setAberto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState('');
  const versao = useRef(0);
  const digitado = useRef(false);
  const caixa = useRef<HTMLDivElement>(null);
  const [lupa, setLupa] = useState(false);

  useEffect(() => {
    if (!digitado.current) return;
    const termo = nome.trim();
    if (termo.length < 2) { setLista([]); setAberto(false); return; }
    const v = ++versao.current;
    const t = setTimeout(async () => {
      setBuscando(true);
      setAviso('');
      try {
        const r = await execSF<{ itens?: Parceiro[] }>(SF.sankhyaParceiros, { busca: termo });
        if (versao.current !== v) return;
        setLista(r?.itens ?? []);
        setAberto(true);
      } catch {
        if (versao.current === v) { setAviso('Busca no ERP indisponível. Você pode digitar o nome.'); setLista([]); }
      } finally {
        if (versao.current === v) setBuscando(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [nome]);

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  return (
    <div className="relative" ref={caixa}>
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <Input label={label} value={nome} placeholder="Digite para buscar no ERP" onChange={(e) => { digitado.current = true; onNome(e.target.value); }} autoComplete="off" />
          {buscando && <Search size={14} className="absolute right-3 top-[34px] text-fg-subtle animate-pulse" />}
        </div>
        <Button type="button" variant="secondary" aria-label="Buscar parceiro no ERP" title="Buscar parceiro no ERP" onClick={() => { setAberto(false); setLupa(true); }}>
          <Search size={16} />
        </Button>
      </div>
      {lupa && createPortal(
        <BuscaParceiros onFechar={() => setLupa(false)} onEscolher={(p) => { digitado.current = false; onEscolher(p); setLupa(false); }} />,
        document.body,
      )}
      {aviso && <p className="text-[12px] text-fg-muted mt-1">{aviso}</p>}
      {aberto && (
        <div className="popover absolute z-50 mt-1 w-full max-h-60 overflow-y-auto">
          {lista.length === 0 && <div className="px-3 py-2 text-[13px] text-fg-muted">Nenhum parceiro no ERP. O nome digitado será usado.</div>}
          {lista.map((p) => (
            <button key={p.CODPARC} type="button" className="popover-item w-full text-left block" onClick={() => {
              digitado.current = false;
              onEscolher({ nome: p.RAZAOSOCIAL || p.NOMEPARC, cnpj: String(p.CGC_CPF ?? ''), codparc: Number(p.CODPARC) });
              setAberto(false);
            }}>
              <span className="block text-[13.5px] text-fg">{p.RAZAOSOCIAL || p.NOMEPARC}</span>
              <span className="block text-[12px] text-fg-muted">{p.CODPARC} · {formatarCnpj(p.CGC_CPF)}{p.FORNECEDOR === 'S' ? ' · fornecedor' : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Caixa da lupa: busca na TGFPAR (somente leitura) por nome, razao social ou CNPJ, 20 por vez.
function BuscaParceiros({ onFechar, onEscolher }: { onFechar: () => void; onEscolher: (p: { nome: string; cnpj: string; codparc: number }) => void }) {
  const [termo, setTermo] = useState('');
  const [lista, setLista] = useState<Parceiro[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');
  const versao = useRef(0);

  useEffect(() => {
    const t0 = termo.trim();
    if (t0.length < 2) { setLista(null); return; }
    const v = ++versao.current;
    const t = setTimeout(async () => {
      setBuscando(true);
      setErro('');
      try {
        const r = await execSF<{ itens?: Parceiro[] }>(SF.sankhyaParceiros, { busca: t0 });
        if (versao.current === v) setLista(r?.itens ?? []);
      } catch {
        if (versao.current === v) { setErro('Busca no ERP indisponível agora. Tente de novo em instantes.'); setLista([]); }
      } finally {
        if (versao.current === v) setBuscando(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [termo]);

  return (
    <Modal isOpen onClose={onFechar} title="Buscar parceiro no ERP" size="lg">
      <div className="flex flex-col gap-3">
        <Input label="Nome, razão social ou CNPJ" value={termo} autoFocus autoComplete="off" onChange={(e) => setTermo(e.target.value)} placeholder="Mínimo de 2 caracteres" />
        {erro && <p className="text-[12.5px] text-danger-text">{erro}</p>}
        <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-lg border border-border">
          <table className="tabela">
            <thead><tr><th>Código</th><th>Parceiro</th><th>CNPJ/CPF</th><th></th></tr></thead>
            <tbody>
              {buscando && <tr><td colSpan={4} className="text-fg-muted">Buscando...</td></tr>}
              {!buscando && lista === null && <tr><td colSpan={4} className="text-fg-muted">Digite para buscar entre os parceiros ativos.</td></tr>}
              {!buscando && lista?.length === 0 && !erro && <tr><td colSpan={4} className="text-fg-muted">Nenhum parceiro ativo encontrado.</td></tr>}
              {!buscando && lista?.map((p) => (
                <tr key={p.CODPARC} className="cursor-pointer" onClick={() => onEscolher({ nome: p.RAZAOSOCIAL || p.NOMEPARC, cnpj: String(p.CGC_CPF ?? ''), codparc: Number(p.CODPARC) })}>
                  <td className="tabular-nums">{p.CODPARC}</td>
                  <td>
                    <span className="block text-fg">{p.RAZAOSOCIAL || p.NOMEPARC}</span>
                    {p.RAZAOSOCIAL && p.NOMEPARC !== p.RAZAOSOCIAL && <span className="block text-[12px] text-fg-muted">{p.NOMEPARC}</span>}
                  </td>
                  <td className="tabular-nums">{formatarCnpj(p.CGC_CPF)}</td>
                  <td className="text-right text-[12px] text-fg-muted">{p.FORNECEDOR === 'S' ? 'fornecedor' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-fg-subtle">Mostra até 20 parceiros ativos. Clique no parceiro para preencher nome, CNPJ e código. Nada é alterado no ERP.</p>
      </div>
    </Modal>
  );
}
