import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { callSF, exigirAfetou } from '../../lib/api';
import { getMitraErrorMessage } from '../../lib/utils';
import { Card } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Checkbox from '../../components/ui/Checkbox';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { Aviso, EstadoErro, EstadoVazio, Paginacao } from '../../components/Comum';

type Linha = Record<string, any>;
const POR_PAGINA = 30;

export default function CadastroTab({ listar, criar, atualizar, excluir, rotulo, colCodigo, rotuloCodigo, colDescricao, codigoNumerico, extras, onAviso }: {
  listar: number; criar: number; atualizar: number; excluir: number; rotulo: string; colCodigo: string; rotuloCodigo: string; colDescricao: string; codigoNumerico: boolean;
  extras: { col: string; param: string; rotulo: string }[]; onAviso: (t: 'success' | 'error', m: string) => void;
}) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState<Linha | null>(null);
  const [apagar, setApagar] = useState<Linha | null>(null);
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { const t = setTimeout(() => { setTermo(busca.trim()); setPagina(0); }, 350); return () => clearTimeout(t); }, [busca]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const r = await callSF(listar, { busca: termo, limite: POR_PAGINA, offset: pagina * POR_PAGINA });
      setLinhas(r);
      setTotal(Number(r[0]?.TOTAL_GERAL ?? 0));
    } catch (e) { setErro(getMitraErrorMessage(e)); } finally { setCarregando(false); }
  }, [listar, termo, pagina]);
  useEffect(() => { carregar(); }, [carregar]);

  const abrir = (l?: Linha) => {
    setErroForm('');
    const base: Linha = { id: l?.ID ?? 0, codigo: l ? String(l[colCodigo]) : '', descricao: l ? String(l[colDescricao] ?? '') : '', ativo: l ? Number(l.ATIVO) === 1 : true };
    extras.forEach((x) => { base[x.param] = l ? String(l[x.col] ?? '') : ''; });
    setForm(base);
  };

  async function salvar() {
    if (!form) return;
    const codigo = String(form.codigo).trim();
    if (!codigo || (codigoNumerico && !/^\d+$/.test(codigo))) { setErroForm(codigoNumerico ? 'O código precisa ser numérico.' : 'Informe o código.'); return; }
    if (!String(form.descricao).trim()) { setErroForm('Informe a descrição.'); return; }
    setSalvando(true);
    try {
      const entrada: Linha = { codigo, descricao: String(form.descricao).trim(), ativo: form.ativo ? 1 : 0 };
      extras.forEach((x) => { entrada[x.param] = form[x.param] ?? ''; });
      if (form.id) await exigirAfetou(atualizar, { ...entrada, id: form.id }, 'Sem permissão: nada foi alterado.');
      else await exigirAfetou(criar, entrada, 'Sem permissão: nada foi criado.');
      setForm(null);
      onAviso('success', 'Salvo.');
      carregar();
    } catch (e) {
      const m = getMitraErrorMessage(e);
      setErroForm(/Duplicate|UK_/i.test(m) ? 'Já existe um registro com este código.' : m);
    } finally { setSalvando(false); }
  }

  async function confirmarExclusao() {
    if (!apagar) return;
    setSalvando(true);
    try {
      await exigirAfetou(excluir, { id: apagar.ID }, 'Sem permissão: nada foi excluído.');
      onAviso('success', 'Excluído.');
      carregar();
    } catch (e) {
      const m = getMitraErrorMessage(e);
      onAviso('error', /foreign key|constraint/i.test(m) ? 'Em uso por parâmetro ou lançamento: inative em vez de excluir.' : m);
    } finally { setApagar(null); setSalvando(false); }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-3 text-fg-subtle" />
          <input className="controle controle-com-icone h-10 w-full" aria-label="Buscar" placeholder="Buscar por nome ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Button onClick={() => abrir()}><Plus size={16} /> Adicionar</Button>
      </div>
      <Card>
        {erro ? <EstadoErro mensagem={erro} onRetry={carregar} /> : carregando ? <SkeletonTable /> : linhas.length === 0 ? (
          <EstadoVazio titulo={termo ? 'Nada com esta busca' : `Nenhum registro de ${rotulo}`} descricao={termo ? undefined : 'Sincronize com o ERP ou adicione à mão: quando o ERP conectar, o código atualiza em vez de duplicar.'} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead><tr><th>Código</th><th>Descrição</th>{extras.slice(0, 2).map((x) => <th key={x.col}>{x.rotulo}</th>)}<th>Situação</th><th /></tr></thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.ID}>
                      <td className="tabular-nums">{l[colCodigo]}</td>
                      <td className="font-medium text-fg">{l[colDescricao]}</td>
                      {extras.slice(0, 2).map((x) => <td key={x.col}>{l[x.col] ?? '—'}</td>)}
                      <td><Badge variant={Number(l.ATIVO) === 1 ? 'success' : 'neutral'}>{Number(l.ATIVO) === 1 ? 'Ativo' : 'Inativo'}</Badge></td>
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
      <Modal isOpen={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? `Editar ${rotulo}` : `Adicionar ${rotulo}`}>
        {form && (
          <div className="flex flex-col gap-3">
            {erroForm && <Aviso tipo="danger">{erroForm}</Aviso>}
            <Input label={rotuloCodigo} value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            <Input label="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            {extras.map((x) => <Input key={x.param} label={x.rotulo} value={form[x.param]} onChange={(e) => setForm({ ...form, [x.param]: e.target.value })} />)}
            <Checkbox label="Ativo" checked={form.ativo} onChange={(v) => setForm({ ...form, ativo: v })} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>Cancelar</Button>
              <Button disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog isOpen={Boolean(apagar)} onClose={() => setApagar(null)} onConfirm={confirmarExclusao} title={`Excluir ${rotulo}`} confirmLabel="Excluir" loading={salvando} message={`Excluir "${apagar?.[colDescricao] ?? ''}"? Se estiver em uso, o banco recusa: nesse caso, inative.`} />
    </>
  );
}
