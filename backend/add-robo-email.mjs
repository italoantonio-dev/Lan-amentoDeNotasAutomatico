// Etapa 17 - Robo de e-mail. Sem regra propria: termina nas mesmas funcoes de duplicidade,
// classificacao, alcada e envio ao ERP. A caixa nunca e lida sozinha: ATIVO nasce 'N' e nao ha cron.
import { sdk, projectId, ddl, consulta, dml, sfSQL, sfJS, sf, lerSF, montarJS, NONCE, VISIVEL, sqlAdmin, fim, textoErro } from './lib/base.mjs';

const AGORA = `DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s')`;
const ADMIN = await sqlAdmin();

if (!(await consulta(`SELECT 1 AS X FROM STATUS_LANCAMENTO WHERE CODIGO = 'REVISAO_LEITURA'`)).length) {
  await dml(`INSERT INTO STATUS_LANCAMENTO (CODIGO, DESCRICAO, ORDEM) VALUES ('REVISAO_LEITURA', 'Revisão de leitura', 7)`);
}

await ddl(`CREATE TABLE ROBO_CONFIG (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  CHAVE VARCHAR(40) NOT NULL, VALOR VARCHAR(300), DESCRICAO VARCHAR(300),
  UNIQUE KEY UK_ROBO_CONFIG (CHAVE)
) COMMENT='Ajustes do robo, editaveis pela tela. RETENCAO: tudo, configuracao'`);
await ddl(`CREATE TABLE ROBO_EXECUCAO (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  TOKEN VARCHAR(60), ORIGEM VARCHAR(20),
  INICIO VARCHAR(19), FIM VARCHAR(19), DURACAO_MS INT,
  MENSAGENS INT DEFAULT 0, ANEXOS INT DEFAULT 0, LANCADOS INT DEFAULT 0,
  APROVACAO INT DEFAULT 0, REVISAO INT DEFAULT 0, ERROS INT DEFAULT 0,
  STATUS VARCHAR(20), MENSAGEM VARCHAR(500)
) COMMENT='Rodadas do robo. RETENCAO: tudo, uma linha por rodada pedida'`);
await ddl(`CREATE TABLE ROBO_EMAIL (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  MENSAGEM_ID VARCHAR(120), REMETENTE VARCHAR(300), ASSUNTO VARCHAR(400),
  RECEBIDO_EM VARCHAR(19), PROCESSADO_EM VARCHAR(19),
  EXECUCAO_ID INT, ANEXOS INT DEFAULT 0, MENSAGEM VARCHAR(500),
  UNIQUE KEY UK_ROBO_EMAIL_MSG (MENSAGEM_ID)
) COMMENT='Mensagens lidas; a unicidade impede reprocessar. RETENCAO: tudo, auditoria'`);
await ddl(`CREATE TABLE ROBO_ANEXO (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  EMAIL_ID INT, NOME VARCHAR(300), TIPO VARCHAR(10), TAMANHO INT,
  HASH_DOCUMENTO VARCHAR(64), ORIGEM_LEITURA VARCHAR(20),
  CONFIANCA INT DEFAULT 0,
  CRITERIOS TEXT,
  CAMPOS TEXT,
  DECISAO VARCHAR(20), MOTIVO VARCHAR(500),
  LANCAMENTO_ID INT, DOCUMENTO_ID INT, CHAVE_ERP VARCHAR(30),
  ARQUIVO_URL VARCHAR(500) COMMENT 'Key do arquivo privado',
  CRIADO_EM VARCHAR(19),
  FOREIGN KEY (EMAIL_ID) REFERENCES ROBO_EMAIL(ID)
) COMMENT='Anexos lidos e a decisao do robo. RETENCAO: tudo, auditoria'`);

const seeds = [
  ['CORTE_CONFIANCA', '90', 'Nota minima para o robo lancar sozinho'],
  ['GMAIL_QUERY', 'has:attachment newer_than:7d', 'Busca na caixa de e-mail'],
  ['MAX_MENSAGENS', '10', 'Mensagens lidas por rodada'],
  ['ATIVO', 'N', 'N = so a pedido. S religa a varredura automatica'],
  ['INTEGRACAO', 'gmail', 'Slug da integracao de e-mail'],
];
for (const [c, v, d] of seeds) {
  if (!(await consulta(`SELECT 1 AS X FROM ROBO_CONFIG WHERE CHAVE = '${c}'`)).length) {
    await dml(`INSERT INTO ROBO_CONFIG (CHAVE, VALOR, DESCRICAO) VALUES ('${c}', '${v}', '${d}')`);
  }
}

