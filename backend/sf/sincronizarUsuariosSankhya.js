// Liga cada login do modulo ao usuario ativo do Sankhya com o mesmo e-mail e acrescenta o perfil do
// grupo dele, pelo mapa do administrador. Le o Sankhya, nunca grava nele. So acrescenta perfil:
// retirar alguem e feito na gestao de perfis. Atribuir perfil exige desenvolvedor (a plataforma recusa os demais).
const adm = await uma(SF.souAdministrador, {});
if (!adm || Number(adm.ADMIN) !== 1) return { ok: false, erro: 'Só o administrador sincroniza os acessos.' };
const usuarios = await listar(SF.listarUsuariosModuloEmail, {});
const mapa = new Map((await listar(SF.listarGrupoPerfilSankhya, {})).filter((g) => Number(g.PERFIL_ID)).map((g) => [Number(g.CODGRUPO), Number(g.PERFIL_ID)]));
let doErp;
try {
  doErp = await erpConsulta("SELECT U.CODUSU, U.NOMEUSU, LOWER(TRIM(U.EMAIL)) AS EMAIL, U.CODGRUPO, U.CODEMP FROM TSIUSU U WHERE U.EMAIL IS NOT NULL AND NVL(U.DTLIMACESSO, SYSDATE + 1) > SYSDATE");
} catch (e) {
  return { ok: false, erro: 'Não consegui ler os usuários do Sankhya: ' + msgErro(e) };
}
const porEmail = new Map();
for (const u of doErp) {
  const k = String(u.EMAIL || '');
  porEmail.set(k, porEmail.has(k) ? null : u); // e-mail repetido no Sankhya: ninguem e ligado
}
const vinculos = [];
const semUsuario = [];
const repetidos = [];
const semGrupo = [];
const porPerfil = new Map();
for (const m of usuarios) {
  const email = String(m.EMAIL || '');
  if (!porEmail.has(email)) { semUsuario.push(email); continue; }
  const s = porEmail.get(email);
  if (!s) { repetidos.push(email); continue; }
  vinculos.push({ usuarioId: Number(m.ID), codusu: Number(s.CODUSU), nomeusu: texto(s.NOMEUSU, 100), codgrupo: Number(s.CODGRUPO), codemp: Number(s.CODEMP) || null });
  const perfil = mapa.get(Number(s.CODGRUPO));
  if (!perfil) { semGrupo.push(email); continue; }
  if (!porPerfil.has(perfil)) porPerfil.set(perfil, []);
  porPerfil.get(perfil).push(Number(m.ID));
}
for (let i = 0; i < vinculos.length; i += 500) {
  await chamar(SF.gravarVinculosSankhya, { linhas: paraB64(JSON.stringify(vinculos.slice(i, i + 500))) });
}
const atribuidos = [];
const falhas = [];
for (const [profileId, userIds] of porPerfil) {
  try {
    await sdk.setProfileUsersMitra({ projectId: PROJECT_ID, profileId, userIds });
    atribuidos.push({ profileId, usuarios: userIds.length });
  } catch (e) {
    falhas.push({ profileId, erro: msgErro(e) });
  }
}
return { ok: falhas.length === 0, vinculados: vinculos.length, atribuidos, falhas, semUsuarioNoSankhya: semUsuario, emailRepetidoNoSankhya: repetidos, grupoSemPerfil: semGrupo,
  erro: falhas.length ? 'Os vínculos foram gravados, mas a plataforma recusou atribuir perfil: só um desenvolvedor do projeto atribui perfis.' : undefined };
