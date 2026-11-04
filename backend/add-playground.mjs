// Etapa 21 - Playground. A analista consulta a base pelo runQuery nativo do agente, que confere
// cada tabela contra o perfil de quem conversa. Nao ha SF que execute SQL recebido no input.
import { sdk, projectId, ddl, sfSQL, sf, montarJS, NONCE, fim } from './lib/base.mjs';

const AGORA = `DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s')`;

await ddl(`CREATE TABLE PLAYGROUND (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  USUARIO INT,
  NOME VARCHAR(200),
  HTML LONGTEXT,
  TASK_ID VARCHAR(100),
  SHARE_TOKEN VARCHAR(32),
  CHAVE_IA VARCHAR(32) COMMENT 'Prova de que quem grava o desenho e a analista deste estudo',
  CONVERSA LONGTEXT,
  ATIVO BOOLEAN DEFAULT TRUE,
  CRIADO_EM VARCHAR(19), ATUALIZADO_EM VARCHAR(19)
) COMMENT='Estudos do Playground. RETENCAO: tudo, trabalho do usuario'`);
await ddl(`CREATE TABLE PLAYGROUND_VERSAO (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  PLAYGROUND_ID INT, HTML LONGTEXT, CRIADO_EM VARCHAR(19),
  FOREIGN KEY (PLAYGROUND_ID) REFERENCES PLAYGROUND(ID)
) COMMENT='Versoes anteriores de cada estudo. RETENCAO: tudo, restaurar e um clique'`);

// Chamadas pela analista. Filtram pela chave do estudo: rodando pelo agente, amarrar em :VAR_USER
// deixaria a IA sem gravar; so filtrar pelo ID deixaria qualquer usuario sobrescrever o estudo alheio.
await sfSQL(
  'schema_resumo',
  `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND ${NONCE} AND TABLE_NAME IN ('LANCAMENTOS','DOCUMENTOS','LANCAMENTO_ITENS','EMPRESAS','TIPOS_DOCUMENTO','STATUS_LANCAMENTO','TOPS','NATUREZAS','CENTROS_RESULTADO','CONTAS_BANCARIAS','PARAMETROS_LANCAMENTO','TIPOS_TITULO','APROVACOES','APROVADORES','LOG_EXECUCAO','ERP_ENVIO','ROBO_ANEXO','ROBO_EMAIL','ROBO_EXECUCAO')
   ORDER BY TABLE_NAME, ORDINAL_POSITION`,
  'Colunas das tabelas que a analise pode consultar. Sem parametros.',
);
await sfSQL(
  '_playground_versionar',
  `INSERT INTO PLAYGROUND_VERSAO (PLAYGROUND_ID, HTML, CRIADO_EM)
   SELECT P.ID, P.HTML, ${AGORA} FROM PLAYGROUND P WHERE P.ID = {{id}} AND P.CHAVE_IA = '{{chave}}' AND P.HTML IS NOT NULL AND P.ATIVO = TRUE AND ${NONCE}`,
  'Interna: empurra a tela atual para o historico antes de gravar outra',
);
await sfSQL(
  '_playground_gravar_html',
  `UPDATE PLAYGROUND SET HTML = CONVERT(FROM_BASE64('{{html}}') USING utf8mb4), ATUALIZADO_EM = ${AGORA} WHERE ID = {{id}} AND CHAVE_IA = '{{chave}}' AND ATIVO = TRUE AND ${NONCE}`,
  'Interna: grava a tela do estudo (HTML em base64)',
);
await sfSQL(
  '_playground_gravar_nome',
  `UPDATE PLAYGROUND SET NOME = CONVERT(FROM_BASE64('{{nome}}') USING utf8mb4), ATUALIZADO_EM = ${AGORA} WHERE ID = {{id}} AND CHAVE_IA = '{{chave}}' AND ATIVO = TRUE AND ${NONCE}`,
  'Interna: renomeia o estudo (nome em base64)',
);
await sf('playground_salvar_html', 'JAVASCRIPT', await montarJS('sf/_comum.js', 'sf/playground_salvar_html.js'), 'Grava a tela do estudo. Parametros: playgroundId (numero), chave (texto recebido na primeira mensagem), html (o HTML completo). A tela anterior vira versao.');
await sf('playground_renomear', 'JAVASCRIPT', await montarJS('sf/_comum.js', 'sf/playground_renomear.js'), 'Da ao estudo o titulo da analise. Parametros: playgroundId (numero), chave (texto), nome (texto).');

