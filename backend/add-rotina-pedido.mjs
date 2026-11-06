// Rotina de pedido: a nota lida vira pedido de compra NAO confirmado no Sankhya. O ADM da loja confirma
// e pede liberacao, a liberacao e do Sankhya, e o faturamento vem depois. Configuracao por empresa:
// sem TOP de pedido, tipo de venda e local preenchidos e a rotina ligada, nada e lancado.
// lancarPedidoErp (le e grava no ERP) e publicada por fase0/aplicar.mjs, pela porta unica.
import { ddl, sfSQL, sdk, projectId, consulta, NONCE, sqlAdmin, garantirPerfis, garantirColuna, VISIVEL, fim } from './lib/base.mjs';

const AGORA = `DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s')`;
const ADMIN = await sqlAdmin();
const perfis = await garantirPerfis();
const COM_PERFIL = `EXISTS (SELECT 1 FROM INT_PROFILEUSER PU WHERE PU.USERID = :VAR_USER AND FIND_IN_SET(PU.PROFILEID, '${[perfis.Administrador, perfis['Operador Financeiro'], perfis.Aprovador].map(Number).join(',')}'))`;

await ddl(`CREATE TABLE ROTINA_PEDIDO_EMPRESA (
  EMPRESA_ID INT PRIMARY KEY, ATIVO BOOLEAN DEFAULT FALSE, TOP_PEDIDO INT NULL, TOP_FATURAMENTO INT NULL,
  CODTIPVENDA INT NULL, CODLOCAL INT NULL, ADM_USUARIO_ID INT NULL, ATUALIZADO_EM VARCHAR(19), ATUALIZADO_POR INT,
  FOREIGN KEY (EMPRESA_ID) REFERENCES EMPRESAS(ID)
) COMMENT 'Rotina de pedido por empresa: TOPs, tipo de venda, local e ADM da loja. RETENCAO: tudo, configuracao'`);
await garantirColuna('LANCAMENTOS', 'PEDIDO_NUNOTA', 'INT NULL');

await sfSQL('listarRotinaPedido',
  `SELECT E.ID AS EMPRESA_ID, E.CODEMP, E.NOME, COALESCE(R.ATIVO, FALSE) AS ATIVO, R.TOP_PEDIDO, R.TOP_FATURAMENTO, R.CODTIPVENDA, R.CODLOCAL, R.ADM_USUARIO_ID, U.DESCR AS ADM_EMAIL
   FROM EMPRESAS E LEFT JOIN ROTINA_PEDIDO_EMPRESA R ON R.EMPRESA_ID = E.ID LEFT JOIN INT_USER U ON U.ID = R.ADM_USUARIO_ID
   WHERE E.ATIVO = TRUE AND ${NONCE} AND ${ADMIN} ORDER BY E.CODEMP`,
  'Configuracao da rotina de pedido por empresa (somente administrador)');
await sfSQL('salvarRotinaPedido',
  `INSERT INTO ROTINA_PEDIDO_EMPRESA (EMPRESA_ID, ATIVO, TOP_PEDIDO, TOP_FATURAMENTO, CODTIPVENDA, CODLOCAL, ADM_USUARIO_ID, ATUALIZADO_EM, ATUALIZADO_POR)
   SELECT E.ID, {{ativo}} = 1, NULLIF({{topPedido}}, 0), NULLIF({{topFaturamento}}, 0), NULLIF({{codtipvenda}}, 0), NULLIF({{codlocal}}, 0),
     (SELECT U.ID FROM INT_USER U WHERE U.ID = {{admUsuarioId}} AND U.ID > 0), ${AGORA}, :VAR_USER
   FROM EMPRESAS E WHERE E.ID = {{empresaId}} AND ${NONCE} AND ${ADMIN}
     AND ({{ativo}} = 0 OR ({{topPedido}} > 0 AND {{codtipvenda}} > 0 AND {{codlocal}} > 0))
   ON DUPLICATE KEY UPDATE ATIVO = VALUES(ATIVO), TOP_PEDIDO = VALUES(TOP_PEDIDO), TOP_FATURAMENTO = VALUES(TOP_FATURAMENTO), CODTIPVENDA = VALUES(CODTIPVENDA),
     CODLOCAL = VALUES(CODLOCAL), ADM_USUARIO_ID = VALUES(ADM_USUARIO_ID), ATUALIZADO_EM = VALUES(ATUALIZADO_EM), ATUALIZADO_POR = VALUES(ATUALIZADO_POR)`,
  'Grava a rotina de pedido de uma empresa; ligar exige TOP de pedido, tipo de venda e local (somente administrador)');