// A conexao nasce na aba de Integracoes com valor de preenchimento, igual a do ERP.
try {
  const lista = await sdk.listIntegrationsMitra({ projectId });
  const itens = lista?.result ?? lista ?? [];
  if (!itens.some((i) => String(i.slug) === 'gmail')) {
    await sdk.createIntegrationMitra({
      projectId, name: 'Caixa de e-mail (Gmail)', slug: 'gmail', blueprintId: null, blueprintType: 'HTTP_REQUEST', authType: 'DYNAMIC_TOKEN',
      credentials: { base_url: 'https://gmail.googleapis.com', client_id: 'PREENCHER', client_secret: 'PREENCHER', refresh_token: 'PREENCHER' },
      authenticationConfig: {
        method: 'POST', url: 'https://oauth2.googleapis.com/token', content_type: 'application/x-www-form-urlencoded',
        body: { grant_type: 'refresh_token', client_id: '{{client_id}}', client_secret: '{{client_secret}}', refresh_token: '{{refresh_token}}' },
        token_extraction: { path: '$.access_token', type: 'jsonpath' }, refresh_strategy: 're_authenticate',
      },
      authorizationConfig: { type: 'header', config: { name: 'Authorization', value: 'Bearer {{token}}' } },
    });
    console.log('Conexao gmail criada com valor de preenchimento.');
  } else {
    console.log('Conexao gmail ja existe: nao foi alterada.');
  }
} catch (e) {
  console.warn('[AVISO] Nao consegui criar a conexao gmail; crie pela aba de Integracoes.', textoErro(e));
}

