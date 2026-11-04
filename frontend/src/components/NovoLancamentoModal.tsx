import { useEffect, useRef, useState } from 'react';
import { uploadFilePrivateMitra } from 'mitra-interactions-sdk';
import { FileUp, Plus, Trash2 } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import DatePicker from './ui/DatePicker';
import Badge from './ui/Badge';
import CampoFornecedor from './CampoFornecedor';
import { Aviso } from './Comum';
import { callSF, execSF, PROJECT_ID, SF } from '../lib/api';
import { hashArquivo } from '../lib/hash';
import { formatarMoeda, rotulosDoTipo } from '../lib/formato';
import { lerArquivo } from '../lib/ocr';
import { getMitraErrorMessage } from '../lib/utils';

interface Tipo { ID: number; CODIGO: string; DESCRICAO: string }
interface Empresa { value: string; label: string }
interface Item { descricao: string; quantidade: string; valorUnitario: string }

const VAZIO = { empresaId: '', nome: '', cnpj: '', codparc: 0, numeroDoc: '', serie: '', dataEmissao: '', dataVencimento: '', valorTotal: '' };

export default function NovoLancamentoModal({ aberto, tipo, empresas, onFechar, onCriado }: { aberto: boolean; tipo: Tipo | null; empresas: Empresa[]; onFechar: () => void; onCriado: (id: number) => void }) {
  const [f, setF] = useState(VAZIO);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [hash, setHash] = useState('');
  const [etapa, setEtapa] = useState('');
  const [progresso, setProgresso] = useState<number | undefined>();
  const [conferir, setConferir] = useState<string[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [erro, setErro] = useState('');
  const [duplicado, setDuplicado] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const rot = rotulosDoTipo(tipo?.CODIGO ?? '');
  const ehNota = tipo?.CODIGO === 'NOTA_FISCAL';

  useEffect(() => {
    if (aberto) { setF(VAZIO); setArquivo(null); setHash(''); setEtapa(''); setConferir([]); setItens([]); setErro(''); setDuplicado(null); }
  }, [aberto]);

  const set = (campo: keyof typeof VAZIO, valor: string | number) => {
    setF((a) => ({ ...a, [campo]: valor }));
    setConferir((c) => c.filter((x) => x !== campo));
  };

  async function receber(file: File) {
    setErro('');
    setDuplicado(null);
    setArquivo(file);
    try {
      setEtapa('Conferindo se o documento já entrou');
      const h = await hashArquivo(file);
      setHash(h);
      // Duplicado para aqui: nao gasta OCR nem armazenamento.
      const dup = await callSF(SF.verificarDuplicidadeDocumento, { hash: h });
      if (dup.length) { setDuplicado(Number(dup[0].LANCAMENTO_ID) || 0); setEtapa(''); return; }
      const leitura = await lerArquivo(file, (e, p) => { setEtapa(e); setProgresso(p); });
      const c = leitura.campos;
      const marcar: string[] = [];
      setF((a) => {
        const n = { ...a };
        const aplicar = (k: keyof typeof VAZIO) => {
          const v = c[k];
          if (v?.valor) { (n as Record<string, unknown>)[k] = v.valor; if (v.confianca === 'CONFERIR') marcar.push(k); }
        };
        (['nome', 'cnpj', 'numeroDoc', 'serie', 'dataEmissao', 'dataVencimento', 'valorTotal'] as const).forEach(aplicar);
        return n;
      });
      setConferir(marcar);
      if (ehNota && leitura.itens.length) setItens(leitura.itens.map((i) => ({ descricao: i.descricao, quantidade: String(i.quantidade), valorUnitario: String(i.valorUnitario) })));
      if (leitura.origem === 'SEM_LEITURA') setErro('Não consegui ler este formato: preencha os campos à mão.');
    } catch (e) {
      // Falha de leitura nao derruba o envio: o documento segue e os campos ficam para preencher.
      setErro(`Não consegui ler o arquivo (${getMitraErrorMessage(e)}). Preencha os campos à mão.`);
    } finally {
      setEtapa('');
      setProgresso(undefined);
    }
  }

  async function salvar() {
    setErro('');
    if (!f.empresaId) { setErro('Escolha a empresa.'); return; }
    const valor = Number(String(f.valorTotal).replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) { setErro('Informe o valor do documento.'); return; }
    setSalvando(true);
    try {
      let arquivoKey = '';
      if (arquivo) {
        const up = await uploadFilePrivateMitra({ projectId: PROJECT_ID, file: arquivo });
        arquivoKey = up?.result?.key ?? '';
      }
      const r = await execSF<{ ok: boolean; erro?: string; lancamentoId?: number; duplicado?: boolean }>(SF.criarLancamentoViaChat, {
        origem: 'TELA', empresaId: Number(f.empresaId), tipoId: tipo?.ID, hash, arquivoNome: arquivo?.name ?? '', arquivoKey,
        nome: f.nome, cnpj: f.cnpj, codparc: f.codparc, numeroDoc: f.numeroDoc, serie: f.serie, dataEmissao: f.dataEmissao, dataVencimento: ehNota ? '' : f.dataVencimento, valorTotal: valor,
        itens: itens.filter((i) => i.descricao.trim()).map((i) => ({ descricao: i.descricao, quantidade: Number(i.quantidade) || 1, valorUnitario: Number(String(i.valorUnitario).replace(',', '.')) || 0 })),
      });
      if (!r.ok) { setErro(r.erro ?? 'Não consegui criar o lançamento.'); return; }
      onCriado(Number(r.lancamentoId));
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setSalvando(false);
    }
  }

  const marca = (k: string) => conferir.includes(k) && <span className="ml-1"><Badge variant="warning">conferir</Badge></span>;
  const ocupado = Boolean(etapa) || salvando;

  return (
    <Modal isOpen={aberto} onClose={onFechar} title={`Novo — ${tipo?.DESCRICAO ?? ''}`} size="lg">
      <div className="flex flex-col gap-4">
        <button type="button" onClick={() => entrada.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const a = e.dataTransfer.files[0]; if (a) receber(a); }}
          className="rounded-xl border border-dashed border-border-strong px-4 py-5 text-center hover:bg-surface-hover transition-colors">
          <FileUp size={20} className="mx-auto text-fg-muted" />
          <p className="text-[13.5px] text-fg mt-2">{arquivo ? arquivo.name : 'Arraste o documento ou clique para escolher'}</p>
          <p className="text-[12px] text-fg-muted mt-0.5">XML, PDF ou imagem. A leitura acontece aqui, no seu navegador.</p>
        </button>
        <input ref={entrada} type="file" accept=".xml,.pdf,image/*" className="hidden" onChange={(e) => { const a = e.target.files?.[0]; if (a) receber(a); e.target.value = ''; }} />

        {etapa && (
          <div>
            <p className="text-[12.5px] text-fg-muted mb-1">{etapa}{progresso !== undefined ? ` · ${progresso}%` : ''}</p>
            <div className="barra-confianca"><span style={{ width: `${progresso ?? 15}%`, backgroundColor: 'var(--color-primary-light)' }} /></div>
          </div>
        )}
        {duplicado !== null && (
          <Aviso tipo="warning" acao={duplicado ? <Button size="sm" variant="secondary" onClick={() => onCriado(duplicado)}>Abrir o lançamento</Button> : undefined}>
            Este documento já entrou{duplicado ? ` no lançamento ${duplicado}` : ''}. Um papel vira um lançamento só.
          </Aviso>
        )}
        {erro && <Aviso tipo="danger">{erro}</Aviso>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select label="Empresa" options={empresas} value={f.empresaId} onChange={(v) => set('empresaId', v)} placeholder={empresas.length ? 'Selecione...' : 'Nenhuma empresa cadastrada'} />
          <div>
            <CampoFornecedor nome={f.nome} onNome={(v) => { set('nome', v); set('codparc', 0); }} onEscolher={(p) => setF((a) => ({ ...a, nome: p.nome, cnpj: p.cnpj, codparc: p.codparc }))} />
            {marca('nome')}
          </div>
          <div><Input label="CNPJ do fornecedor" value={f.cnpj} onChange={(e) => set('cnpj', e.target.value)} />{marca('cnpj')}</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Input label="Número" value={f.numeroDoc} onChange={(e) => set('numeroDoc', e.target.value)} />{marca('numeroDoc')}</div>
            <Input label="Série" value={f.serie} onChange={(e) => set('serie', e.target.value)} />
          </div>
          <div><DatePicker label={rot.data} value={f.dataEmissao} onChange={(v) => set('dataEmissao', v)} />{marca('dataEmissao')}</div>
          {rot.vencimento && <div><DatePicker label={rot.vencimento} value={f.dataVencimento} onChange={(v) => set('dataVencimento', v)} />{marca('dataVencimento')}</div>}
          <div><Input label="Valor total" inputMode="decimal" value={f.valorTotal} onChange={(e) => set('valorTotal', e.target.value)} />{marca('valorTotal')}</div>
        </div>

        {ehNota && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-medium text-fg-muted">Itens da nota</span>
              <Button size="sm" variant="ghost" onClick={() => setItens((l) => [...l, { descricao: '', quantidade: '1', valorUnitario: '' }])}><Plus size={16} /> Item</Button>
            </div>
            {itens.length === 0 && <p className="text-[12.5px] text-fg-muted">Sem itens: o envio ao ERP usa o produto padrão do parâmetro.</p>}
            <div className="flex flex-col gap-2">
              {itens.map((i, n) => (
                <div key={n} className="grid grid-cols-[1fr_72px_100px_auto] gap-2 items-center">
                  <Input aria-label="Descrição" placeholder="Descrição" value={i.descricao} onChange={(e) => setItens((l) => l.map((x, y) => (y === n ? { ...x, descricao: e.target.value } : x)))} />
                  <Input aria-label="Quantidade" value={i.quantidade} onChange={(e) => setItens((l) => l.map((x, y) => (y === n ? { ...x, quantidade: e.target.value } : x)))} />
                  <Input aria-label="Valor unitário" placeholder="Unitário" value={i.valorUnitario} onChange={(e) => setItens((l) => l.map((x, y) => (y === n ? { ...x, valorUnitario: e.target.value } : x)))} />
                  <Button variant="ghost" aria-label="Remover item" onClick={() => setItens((l) => l.filter((_, y) => y !== n))}><Trash2 size={16} /></Button>
                </div>
              ))}
              {itens.length > 0 && <p className="text-[12.5px] text-fg-muted tabular-nums">Soma dos itens: {formatarMoeda(itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(String(i.valorUnitario).replace(',', '.')) || 0), 0))}</p>}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={ocupado || duplicado !== null}>{salvando ? 'Criando...' : 'Criar lançamento'}</Button>
        </div>
      </div>
    </Modal>
  );
}
