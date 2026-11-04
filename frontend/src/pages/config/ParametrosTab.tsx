import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { callSF, execSF, exigirAfetou, SF } from '../../lib/api';
import { formatarMoeda } from '../../lib/formato';
import { getMitraErrorMessage } from '../../lib/utils';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Radio from '../../components/ui/Radio';
import Select from '../../components/ui/Select';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { Aviso, EstadoErro, EstadoVazio, Paginacao } from '../../components/Comum';

type Linha = Record<string, any>;
const POR_PAGINA = 30;
const VAZIO = { empresaId: '', tipoId: '', topId: '', naturezaId: '', centroId: '', contaId: '', limite: '', destino: 'FINANCEIRO', codTipTit: '', codProdPadrao: '' };

export default function ParametrosTab({ onAviso }: { onAviso: (t: 'success' | 'error', m: string) => void }) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [op, setOp] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState<typeof VAZIO | null>(null);
  const [apagar, setApagar] = useState<Linha | null>(null);
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const [evidencia, setEvidencia] = useState<string[]>([]);
  const [termoProduto, setTermoProduto] = useState('');
  const [produtos, setProdutos] = useState<{ value: string; label: string }[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [l, o] = await Promise.all([callSF(SF.listarParametros, { limite: POR_PAGINA, offset: pagina * POR_PAGINA }), callSF(SF.listarOpcoesCadastro)]);
      setLinhas(l);
      setOp(o);
      setTotal(Number(l[0]?.TOTAL_GERAL ?? 0));
    } catch (e) { setErro(getMitraErrorMessage(e)); } finally { setCarregando(false); }
  }, [pagina]);
  useEffect(() => { carregar(); }, [carregar]);

  const opcoes = useCallback((grupo: string, filtro?: (o: Linha) => boolean) => op.filter((o) => o.GRUPO === grupo && Number(o.ATIVO) === 1 && (!filtro || filtro(o))).map((o) => ({ value: String(o.ID), label: `${o.CODIGO} · ${o.DESCRICAO}` })), [op]);
  const tipoEscolhido = useMemo(() => op.find((o) => o.GRUPO === 'TIPO_DOCUMENTO' && String(o.ID) === form?.tipoId), [op, form?.tipoId]);

  const abrir = (l?: Linha) => {
    setErroForm(''); setEvidencia([]); setProdutos([]); setTermoProduto('');
    setForm(l ? { empresaId: String(l.EMPRESA_ID), tipoId: String(l.TIPO_DOCUMENTO_ID), topId: String(l.TOP_ID ?? ''), naturezaId: String(l.NATUREZA_ID ?? ''), centroId: String(l.CENTRO_ID ?? ''), contaId: String(l.CONTA_ID ?? ''), limite: String(l.LIMITE_APROVACAO ?? ''), destino: String(l.DESTINO_ERP ?? 'FINANCEIRO'), codTipTit: String(l.CODTIPTIT ?? ''), codProdPadrao: String(l.CODPROD_PADRAO ?? '') } : VAZIO);
  };

  // Mostra a evidencia, nunca preenche em silencio. A TOP e filtrada pela familia do tipo de documento,
  // e natureza, centro e conta sao os mais usados DENTRO da TOP escolhida.
  async function sugerir() {
    if (!form?.empresaId || !form.tipoId) { setErroForm('Escolha a empresa e o tipo primeiro.'); return; }
    const emp = op.find((o) => o.GRUPO === 'EMPRESA' && String(o.ID) === form.empresaId);
    setSugerindo(true);
    setErroForm('');
    try {
      const r = await execSF<{ ok: boolean; erro?: string; itens?: { dim: string; topRef: string; cod: string; n: number }[] }>(SF.sankhyaPadroesLancamento, { codemp: Number(emp?.CODIGO) });
      if (!r.ok) throw new Error(r.erro);
      const itens = r.itens ?? [];
      const tipmov = tipoEscolhido?.TIPMOV;
      const acharLocal = (grupo: string, cod: string) => op.find((o) => o.GRUPO === grupo && String(o.CODIGO) === String(cod));
      const topsRank = itens.filter((i) => i.dim === 'TOP' && i.topRef === 'TODOS');
      const topItem = topsRank.find((t) => { const l = acharLocal('TOP', t.cod); return l && (!tipmov || l.TIPMOV === tipmov); });
      if (!topItem) { setEvidencia([]); setErroForm(`O ERP não tem histórico de TOP com movimento "${tipmov}" nos últimos 24 meses nesta empresa. Escolha à mão.`); return; }
      const topLocal = acharLocal('TOP', topItem.cod);
      const melhor = (dim: string, grupo: string) => {
        const dentro = itens.filter((i) => i.dim === dim && i.topRef === topItem.cod);
        for (const i of dentro) { const l = acharLocal(grupo, i.cod); if (l) return { i, l }; }
        return null;
      };
      const nat = melhor('NATUREZA', 'NATUREZA');
      const cen = melhor('CENTRO', 'CENTRO');
      const cta = melhor('CONTA', 'CONTA');
      const tit = melhor('TITULO', 'TIPO_TITULO');
      setForm((f) => f && ({
        ...f,
        topId: topLocal ? String(topLocal.ID) : f.topId,
        naturezaId: nat ? String(nat.l.ID) : f.naturezaId,
        centroId: cen ? String(cen.l.ID) : f.centroId,
        contaId: cta ? String(cta.l.ID) : f.contaId,
        codTipTit: tit ? String(tit.l.CODIGO) : f.codTipTit,
      }));
      const linha = (rot: string, item?: { i: { cod: string; n: number }; l: Linha } | null) => (item ? `${rot}: ${item.i.cod} ${item.l.DESCRICAO} — ${item.i.n} documentos` : '');
      setEvidencia([`TOP: ${topItem.cod} ${topLocal?.DESCRICAO ?? ''} — ${topItem.n} documentos`, linha('Natureza', nat), linha('Centro', cen), linha('Conta', cta), linha('Tipo de título', tit)].filter(Boolean));
    } catch (e) {
      setErroForm(`Não consegui consultar o ERP: ${getMitraErrorMessage(e)}`);
    } finally { setSugerindo(false); }
  }

  async function buscarProduto() {
    try {
      const r = await execSF<{ itens?: Linha[] }>(SF.sankhyaProdutos, { busca: termoProduto });
      setProdutos((r?.itens ?? []).map((p) => ({ value: String(p.CODPROD), label: `${p.CODPROD} · ${p.DESCRPROD}` })));
    } catch (e) { setErroForm(getMitraErrorMessage(e)); }
  }

  async function salvar() {
    if (!form) return;
    if (!form.empresaId || !form.tipoId) { setErroForm('Escolha a empresa e o tipo de documento.'); return; }
    const limite = Number(String(form.limite || '0').replace(',', '.'));
    if (!Number.isFinite(limite) || limite < 0) { setErroForm('Limite de aprovação inválido.'); return; }
    setSalvando(true);
    try {
      await exigirAfetou(SF.salvarParametro, { empresaId: Number(form.empresaId), tipoId: Number(form.tipoId), topId: Number(form.topId) || 0, naturezaId: Number(form.naturezaId) || 0, centroId: Number(form.centroId) || 0, contaId: Number(form.contaId) || 0, limite, destino: form.destino, codTipTit: Number(form.codTipTit) || 0, codProdPadrao: Number(form.codProdPadrao) || 0 }, 'Sem permissão: nada foi salvo.');
      setForm(null);
      onAviso('success', 'Parâmetro salvo.');
      carregar();
    } catch (e) { setErroForm(getMitraErrorMessage(e)); } finally { setSalvando(false); }
  }

  async function excluir() {
    if (!apagar) return;
    setSalvando(true);
    try {
      await exigirAfetou(SF.excluirParametro, { id: apagar.ID }, 'Sem permissão: nada foi excluído.');
      onAviso('success', 'Parâmetro excluído.');
      carregar();
    } catch (e) { onAviso('error', getMitraErrorMessage(e)); } finally { setApagar(null); setSalvando(false); }
  }

  return (
    <>
      <Aviso tipo="info" acao={<Button onClick={() => abrir()}><Plus size={16} /> Adicionar</Button>}>
        Uma linha por empresa e tipo de documento. Sem ela, nenhum valor cabe em alçada e tudo para em “Aguardando aprovação”. Para o robô lançar sozinho, o limite precisa ficar acima do valor dos documentos.
      </Aviso>
      <Card>
        {erro ? <EstadoErro mensagem={erro} onRetry={carregar} /> : carregando ? <SkeletonTable /> : linhas.length === 0 ? (
          <EstadoVazio titulo="Nenhum parâmetro cadastrado" descricao="Comece pela empresa e pelo tipo de documento que você mais lança; o botão “Sugerir do ERP” preenche com o que a empresa pratica." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead><tr><th>Empresa</th><th>Tipo</th><th>TOP</th><th>Natureza</th><th>Destino</th><th className="text-right">Limite</th><th /></tr></thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.ID}>
                      <td className="font-medium text-fg">{l.EMPRESA}</td>
                      <td>{l.TIPO}</td>
                      <td>{l.TOP_DESC ? `${l.CODTIPOPER} · ${l.TOP_DESC}` : '—'}</td>
                      <td>{l.NATUREZA_DESC ?? '—'}</td>
                      <td>{l.DESTINO_ERP === 'NOTA' ? 'Nota' : 'Financeiro'}</td>
                      <td className="text-right tabular-nums">{formatarMoeda(l.LIMITE_APROVACAO)}</td>
                      <td className="text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" aria-label="Editar" onClick={() => abrir(l)}><Pencil size={16} /></Button>
                        <Button size="sm" variant="ghost" aria-label="Excluir" onClick={() => setApagar(l)}><Trash2 size={16} /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} total={total} porPagina={POR_PAGINA} onMudar={setPagina} />
          </>
        )}
      </Card>

      <Modal isOpen={Boolean(form)} onClose={() => setForm(null)} title="Parâmetro de lançamento" size="lg">
        {form && (
          <div className="flex flex-col gap-4">
            {erroForm && <Aviso tipo="danger">{erroForm}</Aviso>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select label="Empresa" options={opcoes('EMPRESA')} value={form.empresaId} onChange={(v) => setForm({ ...form, empresaId: v })} />
              <Select label="Tipo de documento" options={opcoes('TIPO_DOCUMENTO')} value={form.tipoId} onChange={(v) => { const t = op.find((o) => o.GRUPO === 'TIPO_DOCUMENTO' && String(o.ID) === v); setForm({ ...form, tipoId: v, topId: '', destino: t?.CODIGO === 'NOTA_FISCAL' ? 'NOTA' : 'FINANCEIRO' }); }} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" disabled={sugerindo} onClick={sugerir}><Sparkles size={16} /> {sugerindo ? 'Consultando o ERP...' : 'Sugerir do ERP'}</Button>
              <span className="text-[12.5px] text-fg-muted">Preenche com o que a empresa praticou nos últimos 24 meses.</span>
            </div>
            {evidencia.length > 0 && (
              <ul className="rounded-lg bg-surface-muted px-4 py-3 text-[12.5px] text-fg-muted flex flex-col gap-1">
                {evidencia.map((e) => <li key={e} className="tabular-nums">{e}</li>)}
              </ul>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select label={`TOP${tipoEscolhido?.TIPMOV ? ` (movimento ${tipoEscolhido.TIPMOV})` : ''}`} options={opcoes('TOP', (o) => !tipoEscolhido?.TIPMOV || o.TIPMOV === tipoEscolhido.TIPMOV)} value={form.topId} onChange={(v) => setForm({ ...form, topId: v })} />
              <Select label="Natureza" options={opcoes('NATUREZA')} value={form.naturezaId} onChange={(v) => setForm({ ...form, naturezaId: v })} />
              <Select label="Centro de resultado" options={opcoes('CENTRO')} value={form.centroId} onChange={(v) => setForm({ ...form, centroId: v })} />
              <Select label="Conta bancária" options={opcoes('CONTA')} value={form.contaId} onChange={(v) => setForm({ ...form, contaId: v })} />
              <Select label="Tipo de título" options={op.filter((o) => o.GRUPO === 'TIPO_TITULO' && Number(o.ATIVO) === 1).map((o) => ({ value: String(o.CODIGO), label: `${o.CODIGO} · ${o.DESCRICAO}` }))} value={form.codTipTit} onChange={(v) => setForm({ ...form, codTipTit: v })} />
              <Input label="Limite de aprovação (R$)" inputMode="decimal" value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value })} />
            </div>
            <Radio label="Destino no ERP" direction="horizontal" options={[{ value: 'FINANCEIRO', label: 'Título financeiro' }, { value: 'NOTA', label: 'Nota de entrada' }]} value={form.destino} onChange={(v) => setForm({ ...form, destino: v })} />
            <div>
              <p className="text-[13px] font-medium text-fg-muted mb-1.5">Produto padrão</p>
              <p className="text-[12.5px] text-fg-muted mb-2">Usado quando a leitura não traz item detalhado. Sem ele, a nota de entrada entraria vazia e o envio é recusado.</p>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 items-end">
                <Input aria-label="Buscar produto" placeholder="Buscar produto no ERP" value={termoProduto} onChange={(e) => setTermoProduto(e.target.value)} />
                <Button variant="secondary" disabled={termoProduto.trim().length < 2} onClick={buscarProduto}>Buscar</Button>
                {produtos.length > 0
                  ? <Select options={produtos} value={form.codProdPadrao} onChange={(v) => setForm({ ...form, codProdPadrao: v })} />
                  : <Input aria-label="Código do produto" placeholder="Código do produto" value={form.codProdPadrao} onChange={(e) => setForm({ ...form, codProdPadrao: e.target.value.replace(/\D/g, '') })} />}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>Cancelar</Button>
              <Button disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog isOpen={Boolean(apagar)} onClose={() => setApagar(null)} onConfirm={excluir} title="Excluir parâmetro" confirmLabel="Excluir" loading={salvando} message="Sem este parâmetro, os novos documentos desta empresa e tipo param em aprovação e sem classificação." />
    </>
  );
}
