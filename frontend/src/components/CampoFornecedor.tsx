import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import Input from './ui/Input';
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
      <Input label={label} value={nome} placeholder="Digite para buscar no ERP" onChange={(e) => { digitado.current = true; onNome(e.target.value); }} autoComplete="off" />
      {buscando && <Search size={14} className="absolute right-3 top-[34px] text-fg-subtle animate-pulse" />}
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
