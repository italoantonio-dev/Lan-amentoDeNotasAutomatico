import { useCallback, useEffect, useState } from 'react';
import { setProfileUsersMitra } from 'mitra-interactions-sdk';
import { Pencil, ShieldCheck } from 'lucide-react';
import { callSF, execSF, PROJECT_ID, SF } from '../../lib/api';
import { getMitraErrorMessage } from '../../lib/utils';
import { Card } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Checkbox from '../../components/ui/Checkbox';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Modal from '../../components/ui/Modal';
import MultiSelect from '../../components/ui/MultiSelect';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { Aviso, EstadoErro, EstadoVazio, Paginacao } from '../../components/Comum';

type Linha = Record<string, any>;
const POR_PAGINA = 30;

export default function PermissoesTab({ perm, onAviso }: { perm: { isDev: boolean; perfilAdminId: number; totalAdmins: number; recarregar: () => void }; onAviso: (t: 'success' | 'error', m: string) => void }) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [tipos, setTipos] = useState<{ value: string; label: string }[]>([]);
  const [pagina, setPagina] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [editar, setEditar] = useState<{ id: number; email: string; todos: boolean; tipos: string[] } | null>(null);
  const [promover, setPromover] = useState<Linha | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [u, t] = await Promise.all([callSF(SF.listarUsuariosPermissoes, { limite: POR_PAGINA, offset: pagina * POR_PAGINA }), callSF(SF.listarTiposDocumento)]);
      setLinhas(u);
      setTipos(t.map((x) => ({ value: String(x.ID), label: String(x.DESCRICAO) })));
    } catch (e) { setErro(getMitraErrorMessage(e)); } finally { setCarregando(false); }
  }, [pagina]);
  useEffect(() => { carregar(); }, [carregar]);

  const nomesTipos = (csv: string | null) => (csv ? csv.split(',').map((i) => tipos.find((t) => t.value === i)?.label ?? i).join(', ') : 'Nenhum tipo');

  async function salvarAlcance() {
    if (!editar) return;
    setSalvando(true);
    try {
      const r = await execSF<{ ok: boolean; erro?: string }>(SF.salvarPermissoesUsuario, { usuarioId: editar.id, todos: editar.todos ? 1 : 0, tipos: editar.tipos.map(Number) });
      if (!r.ok) throw new Error(r.erro);
      setEditar(null);
      onAviso('success', 'Acesso salvo.');
      carregar();
    } catch (e) { onAviso('error', getMitraErrorMessage(e)); } finally { setSalvando(false); }
  }

  async function tornarAdmin() {
    if (!promover) return;
    setSalvando(true);
    try {
      await setProfileUsersMitra({ projectId: PROJECT_ID, profileId: perm.perfilAdminId, userIds: [Number(promover.ID)] });
      onAviso('success', `${promover.EMAIL} agora é administrador.`);
      perm.recarregar();
      carregar();
    } catch (e) { onAviso('error', getMitraErrorMessage(e)); } finally { setPromover(null); setSalvando(false); }
  }

  return (
    <>
      {perm.totalAdmins === 0 && (
        <Aviso tipo="warning">Ninguém é administrador: todo usuário logado altera cadastros, parâmetros e o corte de leitura. Marque quem administra para fechar este estado{perm.isDev ? '.' : ': só um desenvolvedor do projeto consegue marcar o primeiro.'}</Aviso>
      )}
      <Aviso tipo="info">
        Administrador é o perfil “Administrador” da plataforma. Só desenvolvedor do projeto marca alguém aqui{perm.isDev ? '' : ' (você não é)'}; retirar alguém desse perfil é feito na gestão de perfis da plataforma, porque esta tela só consegue acrescentar.
      </Aviso>
      <Card>
        {erro ? <EstadoErro mensagem={erro} onRetry={carregar} /> : carregando ? <SkeletonTable /> : linhas.length === 0 ? <EstadoVazio titulo="Nenhum usuário" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead><tr><th>Usuário</th><th>Administrador</th><th>Tipos de documento que enxerga</th><th /></tr></thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.ID}>
                      <td className="font-medium text-fg break-all">{l.EMAIL}</td>
                      <td>{Number(l.ADMINISTRADOR) === 1 ? <Badge variant="success" dot>Administrador</Badge> : perm.isDev ? <Button size="sm" variant="ghost" onClick={() => setPromover(l)}><ShieldCheck size={16} /> Tornar administrador</Button> : <span className="text-fg-muted">—</span>}</td>
                      <td className="text-fg-muted">{Number(l.TODOS_OS_TIPOS) === 1 ? 'Todos' : nomesTipos(l.TIPOS)}</td>
                      <td className="text-right"><Button size="sm" variant="ghost" aria-label="Editar acesso" onClick={() => setEditar({ id: l.ID, email: l.EMAIL, todos: Number(l.TODOS_OS_TIPOS) === 1, tipos: l.TIPOS ? String(l.TIPOS).split(',') : [] })}><Pencil size={16} /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} total={linhas.length === POR_PAGINA ? (pagina + 2) * POR_PAGINA : pagina * POR_PAGINA + linhas.length} porPagina={POR_PAGINA} onMudar={setPagina} />
          </>
        )}
      </Card>
      <Modal isOpen={Boolean(editar)} onClose={() => setEditar(null)} title="Tipos de documento">
        {editar && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-fg-muted break-all">{editar.email}</p>
            <Checkbox label="Enxerga todos os tipos" checked={editar.todos} onChange={(v) => setEditar({ ...editar, todos: v })} />
            {!editar.todos && <MultiSelect label="Tipos liberados" options={tipos} values={editar.tipos} onChange={(v) => setEditar({ ...editar, tipos: v })} placeholder="Nenhum tipo" />}
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="secondary" onClick={() => setEditar(null)}>Cancelar</Button>
              <Button disabled={salvando} onClick={salvarAlcance}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog isOpen={Boolean(promover)} onClose={() => setPromover(null)} onConfirm={tornarAdmin} title="Tornar administrador" confirmLabel="Confirmar" loading={salvando}
        message={`${promover?.EMAIL ?? ''} passa a administrar cadastros, parâmetros, aprovadores e o corte de leitura. Depois disso, quem não é administrador deixa de entrar em Configuração. Esta tela não retira o papel.`} />
    </>
  );
}
