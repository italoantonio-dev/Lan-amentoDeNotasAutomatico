// Acesso pelo usuario do Sankhya: o e-mail liga o login do modulo ao usuario (TSIUSU) e o grupo dele
// define o perfil, por um mapa que o administrador mantem. As funcoes que leem o ERP (gruposSankhya,
// sincronizarUsuariosSankhya) sao publicadas por fase0/aplicar.mjs, pela porta unica.
import { ddl, sfSQL, sdk, projectId, consulta, NONCE, sqlAdmin, garantirPerfis, LOTE_CTE, jx, fim } from './lib/base.mjs';

const AGORA = `DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s')`;
const ADMIN = await sqlAdmin();
const perfis = await garantirPerfis();
const ATRIBUIVEIS = ['Administrador', 'Operador Financeiro', 'Aprovador'].map((n) => [n, Number(perfis[n])]);
const IDS = ATRIBUIVEIS.map(([, id]) => id).join(',');

await ddl(`CREATE TABLE SANKHYA_GRUPO_PERFIL (
  CODGRUPO INT PRIMARY KEY, NOMEGRUPO VARCHAR(100), PERFIL_ID INT NULL,
  ATUALIZADO_EM VARCHAR(19), ATUALIZADO_POR INT
) COMMENT 'Grupo de usuarios do Sankhya -> perfil do modulo. RETENCAO: tudo, configuracao'`);
await ddl(`CREATE TABLE USUARIO_SANKHYA (
  USUARIO_ID INT PRIMARY KEY, CODUSU INT, NOMEUSU VARCHAR(100), CODGRUPO INT, CODEMP INT, SINCRONIZADO_EM VARCHAR(19)
) COMMENT 'Login do modulo ligado ao usuario do Sankhya pelo e-mail. RETENCAO: tudo, uma linha por usuario, sobrescrita a cada sincronizacao'`);

await sfSQL('perfisAtribuiveisSankhya',
  `SELECT * FROM (${ATRIBUIVEIS.map(([n, id]) => `SELECT ${id} AS ID, '${n}' AS NOME`).join(' UNION ALL ')}) P WHERE ${NONCE} AND ${ADMIN}`,
  'Perfis que o mapa de grupos do Sankhya pode atribuir (somente administrador)');
await sfSQL('listarGrupoPerfilSankhya',
  `SELECT CODGRUPO, NOMEGRUPO, PERFIL_ID FROM SANKHYA_GRUPO_PERFIL WHERE ${NONCE} AND ${ADMIN} ORDER BY NOMEGRUPO`,
  'Mapa grupo do Sankhya -> perfil (somente administrador)');
await sfSQL('salvarGrupoPerfilSankhya',
  `INSERT INTO SANKHYA_GRUPO_PERFIL (CODGRUPO, NOMEGRUPO, PERFIL_ID, ATUALIZADO_EM, ATUALIZADO_POR)
   SELECT {{codgrupo}}, '{{nomeGrupo}}', NULLIF({{perfilId}}, 0), ${AGORA}, :VAR_USER FROM DUAL
   WHERE ${NONCE} AND ${ADMIN} AND ({{perfilId}} = 0 OR FIND_IN_SET({{perfilId}}, '${IDS}'))
   ON DUPLICATE KEY UPDATE NOMEGRUPO = VALUES(NOMEGRUPO), PERFIL_ID = VALUES(PERFIL_ID), ATUALIZADO_EM = VALUES(ATUALIZADO_EM), ATUALIZADO_POR = VALUES(ATUALIZADO_POR)`,
  'Liga um grupo do Sankhya a um perfil, ou desliga com perfilId 0 (somente administrador)');
await sfSQL('listarUsuariosModuloEmail',
  `SELECT ID, LOWER(TRIM(DESCR)) AS EMAIL FROM INT_USER WHERE ID > 0 AND ${NONCE} AND ${ADMIN}`,
  'Logins do modulo com e-mail, para ligar ao Sankhya (somente administrador)');
await sfSQL('gravarVinculosSankhya',
  `INSERT INTO USUARIO_SANKHYA (USUARIO_ID, CODUSU, NOMEUSU, CODGRUPO, CODEMP, SINCRONIZADO_EM)
   ${LOTE_CTE}
   SELECT ${jx('usuarioId')}, ${jx('codusu')}, ${jx('nomeusu')}, ${jx('codgrupo')}, ${jx('codemp')}, ${AGORA} FROM n, j
   WHERE ${NONCE} AND ${ADMIN} AND EXISTS (SELECT 1 FROM INT_USER U WHERE U.ID = ${jx('usuarioId')})
   ON DUPLICATE KEY UPDATE CODUSU = VALUES(CODUSU), NOMEUSU = VALUES(NOMEUSU), CODGRUPO = VALUES(CODGRUPO), CODEMP = VALUES(CODEMP), SINCRONIZADO_EM = VALUES(SINCRONIZADO_EM)`,
  'Grava em lote o vinculo login -> usuario do Sankhya (somente administrador)');
await sfSQL('listarVinculosSankhya',
  `SELECT U.ID, U.DESCR AS EMAIL, V.CODUSU, V.NOMEUSU, V.CODGRUPO, G.NOMEGRUPO, V.CODEMP, G.PERFIL_ID, V.SINCRONIZADO_EM
   FROM INT_USER U LEFT JOIN USUARIO_SANKHYA V ON V.USUARIO_ID = U.ID LEFT JOIN SANKHYA_GRUPO_PERFIL G ON G.CODGRUPO = V.CODGRUPO
   WHERE U.ID > 0 AND ${NONCE} AND ${ADMIN} ORDER BY U.DESCR LIMIT {{limite}} OFFSET {{offset}}`,
  'Logins do modulo e o usuario do Sankhya ligado a cada um (somente administrador)');

// Funcoes de administrador entram so no perfil Administrador. A lista e regravada inteira.
const nomes = ['perfisAtribuiveisSankhya', 'listarGrupoPerfilSankhya', 'salvarGrupoPerfilSankhya', 'listarUsuariosModuloEmail', 'gravarVinculosSankhya', 'listarVinculosSankhya'];
const mapa = new Map((await sdk.listServerFunctionsMitra({ projectId })).result.map((s) => [s.name, s.id]));
const atuais = (await consulta(`SELECT SERVERFUNCTIONID FROM INT_PROFILESERVERFUNCTION WHERE PROFILEID = ${Number(perfis.Administrador)}`)).map((r) => Number(r.SERVERFUNCTIONID));
const novos = nomes.map((n) => mapa.get(n)).filter((id) => id && !atuais.includes(id));
if (novos.length) await sdk.setProfileServerFunctionsMitra({ projectId, profileId: Number(perfis.Administrador), serverFunctionIds: [...atuais, ...novos] });
fim(`Acesso pelo Sankhya: ${nomes.length} funcoes, +${novos.length} no perfil Administrador.`);