await sfSQL('listarUsuariosAdm',
  `SELECT ID, DESCR AS EMAIL FROM INT_USER WHERE ID > 0 AND ${NONCE} AND ${ADMIN} ORDER BY DESCR LIMIT 500`,
  'Logins para escolher o ADM da loja (somente administrador)');
await sfSQL('podeLancarPedido',
  `SELECT CASE WHEN ${COM_PERFIL} THEN 1 ELSE 0 END AS PODE FROM DUAL WHERE ${NONCE}`,
  'Diz se o usuario logado pode lancar pedido no ERP (Administrador, Operador Financeiro ou Aprovador)');
await sfSQL('rotinaPedidoDoLancamento',
  `SELECT L.ID, L.PEDIDO_NUNOTA, R.ATIVO, R.TOP_PEDIDO, R.CODTIPVENDA, R.CODLOCAL, TD.CODIGO AS TIPO
   FROM LANCAMENTOS L JOIN DOCUMENTOS D ON D.ID = L.DOCUMENTO_ID JOIN TIPOS_DOCUMENTO TD ON TD.ID = D.TIPO_DOCUMENTO_ID
   LEFT JOIN ROTINA_PEDIDO_EMPRESA R ON R.EMPRESA_ID = L.EMPRESA_ID
   WHERE L.ID = {{id}} AND ${NONCE} AND ${VISIVEL()}`,
  'Rotina de pedido da empresa do lancamento e o pedido ja lancado');
// Reserva antes da rede: -1 marca "lancando". So reserva quem ainda nao tem pedido.
await sfSQL('reservarPedidoLancamento',
  `UPDATE LANCAMENTOS L SET L.PEDIDO_NUNOTA = -1 WHERE L.ID = {{id}} AND L.PEDIDO_NUNOTA IS NULL AND ${NONCE} AND ${COM_PERFIL}`,
  'Reserva o lancamento para lancar o pedido (evita pedido em dobro)');
await sfSQL('concluirPedidoLancamento',
  `UPDATE LANCAMENTOS L SET L.PEDIDO_NUNOTA = NULLIF({{nunota}}, 0) WHERE L.ID = {{id}} AND L.PEDIDO_NUNOTA = -1 AND ${NONCE} AND ${COM_PERFIL}`,
  'Grava o NUNOTA do pedido lancado, ou libera a reserva com 0');

const nomesAdmin = ['listarRotinaPedido', 'salvarRotinaPedido', 'listarUsuariosAdm'];
const nomesTodos = ['podeLancarPedido', 'rotinaPedidoDoLancamento', 'reservarPedidoLancamento', 'concluirPedidoLancamento'];
const mapa = new Map((await sdk.listServerFunctionsMitra({ projectId })).result.map((s) => [s.name, s.id]));
for (const [nome, profileId] of Object.entries(perfis)) {
  if (!['Administrador', 'Operador Financeiro', 'Aprovador'].includes(nome)) continue;
  const atuais = (await consulta(`SELECT SERVERFUNCTIONID FROM INT_PROFILESERVERFUNCTION WHERE PROFILEID = ${Number(profileId)}`)).map((r) => Number(r.SERVERFUNCTIONID));
  const querem = [...(nome === 'Administrador' ? nomesAdmin : []), ...nomesTodos].map((n) => mapa.get(n)).filter((id) => id && !atuais.includes(id));
  if (querem.length) await sdk.setProfileServerFunctionsMitra({ projectId, profileId: Number(profileId), serverFunctionIds: [...atuais, ...querem] });
  console.log(`perfil ${nome}: +${querem.length}`);
}
fim('Rotina de pedido: configuracao pronta.');