await sfSQL('roboLerConfig', `SELECT CHAVE, VALOR, DESCRICAO FROM ROBO_CONFIG WHERE ${NONCE}`, 'Ajustes do robo em vigor');
await sfSQL(
  'roboSalvarConfig',
  `UPDATE ROBO_CONFIG SET VALOR = '{{valor}}'
   WHERE CHAVE = '{{chave}}' AND CHAVE IN ('CORTE_CONFIANCA', 'GMAIL_QUERY', 'MAX_MENSAGENS')
     AND (CHAVE <> 'CORTE_CONFIANCA' OR '{{valor}}' REGEXP '^(100|[0-9]{1,2})$')
     AND (CHAVE <> 'MAX_MENSAGENS' OR '{{valor}}' REGEXP '^([1-9]|[1-4][0-9]|50)$')
     AND (CHAVE <> 'GMAIL_QUERY' OR TRIM('{{valor}}') <> '')
     AND ${ADMIN} AND ${NONCE}`,
  'Grava um ajuste do robo (somente administrador, valor validado no proprio SQL)',
);
await sfSQL(
  'roboKpis',
  `SELECT COUNT(*) AS LIDOS,
     COALESCE(SUM(A.DECISAO = 'LANCADO'), 0) AS LANCADOS,
     COALESCE(SUM(A.DECISAO = 'PRONTO'), 0) AS PRONTOS,
     COALESCE(SUM(A.DECISAO = 'APROVACAO'), 0) AS APROVACAO,
     COALESCE(SUM(A.DECISAO = 'REVISAO'), 0) AS REVISAO,
     COALESCE(ROUND(AVG(A.CONFIANCA)), 0) AS CONFIANCA_MEDIA,
     (SELECT MAX(X.FIM) FROM ROBO_EXECUCAO X) AS ULTIMA_BUSCA
   FROM ROBO_ANEXO A WHERE ${NONCE}`,
  'Indicadores da Caixa de entrada',
);
const FILTRO_ANEXO = `(A.DOCUMENTO_ID IS NULL OR D.ID IS NULL OR ${VISIVEL()})`;
await sfSQL(
  'roboListarAnexos',
  `SELECT A.ID, A.NOME, A.TIPO, A.CONFIANCA, A.DECISAO, A.MOTIVO, A.LANCAMENTO_ID, A.CHAVE_ERP, A.CRIADO_EM, E.REMETENTE, E.ASSUNTO, E.RECEBIDO_EM, COUNT(*) OVER() AS TOTAL_GERAL
   FROM ROBO_ANEXO A LEFT JOIN ROBO_EMAIL E ON E.ID = A.EMAIL_ID LEFT JOIN DOCUMENTOS D ON D.ID = A.DOCUMENTO_ID
   WHERE ${NONCE} AND ${FILTRO_ANEXO} AND ('{{decisao}}' = '' OR A.DECISAO = '{{decisao}}')
   ORDER BY A.ID DESC LIMIT {{limite}} OFFSET {{offset}}`,
  'O que o robo leu e decidiu',
);
await sfSQL(
  'roboObterAnexo',
  `SELECT A.*, E.REMETENTE, E.ASSUNTO, E.RECEBIDO_EM, E.MENSAGEM_ID
   FROM ROBO_ANEXO A LEFT JOIN ROBO_EMAIL E ON E.ID = A.EMAIL_ID LEFT JOIN DOCUMENTOS D ON D.ID = A.DOCUMENTO_ID
   WHERE A.ID = {{id}} AND ${NONCE} AND ${FILTRO_ANEXO}`,
  'Detalhe de uma leitura, com a justificativa criterio a criterio',
);
await sfSQL(
  'keyArquivoAnexoRobo',
  `SELECT A.ARQUIVO_URL AS CHAVE_ARQUIVO, A.NOME FROM ROBO_ANEXO A LEFT JOIN DOCUMENTOS D ON D.ID = A.DOCUMENTO_ID WHERE A.ID = {{id}} AND ${NONCE} AND ${FILTRO_ANEXO}`,
  'Key do arquivo de um anexo do robo',
);
await sfSQL(
  'roboUltimaExecucao',
  `SELECT ID, ORIGEM, INICIO, FIM, DURACAO_MS, MENSAGENS, ANEXOS, LANCADOS, APROVACAO, REVISAO, ERROS, STATUS, MENSAGEM FROM ROBO_EXECUCAO WHERE ${NONCE} ORDER BY ID DESC LIMIT 1`,
  'Ultima rodada do robo, para mostrar o motivo real de um erro de busca',
);
await sfSQL(
  'roboCriarExecucao',
  `INSERT INTO ROBO_EXECUCAO (TOKEN, ORIGEM, INICIO, STATUS) SELECT '{{token}}', '{{origem}}', ${AGORA}, 'RODANDO' FROM DUAL WHERE ${NONCE}`,
  'Abre uma rodada do robo',
);
await sfSQL('roboObterExecucao', `SELECT ID FROM ROBO_EXECUCAO WHERE TOKEN = '{{token}}' AND ${NONCE}`, 'Le a rodada pelo token');
await sfSQL(
  'roboConcluirExecucao',
  `UPDATE ROBO_EXECUCAO SET FIM = ${AGORA}, DURACAO_MS = {{duracaoMs}}, MENSAGENS = {{mensagens}}, ANEXOS = {{anexos}}, LANCADOS = {{lancados}}, APROVACAO = {{aprovacao}}, REVISAO = {{revisao}}, ERROS = {{erros}}, STATUS = '{{statusExec}}', MENSAGEM = LEFT('{{mensagem}}', 500)
   WHERE TOKEN = '{{token}}' AND ${NONCE}`,
  'Fecha uma rodada do robo',
);
await sfSQL('roboMensagensProcessadas', `SELECT MENSAGEM_ID FROM ROBO_EMAIL WHERE PROCESSADO_EM IS NOT NULL AND FIND_IN_SET(MENSAGEM_ID, '{{ids}}') AND ${NONCE}`, 'Quais mensagens ja foram lidas');
await sfSQL(
  'roboRegistrarEmail',
  `INSERT INTO ROBO_EMAIL (MENSAGEM_ID, REMETENTE, ASSUNTO, RECEBIDO_EM, PROCESSADO_EM, EXECUCAO_ID, ANEXOS, MENSAGEM)
   SELECT '{{mensagemId}}', LEFT('{{remetente}}', 300), LEFT('{{assunto}}', 400), NULLIF('{{recebidoEm}}', ''), NULL, NULLIF({{execucaoId}}, 0), {{anexos}}, NULLIF('{{mensagem}}', '') FROM DUAL WHERE ${NONCE}
   ON DUPLICATE KEY UPDATE EXECUCAO_ID = VALUES(EXECUCAO_ID)`,
  'Registra uma mensagem em leitura; so conta como lida depois de todos os anexos',
);
await sfSQL('roboConcluirEmail', `UPDATE ROBO_EMAIL SET PROCESSADO_EM = ${AGORA} WHERE ID = {{id}} AND ${NONCE}`, 'Marca a mensagem como lida: a unicidade impede reprocessar');
await sfSQL('roboEmailPorMensagem', `SELECT ID FROM ROBO_EMAIL WHERE MENSAGEM_ID = '{{mensagemId}}' AND ${NONCE}`, 'Le a mensagem pelo id externo');
await sfSQL(
  'roboRegistrarAnexo',
  `INSERT INTO ROBO_ANEXO (EMAIL_ID, NOME, TIPO, TAMANHO, HASH_DOCUMENTO, ORIGEM_LEITURA, CONFIANCA, CRITERIOS, CAMPOS, DECISAO, MOTIVO, LANCAMENTO_ID, DOCUMENTO_ID, CHAVE_ERP, ARQUIVO_URL, CRIADO_EM)
   SELECT NULLIF({{emailId}}, 0), LEFT('{{nome}}', 300), '{{tipo}}', {{tamanho}}, '{{hash}}', '{{origemLeitura}}', {{confianca}},
     CONVERT(FROM_BASE64('{{criterios}}') USING utf8mb4), CONVERT(FROM_BASE64('{{campos}}') USING utf8mb4), '{{decisao}}', LEFT('{{motivo}}', 500),
     NULLIF({{lancamentoId}}, 0), NULLIF({{documentoId}}, 0), NULLIF('{{chaveErp}}', ''), NULLIF('{{arquivoKey}}', ''), ${AGORA}
   FROM DUAL WHERE ${NONCE}`,
  'Registra a leitura e a decisao de um anexo',
);
await sfSQL('roboEmpresas', `SELECT ID, CODEMP, NOME, CNPJ FROM EMPRESAS WHERE ATIVO = TRUE AND CNPJ IS NOT NULL AND ${NONCE}`, 'Empresas contra as quais o robo procura o destinatario');