// Chamadas pela tela: tudo filtrado pelo dono.
await sfSQL(
  'playground_criar',
  `INSERT INTO PLAYGROUND (USUARIO, NOME, CHAVE_IA, ATIVO, CRIADO_EM, ATUALIZADO_EM)
   SELECT :VAR_USER, 'Novo estudo', LOWER(HEX(RANDOM_BYTES(16))), TRUE, ${AGORA}, ${AGORA} FROM DUAL WHERE ${NONCE}`,
  'Cria um estudo do usuario logado',
);
await sfSQL('playground_ultimo', `SELECT ID FROM PLAYGROUND WHERE USUARIO = :VAR_USER AND ATIVO = TRUE AND ${NONCE} ORDER BY ID DESC LIMIT 1`, 'Id do estudo recem-criado');
await sfSQL(
  'playground_listar',
  `SELECT ID, NOME, CRIADO_EM, ATUALIZADO_EM, SHARE_TOKEN, CASE WHEN HTML IS NULL THEN 0 ELSE 1 END AS TEM_TELA, COUNT(*) OVER() AS TOTAL_GERAL
   FROM PLAYGROUND WHERE USUARIO = :VAR_USER AND ATIVO = TRUE AND ${NONCE} ORDER BY ATUALIZADO_EM DESC LIMIT {{limite}} OFFSET {{offset}}`,
  'Estudos do usuario logado',
);
await sfSQL(
  'playground_get',
  `SELECT ID, NOME, HTML, TASK_ID, SHARE_TOKEN, CHAVE_IA, CONVERSA, CRIADO_EM, ATUALIZADO_EM FROM PLAYGROUND WHERE ID = {{id}} AND USUARIO = :VAR_USER AND ATIVO = TRUE AND ${NONCE}`,
  'Estudo completo do usuario logado',
);
await sfSQL('playground_set_task', `UPDATE PLAYGROUND SET TASK_ID = '{{taskId}}' WHERE ID = {{id}} AND USUARIO = :VAR_USER AND ${NONCE}`, 'Guarda a thread da analista');
await sfSQL(
  'playground_salvar_conversa',
  `UPDATE PLAYGROUND SET CONVERSA = CONVERT(FROM_BASE64('{{conversa}}') USING utf8mb4) WHERE ID = {{id}} AND USUARIO = :VAR_USER AND ${NONCE}`,
  'Guarda os segmentos exibidos da conversa (base64)',
);
await sfSQL('playground_renomear_dono', `UPDATE PLAYGROUND SET NOME = CONVERT(FROM_BASE64('{{nome}}') USING utf8mb4) WHERE ID = {{id}} AND USUARIO = :VAR_USER AND ${NONCE}`, 'Renomeia o estudo pela tela');
await sfSQL('playground_excluir', `UPDATE PLAYGROUND SET ATIVO = FALSE, SHARE_TOKEN = NULL WHERE ID = {{id}} AND USUARIO = :VAR_USER AND ${NONCE}`, 'Exclui o estudo e derruba o link publico');
await sfSQL(
  'playground_compartilhar',
  `UPDATE PLAYGROUND SET SHARE_TOKEN = COALESCE(SHARE_TOKEN, LOWER(HEX(RANDOM_BYTES(16)))) WHERE ID = {{id}} AND USUARIO = :VAR_USER AND ATIVO = TRUE AND ${NONCE}`,
  'Gera o link publico do estudo (hash de 32 hexadecimais)',
);
await sfSQL('playground_descompartilhar', `UPDATE PLAYGROUND SET SHARE_TOKEN = NULL WHERE ID = {{id}} AND USUARIO = :VAR_USER AND ${NONCE}`, 'Derruba o link publico do estudo');
await sfSQL(
  'playground_versoes',
  `SELECT V.ID, V.CRIADO_EM, LENGTH(V.HTML) AS TAMANHO FROM PLAYGROUND_VERSAO V JOIN PLAYGROUND P ON P.ID = V.PLAYGROUND_ID
   WHERE V.PLAYGROUND_ID = {{id}} AND P.USUARIO = :VAR_USER AND ${NONCE} ORDER BY V.ID DESC LIMIT 50`,
  'Versoes anteriores do estudo',
);
await sfSQL(
  'playground_versionar_atual',
  `INSERT INTO PLAYGROUND_VERSAO (PLAYGROUND_ID, HTML, CRIADO_EM)
   SELECT P.ID, P.HTML, ${AGORA} FROM PLAYGROUND P WHERE P.ID = {{id}} AND P.USUARIO = :VAR_USER AND P.HTML IS NOT NULL AND ${NONCE}`,
  'Guarda a tela atual antes de restaurar outra',
);
await sfSQL(
  'playground_restaurar',
  `UPDATE PLAYGROUND P JOIN PLAYGROUND_VERSAO V ON V.PLAYGROUND_ID = P.ID SET P.HTML = V.HTML, P.ATUALIZADO_EM = ${AGORA}
   WHERE P.ID = {{id}} AND V.ID = {{versaoId}} AND P.USUARIO = :VAR_USER AND ${NONCE}`,
  'Restaura uma versao do estudo',
);

// Quem nao tem conta: JavaScript valida o token como hexadecimal de 32 antes de consultar.
await sfSQL(
  '_playground_publico_sql',
  `SELECT NOME, HTML, ATUALIZADO_EM FROM PLAYGROUND WHERE SHARE_TOKEN = '{{token}}' AND LENGTH('{{token}}') = 32 AND ATIVO = TRUE AND ${NONCE}`,
  'Interna: estudo publicado pelo token',
);
const pub = await sf('playground_publico', 'JAVASCRIPT', await montarJS('sf/_comum.js', 'sf/playground_publico.js'), 'Devolve o estudo compartilhado para a tela publica. Parametro: token (32 hexadecimais).');
await sdk.togglePublicExecutionMitra({ projectId, serverFunctionId: pub, publicExecution: true });
fim('Playground pronto.');
