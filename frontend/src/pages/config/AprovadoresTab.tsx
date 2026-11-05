import { useCallback, useEffect, useState } from 'react';
import { Download, Pencil, Plus } from 'lucide-react';
import { callSF, exigirAfetou, execSF, SF } from '../../lib/api';
import { formatarMoeda } from '../../lib/formato';
import { getMitraErrorMessage } from '../../lib/utils';
import { situacaoVinculo } from '../../lib/vinculoEmail';
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
const VAZIO = { codusu: '', nome: '', email: '', grupo: '', limite: '', ativo: true };

export default function AprovadoresTab({ onAviso }: { onAviso: (t: 'success' | 'error', m: string) => void }) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState<typeof VAZIO | null>(null);
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [usuariosErp, setUsuariosErp] = useState<Linha[] | null>(null);
  const [lendoErp, setLendoErp] = useState(false);
  const [editando, setEditando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try { setLinhas(await callSF(SF.listarAprovadores)); } catch (e) { setErro(getMitraErrorMessage(e)); } finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function importarDoErp() {
    setLendoErp(true);
    setErroForm('');
    try {
      const r = await execSF<Linha>(SF.sankhyaUsuarios);
      const b = r?.body;
      if (String(b?.status) !== '1' || !b?.responseBody) throw new Error(b?.statusMessage || 'Integração com o ERP não configurada.');
      const cols: string[] = b.responseBody.fieldsMetadata.map((f: Linha) => f.name);
      setUsuariosErp((b.responseBody.rows as unknown[][]).map((l) => Object.fromEntries(cols.map((c, i) => [c, l[i]]))));
    } catch (e) {
      setUsuariosErp([]);
      setErroForm(`Não consegui ler os usuários do ERP: ${getMitraErrorMessage(e)}. Você pode cadastrar à mão, com o código do usuário.`);
    } finally { setLendoErp(false); }
  }

  const abrir = (l?: Linha) => {
    setErroForm('');
    setEditando(Boolean(l));
    setForm(l ? { codusu: String(l.CODUSU), nome: String(l.NOME), email: String(l.EMAIL ?? ''), grupo: String(l.GRUPO ?? ''), limite: l.LIMITE_ALCADA == null ? '' : String(l.LIMITE_ALCADA), ativo: Number(l.ATIVO) === 1 } : VAZIO);
    if (!l && !usuariosErp) importarDoErp();
  };

  const escolherErp = (cod: string) => {
    const u = usuariosErp?.find((x) => String(x.CODUSU) === cod);
    if (!u || !form) return;
    setForm({ ...form, codusu: cod, nome: String(u.NOMEUSU ?? ''), email: String(u.EMAIL ?? ''), grupo: String(u.CODGRUPO ?? ''), limite: u.VLRMAXAUT == null ? form.limite : String(u.VLRMAXAUT) });
  };

  async function salvar() {
    if (!form) return;
    if (!/^\d+$/.test(form.codusu.trim())) { setErroForm('Informe o código do usuário no ERP.'); return; }
    if (!form.nome.trim()) { setErroForm('Informe o nome.'); return; }
    const limite = form.limite.trim().replace(',', '.');
    if (limite && !Number.isFinite(Number(limite))) { setErroForm('Alçada inválida.'); return; }
    setSalvando(true);
    try {
      await exigirAfetou(SF.salvarAprovador, { codusu: Number(form.codusu), nome: form.nome.trim(), email: form.email.trim(), grupo: form.grupo, limite, ativo: form.ativo ? 1 : 0 }, 'Sem permissão: nada foi salvo.');
      setForm(null);
      onAviso('success', 'Aprovador salvo.');
      carregar();
    } catch (e) { setErroForm(getMitraErrorMessage(e)); } finally { setSalvando(false); }
  }

  const ativos = linhas.filter((l) => Number(l.ATIVO) === 1).length;
  return (
    <>
      {ativos === 0 && !carregando && <Aviso tipo="warning">Sem aprovador ativo, nenhuma decisão pode ser tomada. Para decidir, o aprovador precisa de login com o mesmo e-mail, perfil Aprovador, teto definido e empresas liberadas.</Aviso>}
      <div className="flex justify-end mb-4"><Button onClick={() => abrir()}><Plus size={16} /> Adicionar aprovador</Button></div>
      <Card>
        {erro ? <EstadoErro mensagem={erro} onRetry={carregar} /> : carregando ? <SkeletonTable /> : linhas.length === 0 ? (
          <EstadoVazio titulo="Nenhum aprovador" descricao="Traga do ERP: o sistema aproveita a alçada de lá como ponto de partida e casa o login pelo e-mail." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>Aprovador</th><th>Vínculo com o login</th><th className="text-right">Alçada</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {linhas.map((l) => {
                  const v = situacaoVinculo(l);
                  return (
                    <tr key={l.ID}>
                      <td><div className="font-medium text-fg">{l.NOME}</div><div className="text-[12px] text-fg-muted tabular-nums">Usuário {l.CODUSU}{l.GRUPO ? ` · grupo ${l.GRUPO}` : ''}</div></td>
                      <td><Badge variant={v.vinculado ? 'success' : 'warning'}>{v.vinculado ? 'Vinculado' : 'Sem login'}</Badge><div className="text-[12px] text-fg-muted mt-1">{v.texto}</div></td>
                      <td className="text-right tabular-nums">{l.LIMITE_ALCADA == null ? 'Qualquer valor' : formatarMoeda(l.LIMITE_ALCADA)}</td>
                      <td><Badge variant={Number(l.ATIVO) === 1 ? 'success' : 'neutral'}>{Number(l.ATIVO) === 1 ? 'Ativo' : 'Inativo'}</Badge></td>
                      <td className="text-right"><Button size="sm" variant="ghost" aria-label="Editar" onClick={() => abrir(l)}><Pencil size={16} /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal isOpen={Boolean(form)} onClose={() => setForm(null)} title={editando ? 'Editar aprovador' : 'Adicionar aprovador'}>
        {form && (
          <div className="flex flex-col gap-3">
            {erroForm && <Aviso tipo="info">{erroForm}</Aviso>}
            {!editando && (
              <div className="flex items-end gap-2">
                <div className="flex-1"><Select label="Usuário do ERP" options={(usuariosErp ?? []).map((u) => ({ value: String(u.CODUSU), label: `${u.CODUSU} · ${u.NOMEUSU}` }))} value={form.codusu} onChange={escolherErp} placeholder={lendoErp ? 'Lendo o ERP...' : 'Selecione...'} /></div>
                <Button variant="secondary" aria-label="Recarregar usuários do ERP" disabled={lendoErp} onClick={importarDoErp}><Download size={16} /></Button>
              </div>
            )}
            <Input label="Código do usuário no ERP" value={form.codusu} disabled={editando} onChange={(e) => setForm({ ...form, codusu: e.target.value })} />
            <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <div>
              <Input label="E-mail de login" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <p className="text-[12.5px] text-fg-muted mt-1.5">É o e-mail que liga o aprovador do ERP a um login daqui. Sem ele, o cadastro existe, mas ninguém aprova em nome dele.</p>
            </div>
            <div>
              <Input label="Alçada (R$)" inputMode="decimal" value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value })} placeholder="Vazio = aprova qualquer valor" />
            </div>
            <Checkbox label="Ativo (inativar preserva o histórico)" checked={form.ativo} onChange={(v) => setForm({ ...form, ativo: v })} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>Cancelar</Button>
              <Button disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
