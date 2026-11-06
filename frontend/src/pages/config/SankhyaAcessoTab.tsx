import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { callSF, execSF, SF } from '../../lib/api';
import { getMitraErrorMessage } from '../../lib/utils';
import { formatarDataHora } from '../../lib/formato';
import { Card } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { Aviso, EstadoErro, EstadoVazio, Paginacao } from '../../components/Comum';

type Linha = Record<string, any>;
interface Resultado { ok: boolean; erro?: string; vinculados?: number; atribuidos?: { profileId: number; usuarios: number }[]; semUsuarioNoSankhya?: string[]; emailRepetidoNoSankhya?: string[]; grupoSemPerfil?: string[] }
const POR_PAGINA = 30;

export default function SankhyaAcessoTab({ isDev, onAviso }: { isDev: boolean; onAviso: (t: 'success' | 'error', m: string) => void }) {
  const [grupos, setGrupos] = useState<Linha[]>([]);
  const [mapa, setMapa] = useState<Record<number, string>>({});
  const [perfis, setPerfis] = useState<{ value: string; label: string }[]>([]);
  const [vinculos, setVinculos] = useState<Linha[]>([]);
  const [pagina, setPagina] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const carregarVinculos = useCallback(async () => {
    try { setVinculos(await callSF(SF.listarVinculosSankhya, { limite: POR_PAGINA, offset: pagina * POR_PAGINA })); } catch (e) { onAviso('error', getMitraErrorMessage(e)); }
  }, [pagina, onAviso]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      // Mapa e perfis vem do banco (rapido); os grupos sao lidos do Sankhya.
      const [m, p] = await Promise.all([callSF(SF.listarGrupoPerfilSankhya), callSF(SF.perfisAtribuiveisSankhya)]);
      setMapa(Object.fromEntries(m.map((x) => [Number(x.CODGRUPO), x.PERFIL_ID ? String(x.PERFIL_ID) : '0'])));
      setPerfis([{ value: '0', label: 'Sem acesso' }, ...p.map((x) => ({ value: String(x.ID), label: String(x.NOME) }))]);
      const g = await execSF<{ ok: boolean; erro?: string; grupos?: Linha[] }>(SF.gruposSankhya);
      if (!g.ok) throw new Error(g.erro ?? 'Não consegui ler os grupos do Sankhya.');
      setGrupos(g.grupos ?? []);
    } catch (e) { setErro(getMitraErrorMessage(e)); } finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarVinculos(); }, [carregarVinculos]);

  async function mudarPerfil(g: Linha, perfilId: string) {
    const antes = mapa[Number(g.CODGRUPO)] ?? '0';
    setMapa({ ...mapa, [Number(g.CODGRUPO)]: perfilId });
    try {
      const r = await execSF<{ affectedRows?: number }>(SF.salvarGrupoPerfilSankhya, { codgrupo: Number(g.CODGRUPO), nomeGrupo: String(g.NOMEGRUPO), perfilId: Number(perfilId) });
      if (!Number(r?.affectedRows)) throw new Error('Sem permissão: só o administrador altera o mapa.');
    } catch (e) {
      setMapa((m) => ({ ...m, [Number(g.CODGRUPO)]: antes }));
      onAviso('error', getMitraErrorMessage(e));
    }
  }

  async function sincronizar() {
    setSincronizando(true);
    try {
      const r = await execSF<Resultado>(SF.sincronizarUsuariosSankhya);
      setResultado(r);
      if (r.ok) onAviso('success', `${r.vinculados ?? 0} login(s) ligados ao Sankhya.`);
      else onAviso('error', r.erro ?? 'A sincronização não terminou.');
      await carregarVinculos();
    } catch (e) { onAviso('error', getMitraErrorMessage(e)); } finally { setSincronizando(false); }
  }

  const nomePerfil = (id: unknown) => perfis.find((p) => p.value === String(id ?? '0'))?.label ?? 'Sem acesso';

  return (
    <>
      <Aviso tipo="info" acao={<Button size="sm" disabled={!isDev || sincronizando} onClick={sincronizar}><RefreshCw size={16} /> {sincronizando ? 'Sincronizando...' : 'Sincronizar agora'}</Button>}>
        O login entra pelo e-mail: o usuário ativo do Sankhya com o mesmo e-mail recebe o perfil do grupo dele. A sincronização só lê o Sankhya e só acrescenta perfis; retirar alguém é feito na gestão de perfis. {isDev ? '' : 'Só um desenvolvedor do projeto sincroniza (você não é).'}
      </Aviso>
      {resultado && (
        <Aviso tipo={resultado.ok ? 'success' : 'warning'}>
          {resultado.erro ? `${resultado.erro} ` : ''}{resultado.vinculados ?? 0} ligado(s); {(resultado.atribuidos ?? []).map((a) => `${nomePerfil(a.profileId)}: ${a.usuarios}`).join(', ') || 'nenhum perfil atribuído'}.
          {(resultado.semUsuarioNoSankhya?.length ?? 0) > 0 && ` Sem usuário ativo com o mesmo e-mail no Sankhya: ${resultado.semUsuarioNoSankhya!.join(', ')}.`}
          {(resultado.emailRepetidoNoSankhya?.length ?? 0) > 0 && ` E-mail em mais de um usuário do Sankhya (não ligado): ${resultado.emailRepetidoNoSankhya!.join(', ')}.`}
          {(resultado.grupoSemPerfil?.length ?? 0) > 0 && ` Grupo sem perfil no mapa: ${resultado.grupoSemPerfil!.join(', ')}.`}
        </Aviso>
      )}
      <Card>
        <div className="px-5 py-4 border-b border-border-subtle"><h2 className="text-[14px] font-medium text-fg">Grupos do Sankhya</h2></div>
        {erro ? <EstadoErro mensagem={erro} onRetry={carregar} /> : carregando ? <SkeletonTable /> : grupos.length === 0 ? <EstadoVazio titulo="Nenhum grupo com usuário ativo" /> : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>Grupo</th><th className="text-right">Usuários ativos</th><th className="text-right">Com e-mail</th><th>Perfil no módulo</th></tr></thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.CODGRUPO}>
                    <td className="font-medium text-fg">{g.NOMEGRUPO} <span className="text-fg-subtle tabular-nums">({g.CODGRUPO})</span></td>
                    <td className="text-right tabular-nums">{g.ATIVOS}</td>
                    <td className="text-right tabular-nums">{g.COM_EMAIL}</td>
                    <td className="min-w-[200px]"><Select variant="inline" options={perfis} value={mapa[Number(g.CODGRUPO)] ?? '0'} onChange={(v) => mudarPerfil(g, v)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card>
        <div className="px-5 py-4 border-b border-border-subtle"><h2 className="text-[14px] font-medium text-fg">Logins e usuário do Sankhya</h2></div>
        {vinculos.length === 0 ? <EstadoVazio titulo="Nenhum login" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead><tr><th>Login</th><th>Usuário do Sankhya</th><th>Grupo</th><th className="text-right">Empresa</th><th>Perfil pelo grupo</th><th>Sincronizado</th></tr></thead>
                <tbody>
                  {vinculos.map((v) => (
                    <tr key={v.ID}>
                      <td className="font-medium text-fg break-all">{v.EMAIL}</td>
                      <td>{v.CODUSU ? `${v.NOMEUSU} (${v.CODUSU})` : <Badge variant="neutral">Não ligado</Badge>}</td>
                      <td className="text-fg-muted">{v.NOMEGRUPO ?? (v.CODGRUPO ?? '')}</td>
                      <td className="text-right tabular-nums">{v.CODEMP ?? ''}</td>
                      <td>{v.CODUSU ? (v.PERFIL_ID ? <Badge variant="success">{nomePerfil(v.PERFIL_ID)}</Badge> : <Badge variant="warning">Sem perfil no mapa</Badge>) : ''}</td>
                      <td className="text-fg-muted">{v.SINCRONIZADO_EM ? formatarDataHora(v.SINCRONIZADO_EM) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} total={vinculos.length === POR_PAGINA ? (pagina + 2) * POR_PAGINA : pagina * POR_PAGINA + vinculos.length} porPagina={POR_PAGINA} onMudar={setPagina} />
          </>
        )}
      </Card>
    </>
  );
}
