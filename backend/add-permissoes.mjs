// Etapa 16 - Permissoes. Administrador e o perfil da plataforma (INT_PROFILEUSER); aqui fica
// so o alcance por tipo de documento. Quem decide e a SF: esconder o menu e cortesia.
import { sfSQL, sfJS, NONCE, sqlAdmin, garantirPerfis, fim } from './lib/base.mjs';

const AGORA = `DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s')`;
const ADMIN = await sqlAdmin();
const { Administrador: PERFIL_ADMIN } = await garantirPerfis();

await sfSQL(
  'permissoesUsuarioAtual',
  `SELECT U.ID, U.DESCR AS EMAIL, U.ISDEV,
     CASE WHEN ${ADMIN} THEN 1 ELSE 0 END AS ADMINISTRADOR,
     (SELECT COUNT(*) FROM INT_PROFILEUSER WHERE PROFILEID = ${PERFIL_ADMIN}) AS TOTAL_ADMINS,
     ${PERFIL_ADMIN} AS PERFIL_ADMIN_ID,
     COALESCE((SELECT PU.TODOS_OS_TIPOS FROM PERMISSOES_USUARIO PU WHERE PU.USUARIO_ID = :VAR_USER), 1) AS TODOS_OS_TIPOS,
     (SELECT GROUP_CONCAT(PT.TIPO_DOCUMENTO_ID) FROM PERMISSAO_TIPO_DOCUMENTO PT WHERE PT.USUARIO_ID = :VAR_USER) AS TIPOS
   FROM INT_USER U WHERE U.ID = :VAR_USER AND ${NONCE}`,
  'Quem esta logado: administrador e tipos que enxerga',
);
await sfSQL(
  'tiposVisiveisUsuario',
  `SELECT T.ID, T.CODIGO, T.DESCRICAO, T.DESTINO_PADRAO, T.TIPMOV_ESPERADO FROM TIPOS_DOCUMENTO T
   WHERE ${NONCE} AND (NOT EXISTS (SELECT 1 FROM PERMISSOES_USUARIO PU WHERE PU.USUARIO_ID = :VAR_USER AND PU.TODOS_OS_TIPOS = FALSE)
     OR T.ID IN (SELECT PT.TIPO_DOCUMENTO_ID FROM PERMISSAO_TIPO_DOCUMENTO PT WHERE PT.USUARIO_ID = :VAR_USER))
   ORDER BY T.ID`,
  'Tipos de documento que o usuario logado enxerga',
);
await sfSQL(
  'listarUsuariosPermissoes',
  `SELECT U.ID, U.DESCR AS EMAIL, U.ISDEV,
     CASE WHEN EXISTS (SELECT 1 FROM INT_PROFILEUSER PF WHERE PF.USERID = U.ID AND PF.PROFILEID = ${PERFIL_ADMIN}) THEN 1 ELSE 0 END AS ADMINISTRADOR,
     COALESCE(P.TODOS_OS_TIPOS, 1) AS TODOS_OS_TIPOS,
     (SELECT GROUP_CONCAT(PT.TIPO_DOCUMENTO_ID) FROM PERMISSAO_TIPO_DOCUMENTO PT WHERE PT.USUARIO_ID = U.ID) AS TIPOS
   FROM INT_USER U LEFT JOIN PERMISSOES_USUARIO P ON P.USUARIO_ID = U.ID
   WHERE U.ID > 0 AND ${NONCE} AND ${ADMIN} ORDER BY U.DESCR LIMIT {{limite}} OFFSET {{offset}}`,
  'Usuarios com seus acessos (somente administrador)',
);
await sfSQL(
  'gravarPermissaoUsuario',
  `INSERT INTO PERMISSOES_USUARIO (USUARIO_ID, TODOS_OS_TIPOS, ATUALIZADO_EM, ATUALIZADO_POR)
   SELECT {{usuarioId}}, {{todos}}, ${AGORA}, :VAR_USER FROM DUAL WHERE ${NONCE} AND ${ADMIN}
   ON DUPLICATE KEY UPDATE TODOS_OS_TIPOS = VALUES(TODOS_OS_TIPOS), ATUALIZADO_EM = VALUES(ATUALIZADO_EM), ATUALIZADO_POR = VALUES(ATUALIZADO_POR)`,
  'Grava se o usuario enxerga todos os tipos (somente administrador)',
);
await sfSQL(
  'limparTiposUsuario',
  `DELETE FROM PERMISSAO_TIPO_DOCUMENTO WHERE USUARIO_ID = {{usuarioId}} AND ${NONCE} AND ${ADMIN}`,
  'Limpa os tipos liberados do usuario (somente administrador)',
);
await sfSQL(
  'gravarTiposUsuario',
  `INSERT INTO PERMISSAO_TIPO_DOCUMENTO (USUARIO_ID, TIPO_DOCUMENTO_ID)
   SELECT {{usuarioId}}, T.ID FROM TIPOS_DOCUMENTO T WHERE FIND_IN_SET(T.ID, '{{tipos}}') AND ${NONCE} AND ${ADMIN}`,
  'Grava os tipos liberados do usuario (somente administrador)',
);
await sfJS('salvarPermissoesUsuario', ['sf/_comum.js', 'sf/salvarPermissoesUsuario.js'], 'Grava o alcance por tipo de documento de um usuario (somente administrador).');
fim('Permissoes prontas.');
