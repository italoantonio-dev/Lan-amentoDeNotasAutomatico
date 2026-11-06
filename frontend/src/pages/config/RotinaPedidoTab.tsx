import { useCallback, useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { callSF, execSF, SF } from '../../lib/api';
import { getMitraErrorMessage } from '../../lib/utils';
import { Card } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Checkbox from '../../components/ui/Checkbox';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { Aviso, EstadoErro, EstadoVazio } from '../../components/Comum';

type Linha = Record<string, any>;
interface Edicao { empresaId: number; nome: string; ativo: boolean; topPedido: string; topFaturamento: string; codtipvenda: string; codlocal: string; adm: string }

const num = (v: string) => Number(String(v).replace(/\D/g, '')) || 0;

export default function RotinaPedidoTab({ onAviso }: { onAviso: (t: 'success' | 'error', m: string) => void }) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [usuarios, setUsuarios] = useState<{ value: string; label: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [editar, setEditar] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [r, u] = await Promise.all([callSF(SF.listarRotinaPedido), callSF(SF.listarUsuariosAdm)]);
      setLinhas(r);
      setUsuarios([{ value: '0', label: 'Sem ADM definido' }, ...u.map((x) => ({ value: String(x.ID), label: String(x.EMAIL) }))]);
    } catch (e) { setErro(getMitraErrorMessage(e)); } finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const incompleto = editar ? !num(editar.topPedido) || !num(editar.codtipvenda) || !num(editar.codlocal) : true;

  async function salvar() {
    if (!editar) return;
    if (editar.ativo && incompleto) { onAviso('error', 'Para ligar, preencha a TOP do pedido, o tipo de venda e o local.'); return; }
    setSalvando(true);
    try {
      const r = await execSF<{ affectedRows?: number }>(SF.salvarRotinaPedido, {
        empresaId: editar.empresaId, ativo: editar.ativo ? 1 : 0, topPedido: num(editar.topPedido), topFaturamento: num(editar.topFaturamento),
        codtipvenda: num(editar.codtipvenda), codlocal: num(editar.codlocal), admUsuarioId: num(editar.adm),
      });
      if (!Number(r?.affectedRows)) throw new Error('Não salvou: só o administrador altera a rotina.');
      onAviso('success', 'Rotina de pedido salva.');
      setEditar(null);
      await carregar();
    } catch (e) { onAviso('error', getMitraErrorMessage(e)); } finally { setSalvando(false); }
  }

  return (
    <>
      <Aviso tipo="info">
        Com a rotina ligada, a nota fiscal lida com XML e sem pedido vira pedido de compra <strong>não confirmado</strong> no Sankhya. O ADM da loja confirma e pede a liberação, a liberação é feita no Sankhya e a contabilidade confirma a nota. O sistema nunca confirma. Rotina desligada: nada é lançado.
      </Aviso>
      <Card>
        {erro ? <EstadoErro mensagem={erro} onRetry={carregar} /> : carregando ? <SkeletonTable /> : linhas.length === 0 ? <EstadoVazio titulo="Nenhuma empresa ativa" /> : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>Empresa</th><th className="text-right">TOP pedido</th><th className="text-right">TOP faturamento</th><th className="text-right">Tipo de venda</th><th className="text-right">Local</th><th>ADM da loja</th><th>Rotina</th><th /></tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.EMPRESA_ID}>
                    <td className="font-medium text-fg">{l.NOME} <span className="text-fg-subtle tabular-nums">({l.CODEMP})</span></td>
                    <td className="text-right tabular-nums">{l.TOP_PEDIDO ?? '—'}</td>
                    <td className="text-right tabular-nums">{l.TOP_FATURAMENTO ?? '—'}</td>
                    <td className="text-right tabular-nums">{l.CODTIPVENDA ?? '—'}</td>
                    <td className="text-right tabular-nums">{l.CODLOCAL ?? '—'}</td>
                    <td className="text-fg-muted break-all">{l.ADM_EMAIL ?? '—'}</td>
                    <td>{Number(l.ATIVO) ? <Badge variant="success" dot>Ligada</Badge> : <Badge variant="neutral">Desligada</Badge>}</td>
                    <td className="text-right">
                      <Button size="sm" variant="ghost" aria-label="Editar rotina" onClick={() => setEditar({
                        empresaId: Number(l.EMPRESA_ID), nome: String(l.NOME), ativo: Number(l.ATIVO) === 1, topPedido: String(l.TOP_PEDIDO ?? ''), topFaturamento: String(l.TOP_FATURAMENTO ?? ''),
                        codtipvenda: String(l.CODTIPVENDA ?? ''), codlocal: String(l.CODLOCAL ?? ''), adm: String(l.ADM_USUARIO_ID ?? '0'),
                      })}><Pencil size={16} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal isOpen={Boolean(editar)} onClose={() => setEditar(null)} title="Rotina de pedido">
        {editar && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-fg-muted">{editar.nome}</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="TOP do pedido" inputMode="numeric" value={editar.topPedido} onChange={(e) => setEditar({ ...editar, topPedido: e.target.value })} placeholder="Ex.: 1314" />
              <Input label="TOP do faturamento" inputMode="numeric" value={editar.topFaturamento} onChange={(e) => setEditar({ ...editar, topFaturamento: e.target.value })} placeholder="Ex.: 1419" />
              <Input label="Tipo de venda" inputMode="numeric" value={editar.codtipvenda} onChange={(e) => setEditar({ ...editar, codtipvenda: e.target.value })} placeholder="Ex.: 16" />
              <Input label="Local de estoque" inputMode="numeric" value={editar.codlocal} onChange={(e) => setEditar({ ...editar, codlocal: e.target.value })} placeholder="Ex.: 101" />
            </div>
            <Select label="ADM da loja" options={usuarios} value={editar.adm} onChange={(v) => setEditar({ ...editar, adm: v })} />
            <Checkbox label="Rotina ligada: lançar pedido no Sankhya" checked={editar.ativo} onChange={(v) => setEditar({ ...editar, ativo: v })} />
            {editar.ativo && incompleto && <p className="text-[12.5px] text-danger-text">Para ligar, preencha a TOP do pedido, o tipo de venda e o local.</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setEditar(null)}>Cancelar</Button>
              <Button disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
