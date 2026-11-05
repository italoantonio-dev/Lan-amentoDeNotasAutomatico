// Etapa 12 - Aprovadores e alcada. A recusa por alcada acontece aqui, no servidor.
import { sfSQL, sfJS, NONCE, VISIVEL, sqlAdmin, garantirPerfis, ddl, fim } from './lib/base.mjs';

const AGORA = `DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s')`;
const ADMIN = await sqlAdmin();

const { Aprovador: PERFIL_APROVADOR } = await garantirPerfis();
if (!PERFIL_APROVADOR) throw new Error('Perfil Aprovador nao encontrado.');

// Politica aprovada: em que empresa e tipo cada aprovador decide. Vazia = ninguem decide.
await ddl(`CREATE TABLE APROVADOR_ESCOPO (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  APROVADOR_ID INT NOT NULL,
  EMPRESA_ID INT NOT NULL,
  TIPO_DOCUMENTO_ID INT NOT NULL,
  ATIVO BOOLEAN DEFAULT TRUE,
  APROVADO_POR VARCHAR(200),
  CRIADO_EM VARCHAR(19),
  UNIQUE KEY UK_ESCOPO (APROVADOR_ID, EMPRESA_ID, TIPO_DOCUMENTO_ID),
  FOREIGN KEY (APROVADOR_ID) REFERENCES APROVADORES(ID),
  FOREIGN KEY (EMPRESA_ID) REFERENCES EMPRESAS(ID),
  FOREIGN KEY (TIPO_DOCUMENTO_ID) REFERENCES TIPOS_DOCUMENTO(ID)
) COMMENT='Empresas e tipos em que cada aprovador decide. RETENCAO: tudo, configuracao'`);

// Fail-closed: so decide quem cumpre TODAS as condicoes; qualquer ausencia recusa.
// Vinculo resolvido na hora da decisao, pelo e-mail do login autenticado: nao depende de salvar de novo.
// Um vinculo gravado que aponte para outro usuario vale como recusa.
const VINC = (a) => `${a}.ATIVO = TRUE AND ${a}.EMAIL IS NOT NULL AND ${a}.EMAIL <> ''
  AND EXISTS (SELECT 1 FROM INT_USER U WHERE U.ID = :VAR_USER AND LOWER(U.DESCR) = LOWER(${a}.EMAIL))
  AND (${a}.USUARIO_MITRA_ID IS NULL OR ${a}.USUARIO_MITRA_ID = :VAR_USER)`;
const PERFIL = `EXISTS (SELECT 1 FROM INT_PROFILEUSER PAP WHERE PAP.USERID = :VAR_USER AND PAP.PROFILEID = ${PERFIL_APROVADOR})`;
const ESCOPO = (a, empresa, tipo) => `EXISTS (SELECT 1 FROM APROVADOR_ESCOPO AE WHERE AE.APROVADOR_ID = ${a}.ID AND AE.ATIVO = TRUE AND AE.EMPRESA_ID = ${empresa} AND AE.TIPO_DOCUMENTO_ID = ${tipo})`;
const TETO = (a) => `${a}.LIMITE_ALCADA IS NOT NULL AND ${a}.LIMITE_ALCADA > 0`;

export const PODE_DECIDIR = (valor, empresa = 'L.EMPRESA_ID', tipo = 'D.TIPO_DOCUMENTO_ID') => `(
  ${PERFIL} AND EXISTS (SELECT 1 FROM APROVADORES A1 WHERE ${VINC('A1')} AND ${ESCOPO('A1', empresa, tipo)} AND ${TETO('A1')} AND A1.LIMITE_ALCADA >= ${valor})
)`;
// Primeiro motivo que falta, na ordem em que o administrador precisa resolver.
const MOTIVO = (valor, empresa = 'L.EMPRESA_ID', tipo = 'D.TIPO_DOCUMENTO_ID') => `CASE
  WHEN NOT EXISTS (SELECT 1 FROM APROVADORES A WHERE A.ATIVO = TRUE) THEN 'SEM_APROVADOR_ATIVO'
  WHEN NOT EXISTS (SELECT 1 FROM APROVADORES A WHERE ${VINC('A')}) THEN 'SEM_VINCULO'
  WHEN NOT ${PERFIL} THEN 'SEM_PERFIL'
  WHEN NOT EXISTS (SELECT 1 FROM APROVADORES A WHERE ${VINC('A')} AND ${ESCOPO('A', empresa, tipo)}) THEN 'FORA_DA_POLITICA'
  WHEN NOT EXISTS (SELECT 1 FROM APROVADORES A WHERE ${VINC('A')} AND ${ESCOPO('A', empresa, tipo)} AND ${TETO('A')}) THEN 'SEM_TETO'
  WHEN NOT ${PODE_DECIDIR(valor, empresa, tipo)} THEN 'ACIMA_DA_ALCADA'
  ELSE 'OK' END`;

await sfSQL(
  'listarAprovadores',
  `SELECT A.ID, A.CODUSU, A.NOME, A.EMAIL, A.GRUPO, A.LIMITE_ALCADA, A.USUARIO_MITRA_ID, A.ATIVO, U.DESCR AS LOGIN
   FROM APROVADORES A LEFT JOIN INT_USER U ON LOWER(U.DESCR) = LOWER(A.EMAIL) AND A.EMAIL <> '' AND (A.USUARIO_MITRA_ID IS NULL OR A.USUARIO_MITRA_ID = U.ID)
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
     (SELECT COUNT(*) FROM APROVADORES A WHERE ${VINC('A')}) AS SOU_APROVADOR,
     CASE WHEN ${PERFIL} THEN 1 ELSE 0 END AS TEM_PERFIL,
     (SELECT COUNT(*) FROM APROVADORES A WHERE ${VINC('A')} AND NOT (${TETO('A')})) AS SEM_TETO,
     (SELECT COUNT(*) FROM APROVADOR_ESCOPO AE JOIN APROVADORES A ON A.ID = AE.APROVADOR_ID WHERE AE.ATIVO = TRUE AND ${VINC('A')}) AS ESCOPOS,
     (SELECT MAX(LIMITE_ALCADA) FROM APROVADORES A WHERE ${VINC('A')} AND ${TETO('A')}) AS LIMITE
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
  `SELECT L.ID, S.CODIGO AS STATUS, L.VALOR_TOTAL, CASE WHEN ${PODE_DECIDIR('L.VALOR_TOTAL')} THEN 1 ELSE 0 END AS PODE_APROVAR,
     ${MOTIVO('L.VALOR_TOTAL')} AS MOTIVO
   FROM LANCAMENTOS L JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID JOIN DOCUMENTOS D ON D.ID = L.DOCUMENTO_ID WHERE L.ID = {{id}} AND ${NONCE}`,
  'Confere se o usuario logado pode decidir este lancamento',
);
// A propria escrita carrega a conferencia: chamar direto, sem passar pela tela, nao aprova nada.
await sfSQL(
  'gravarDecisaoAprovacao',
  `UPDATE LANCAMENTOS L JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID JOIN DOCUMENTOS D ON D.ID = L.DOCUMENTO_ID
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