// O motor entra inteiro no codigo da SF: o sandbox nao tem o arquivo.
// Sem o texto "module.exports": a plataforma o usa para decidir como envolver o codigo, e o await
// de primeiro nivel deixaria de valer.
const MOTOR = `const leitura = (function () { ${lerSF('robo/leitura.cjs').replace('module.exports =', 'return')}\n })();`;
const COM_MOTOR = async (...arquivos) => (await montarJS('sf/_comum.js', 'sf/_erp.js', 'sf/_lancamento.js', 'sf/_robo.js', 'sf/_imap.js', ...arquivos)).replace('/*__MOTOR__*/', () => MOTOR);

await sf('roboTestarCaixa', 'JAVASCRIPT', await montarJS('sf/_comum.js', 'sf/_imap.js', 'sf/roboTestarCaixa.js'), 'Pergunta o perfil a API do e-mail e devolve o endereco e o total de mensagens. E esse o teste que vale para conector proprio.');
await sf('roboProcessarAnexo', 'JAVASCRIPT', await COM_MOTOR('sf/roboProcessarAnexo.js'), 'Entrega um documento ao robo pela tela (modo simulacao): mesmo motor, mesma decisao e mesma trilha, sem gravar no ERP. Parametros: nome, conteudoB64.');
await sf('roboVarrerEmails', 'JAVASCRIPT', await COM_MOTOR('sf/roboVarrerEmails.js'), 'Busca as notas na caixa de e-mail e processa os anexos: le, classifica e confere sem gravar. Nunca grava no ERP nem confirma nota. So rode a pedido do usuario.');

await sfJS('obterLinkArquivo', ['sf/_comum.js', 'sf/obterLinkArquivo.js'], 'Devolve um link temporario para o arquivo de um registro que o usuario pode ver. Parametros: origem (DOCUMENTO, ANEXO_CHAT ou ANEXO_ROBO) e id (numero).');
fim('Robo pronto.');
