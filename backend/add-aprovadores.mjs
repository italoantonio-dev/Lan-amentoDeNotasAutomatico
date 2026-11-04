// Etapa 12 - Aprovadores e alcada. A recusa por alcada acontece aqui, no servidor.
import { sfSQL, sfJS, NONCE, VISIVEL, sqlAdmin, fim } from './lib/base.mjs';

const AGORA = `DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s')`;
const ADMIN = await sqlAdmin();

// Enquanto nao houver aprovador ativo, a alcada nao vale (secao 13.2).
export const PODE_DECIDIR = (valor) => `(
  NOT EXISTS (SELECT 1 FROM APROVADORES A0 WHERE A0.ATIVO = TRUE)
  OR EXISTS (SELECT 1 FROM APROVADORES A1 WHERE A1.ATIVO = TRUE AND A1.USUARIO_MITRA_ID = :VAR_USER AND (A1.LIMITE_ALCADA IS NULL OR A1.LIMITE_ALCADA >= ${valor}))
)`;

await sfSQL(
  'listarAprovadores',
  `SELECT A.ID, A.CODUSU, A.NOME, A.EMAIL, A.GRUPO, A.LIMITE_ALCADA, A.USUARIO_MITRA_ID, A.ATIVO, U.DESCR AS LOGIN
   FROM APROVADORES A LEFT JOIN INT_USER U ON U.ID = A.USUARIO_MITRA_ID
   WHERE ${NONCE} ORDER BY A.ATIVO DESC, A.NOME`,
  'Lista os aprovadores e o vinculo com o login',
);
// O vinculo sai do e-mail: aprovador do ERP nao e usuario do sistema ate o e-mail casar com um login.
await sfSQL(
  'salvarAprovador',
  `INSERT INTO APROVADORES (CODUSU, NOME, EMAIL, GRUPO, LIMITE_ALCADA, USUARIO_MITRA_ID, ATIVO, CRIADO_EM)
   SELECT {{codusu}}, '{{nome}}', NULLIF('{{email}}', ''), NULLIF('{{grupo}}', ''), NULLIF('{{limite}}', ''),
     (SELECT MIN(U.ID) FROM INT_USER U WHERE LOWER(U.DESCR) = LOWER('{{email}}') AND '{{email}}' <> ''), {{ativo}}, ${AGORA}
   FROM DUAL WHERE ${NONCE} AND ${ADMIN}
   ON DUPLICATE KEY UPDATE NOME = VALUES(NOME), EMAIL = VALUES(EMAIL), GRUPO = VALUES(GRUPO), LIMITE_ALCADA = VALUES(LIMITE_ALCADA),
     USUARIO_MITRA_ID = VALUES(USUARIO_MITRA_ID), ATIVO = VALUES(ATIVO)`,
  'Cria ou atualiza um aprovador pelo codigo do ERP e casa o login pelo e-mail (somente administrador)',
);
await sfSQL('inativarAprovador', `UPDATE APROVADORES SET ATIVO = {{ativo}} WHERE ID = {{id}} AND ${NONCE} AND ${ADMIN}`, 'Inativa ou reativa um aprovador; o historico fica (somente administrador)');
await sfSQL(
  'minhaAlcada',
  `SELECT (SELECT COUNT(*) FROM APROVADORES WHERE ATIVO = TRUE) AS TOTAL_APROVADORES,
     (SELECT COUNT(*) FROM APROVADORES WHERE ATIVO = TRUE AND USUARIO_MITRA_ID = :VAR_USER) AS SOU_APROVADOR,
     (SELECT COUNT(*) FROM APROVADORES WHERE ATIVO = TRUE AND USUARIO_MITRA_ID = :VAR_USER AND LIMITE_ALCADA IS NULL) AS SEM_TETO,
     (SELECT MAX(LIMITE_ALCADA) FROM APROVADORES WHERE ATIVO = TRUE AND USUARIO_MITRA_ID = :VAR_USER) AS LIMITE
   FROM DUAL WHERE ${NONCE}`,
  'Alcada de quem esta olhando a fila',
);
await sfSQL(
  'listarPendentesAprovacao',
  `SELECT L.ID, L.NOME_FORNECEDOR, L.CNPJ_FORNECEDOR, L.NUMERO_DOC, L.DATA_EMISSAO, L.DATA_VENCIMENTO, L.VALOR_TOTAL, L.CRIADO_EM, L.ORIGEM_CLASSIFICACAO,
     E.NOME AS EMPRESA, TD.DESCRICAO AS TIPO_DESC, TD.CODIGO AS TIPO, N.DESCRICAO AS NATUREZA_DESC, C.DESCRICAO AS CENTRO_DESC, D.ARQUIVO_NOME,
     CASE WHEN ${PODE_DECIDIR('L.VALOR_TOTAL')} THEN 1 ELSE 0 END AS PODE_APROVAR,
     COUNT(*) OVER() AS TOTAL_GERAL
   FROM LANCAMENTOS L
   JOIN DOCUMENTOS D ON D.ID = L.DOCUMENTO_ID
   JOIN EMPRESAS E ON E.ID = L.EMPRESA_ID
   JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID
   JOIN TIPOS_DOCUMENTO TD ON TD.ID = D.TIPO_DOCUMENTO_ID
   LEFT JOIN NATUREZAS N ON N.ID = L.NATUREZA_ID
   LEFT JOIN CENTROS_RESULTADO C ON C.ID = L.CENTRO_ID
   WHERE S.CODIGO = 'AGUARDANDO_APROVACAO' AND ${NONCE} AND ${VISIVEL()}
   ORDER BY L.ID LIMIT {{limite}} OFFSET {{offset}}`,
  'Fila de aprovacao, com a marca do que quem esta olhando pode decidir',
);
await sfSQL(
  'contarPendentesAprovacao',
  `SELECT COUNT(*) AS TOTAL FROM LANCAMENTOS L JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID JOIN DOCUMENTOS D ON D.ID = L.DOCUMENTO_ID
   WHERE S.CODIGO = 'AGUARDANDO_APROVACAO' AND ${NONCE} AND ${VISIVEL()}`,
  'Conta as pendencias de aprovacao',
);
await sfSQL(
  'listarAprovacoesLancamento',
  `SELECT A.ID, A.ACAO, A.MOTIVO, A.CRIADO_EM, U.DESCR AS USUARIO FROM APROVACOES A LEFT JOIN INT_USER U ON U.ID = A.USUARIO_ID
   JOIN LANCAMENTOS L ON L.ID = A.LANCAMENTO_ID JOIN DOCUMENTOS D ON D.ID = L.DOCUMENTO_ID
   WHERE A.LANCAMENTO_ID = {{lancamentoId}} AND ${NONCE} AND ${VISIVEL()} ORDER BY A.ID`,
  'Historico de decisoes de um lancamento',
);
await sfSQL(
  'verificarPermissaoAprovacao',
  `SELECT L.ID, S.CODIGO AS STATUS, L.VALOR_TOTAL, CASE WHEN ${PODE_DECIDIR('L.VALOR_TOTAL')} THEN 1 ELSE 0 END AS PODE_APROVAR
   FROM LANCAMENTOS L JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID WHERE L.ID = {{id}} AND ${NONCE}`,
  'Confere se o usuario logado pode decidir este lancamento',
);
// A propria escrita carrega a conferencia: chamar direto, sem passar pela tela, nao aprova nada.
await sfSQL(
  'gravarDecisaoAprovacao',
  `UPDATE LANCAMENTOS L JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID
   SET L.STATUS_ID = (SELECT ID FROM STATUS_LANCAMENTO WHERE CODIGO = CASE '{{acao}}' WHEN 'APROVAR' THEN 'APROVADO' WHEN 'REJEITAR' THEN 'REJEITADO' END)
   WHERE L.ID = {{id}} AND S.CODIGO = 'AGUARDANDO_APROVACAO' AND '{{acao}}' IN ('APROVAR', 'REJEITAR') AND ${PODE_DECIDIR('L.VALOR_TOTAL')} AND ${NONCE}`,
  'Aplica a decisao, conferindo situacao e alcada no proprio SQL',
);
await sfSQL(
  'registrarAprovacao',
  `INSERT INTO APROVACOES (LANCAMENTO_ID, USUARIO_ID, ACAO, MOTIVO, CRIADO_EM)
   SELECT {{lancamentoId}}, :VAR_USER, '{{acao}}', NULLIF('{{motivo}}', ''), ${AGORA} FROM DUAL WHERE ${NONCE}`,
  'Registra quem decidiu e por que',
);
await sfJS('aplicarDecisaoAprovacao', ['sf/_comum.js', 'sf/aplicarDecisaoAprovacao.js'], 'Aprova ou rejeita um lancamento pendente. Parametros: lancamentoId (numero), acao (APROVAR ou REJEITAR), motivo (texto, obrigatorio para rejeitar). Recusa quando o lancamento nao esta pendente ou o valor passa da alcada de quem pede.');
fim('Aprovadores prontos.');
