import { useEffect, useRef, useState } from 'react';
import { Check, RefreshCw, Wrench, X } from 'lucide-react';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import { execSF, SF } from '../lib/api';
import { buscarCidades } from '../lib/cidadesErp';
import { diagnosticar } from '../lib/diagnosticoErp';
import { getMitraErrorMessage } from '../lib/utils';
import { GRAVACAO_ERP_LIBERADA } from '../hooks/useEnvioErp';

interface Requisito { rotulo: string; pronto: boolean; detalhe: string }
interface Conferencia { ok: boolean; erro?: string; requisitos?: Requisito[]; codparc?: number | null }

// Quando o ERP recusa, a tela explica. A correcao confere o cadastro imediatamente antes de alterar.
export default function PainelRecusaErp({ lancamentoId, mensagem, semParceiro, nomeFornecedor, administrador, onTentar, enviando, onAviso }: {
  lancamentoId: number; mensagem: string; semParceiro?: boolean; nomeFornecedor: string; administrador: boolean; onTentar: () => void; enviando: boolean; onAviso: (tipo: 'success' | 'error', msg: string) => void;
}) {
  const d = diagnosticar(mensagem);
  const [conf, setConf] = useState<Conferencia | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [nome, setNome] = useState(nomeFornecedor);
  const [termoCidade, setTermoCidade] = useState('');
  const [cidades, setCidades] = useState<{ value: string; label: string }[]>([]);
  const [codcid, setCodcid] = useState('');
  const v = useRef(0);

  useEffect(() => {
    if (!semParceiro || termoCidade.trim().length < 2) return;
    const n = ++v.current;
    const t = setTimeout(async () => {
      try {
        const r = await buscarCidades(termoCidade);
        if (v.current === n) setCidades(r.map((c) => ({ value: String(c.CODCID), label: c.NOMECID })));
      } catch { /* sem sugestao */ }
    }, 400);
    return () => clearTimeout(t);
  }, [termoCidade, semParceiro]);

  async function conferir() {
    setOcupado(true);
    try {
      setConf(await execSF<Conferencia>(SF.conferirCadastroErp, { lancamentoId }));
    } catch (e) {
      setConf({ ok: false, erro: getMitraErrorMessage(e) });
    } finally {
      setOcupado(false);
    }
  }

  async function corrigir(acao: string, extra: Record<string, unknown>) {
    setOcupado(true);
    try {
      const r = await execSF<{ ok: boolean; erro?: string }>(SF.corrigirCadastroErp, { lancamentoId, acao, ...extra });
      if (!r.ok) { onAviso('error', r.erro ?? 'Não consegui corrigir.'); return; }
      onAviso('success', 'Cadastro corrigido no ERP. Agora tente novamente.');
      await conferir();
    } catch (e) {
      onAviso('error', getMitraErrorMessage(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--danger)', backgroundColor: 'var(--danger-soft)' }}>
      <div>
        <p className="text-[14px] font-medium text-fg">{d.causa}</p>
        <p className="text-[13px] text-fg-muted mt-0.5">{d.acao}</p>
        <p className="text-[12px] text-fg-muted mt-2 break-words">Mensagem do ERP: {d.detalhe}</p>
      </div>

      {conf?.erro && <p className="text-[13px] text-fg">{conf.erro}</p>}
      {conf?.requisitos && (
        <ul className="flex flex-col gap-1.5">
          {conf.requisitos.map((r) => (
            <li key={r.rotulo} className="flex items-start gap-2 text-[13px] text-fg">
              {r.pronto ? <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} /> : <X size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
              <span><strong className="font-medium">{r.rotulo}.</strong> {r.detalhe}</span>
            </li>
          ))}
        </ul>
      )}

      {GRAVACAO_ERP_LIBERADA && semParceiro && administrador && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <Input label="Nome do parceiro" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input label="Buscar cidade" value={termoCidade} onChange={(e) => setTermoCidade(e.target.value)} placeholder="Digite o nome da cidade" />
          <Select label="Cidade" options={cidades} value={codcid} onChange={setCodcid} placeholder={cidades.length ? 'Selecione...' : 'Busque a cidade acima'} />
          <Button variant="secondary" disabled={ocupado || !nome.trim() || !codcid} onClick={() => corrigir('CRIAR_PARCEIRO', { nome, codcid: Number(codcid) })}>Criar parceiro no ERP</Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {administrador && d.corrigir && !conf?.requisitos && <Button variant="secondary" disabled={ocupado} onClick={conferir}><Wrench size={16} /> Conferir cadastro</Button>}
        {GRAVACAO_ERP_LIBERADA && administrador && d.corrigir && conf?.codparc && conf.requisitos?.some((r) => !r.pronto) && <Button variant="secondary" disabled={ocupado} onClick={() => corrigir(d.corrigir as string, { codparc: conf.codparc })}><Wrench size={16} /> Corrigir cadastro</Button>}
        {GRAVACAO_ERP_LIBERADA && !administrador && d.corrigir && <span className="text-[12.5px] text-fg-muted self-center">Só o administrador corrige o cadastro no ERP.</span>}
        {!GRAVACAO_ERP_LIBERADA && (semParceiro || d.corrigir) && <span className="text-[12.5px] text-fg-muted self-center">O ajuste do cadastro é feito diretamente no Sankhya.</span>}
        {d.tentarDeNovo && <Button disabled={enviando} onClick={onTentar}><RefreshCw size={16} /> {GRAVACAO_ERP_LIBERADA ? 'Tentar novamente' : 'Conferir novamente'}</Button>}
      </div>
    </div>
  );
}
