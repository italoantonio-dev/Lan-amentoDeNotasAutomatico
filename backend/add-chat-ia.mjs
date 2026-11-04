// Etapa 7 - Chat: tabelas e SFs. A conversa e registro de trabalho: vive no banco do
// projeto, isolada por usuario no proprio SQL.
import { ddl, sfSQL, NONCE, sqlAdmin, fim } from './lib/base.mjs';

const AGORA = `DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s')`;
const MINHA = `CONVERSA_ID IN (SELECT ID FROM CHAT_CONVERSA WHERE USUARIO_ID = :VAR_USER)`;
const ADMIN = await sqlAdmin();

await ddl(`CREATE TABLE CHAT_CONVERSA (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  CHAVE VARCHAR(40),
  USUARIO_ID INT, TITULO VARCHAR(200),
  TASK_ID VARCHAR(160), MODELO VARCHAR(160),
  ARQUIVADA BOOLEAN DEFAULT FALSE,
  CRIADO_EM VARCHAR(19), ATUALIZADO_EM VARCHAR(19)
) COMMENT='Conversas do assistente. RETENCAO: tudo, registro de trabalho'`);
await ddl(`CREATE TABLE CHAT_MENSAGEM (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  CHAVE VARCHAR(40), CONVERSA_ID INT,
  AUTOR VARCHAR(20), CONTEUDO TEXT, SEQUENCIA INT,
  STATUS VARCHAR(20),
  CRIADO_EM VARCHAR(19),
  FOREIGN KEY (CONVERSA_ID) REFERENCES CHAT_CONVERSA(ID)
) COMMENT='Mensagens do assistente. RETENCAO: tudo, registro de trabalho'`);
await ddl(`CREATE TABLE CHAT_FERRAMENTA_EXEC (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  CONVERSA_ID INT, MENSAGEM_ID INT,
  FERRAMENTA VARCHAR(80), ARGUMENTOS TEXT, RESULTADO TEXT,
  SUCESSO BOOLEAN, DURACAO_MS INT, CRIADO_EM VARCHAR(19),
  FOREIGN KEY (CONVERSA_ID) REFERENCES CHAT_CONVERSA(ID),
  FOREIGN KEY (MENSAGEM_ID) REFERENCES CHAT_MENSAGEM(ID)
) COMMENT='Ferramentas executadas pelo assistente. RETENCAO: tudo, trilha do que o robo fez'`);
await ddl(`CREATE TABLE CONFIG_SISTEMA (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  CHAVE VARCHAR(40) NOT NULL, VALOR VARCHAR(300),
  ATUALIZADO_EM VARCHAR(19), ATUALIZADO_POR INT,
  UNIQUE KEY UK_CONFIG_SISTEMA (CHAVE)
) COMMENT='Configuracao do assistente (connection e modelo de IA). RETENCAO: tudo, configuracao'`);

await sfSQL('configIaLer', `SELECT CHAVE, VALOR FROM CONFIG_SISTEMA WHERE CHAVE IN ('IA_CONNECTION_ID', 'IA_MODELO') AND ${NONCE}`, 'Le a connection e o modelo de IA do assistente');
await sfSQL(
  'configIaSalvar',
  `INSERT INTO CONFIG_SISTEMA (CHAVE, VALOR, ATUALIZADO_EM, ATUALIZADO_POR)
   SELECT '{{chave}}', '{{valor}}', ${AGORA}, :VAR_USER FROM DUAL
   WHERE '{{chave}}' IN ('IA_CONNECTION_ID', 'IA_MODELO') AND ${NONCE} AND ${ADMIN}
   ON DUPLICATE KEY UPDATE VALOR = VALUES(VALOR), ATUALIZADO_EM = VALUES(ATUALIZADO_EM), ATUALIZADO_POR = VALUES(ATUALIZADO_POR)`,
  'Grava a connection ou o modelo de IA (somente administrador)',
);

await sfSQL('chatUsuarioAtual', `SELECT ID, DESCR FROM INT_USER WHERE ID = :VAR_USER AND ${NONCE}`, 'Usuario logado');
await sfSQL(
  'chatCriarConversa',
  `INSERT INTO CHAT_CONVERSA (CHAVE, USUARIO_ID, TITULO, MODELO, ARQUIVADA, CRIADO_EM, ATUALIZADO_EM)
   SELECT '{{chave}}', :VAR_USER, '{{titulo}}', NULLIF('{{modelo}}', ''), FALSE, ${AGORA}, ${AGORA} FROM DUAL WHERE ${NONCE}`,
  'Cria uma conversa do usuario logado',
);
await sfSQL(
  'chatObterConversa',
  `SELECT ID, CHAVE, TITULO, TASK_ID, MODELO, ARQUIVADA, CRIADO_EM, ATUALIZADO_EM FROM CHAT_CONVERSA
   WHERE USUARIO_ID = :VAR_USER AND ${NONCE} AND (CHAVE = '{{chave}}' OR ID = {{id}})`,
  'Le uma conversa do usuario, por chave ou por id',
);
await sfSQL(
  'chatListarConversas',
  `SELECT C.ID, C.CHAVE, C.TITULO, C.TASK_ID, C.MODELO, C.ARQUIVADA, C.CRIADO_EM, C.ATUALIZADO_EM,
     (SELECT COUNT(*) FROM CHAT_MENSAGEM M WHERE M.CONVERSA_ID = C.ID AND M.STATUS <> 'DESCARTADA') AS TOTAL_MENSAGENS
   FROM CHAT_CONVERSA C
   WHERE C.USUARIO_ID = :VAR_USER AND ${NONCE} AND C.ARQUIVADA = {{arquivada}} AND ('{{busca}}' = '' OR C.TITULO LIKE '%{{busca}}%')
   ORDER BY C.ATUALIZADO_EM DESC LIMIT {{limite}} OFFSET {{offset}}`,
  'Lista as conversas do usuario, a mais recente primeiro',
);
await sfSQL('chatContarConversas', `SELECT COUNT(*) AS TOTAL FROM CHAT_CONVERSA WHERE USUARIO_ID = :VAR_USER AND ${NONCE}`, 'Conta as conversas do usuario');
await sfSQL('chatVincularTask', `UPDATE CHAT_CONVERSA SET TASK_ID = '{{taskId}}', ATUALIZADO_EM = ${AGORA} WHERE ID = {{id}} AND USUARIO_ID = :VAR_USER AND ${NONCE}`, 'Guarda a thread do agente na conversa');
await sfSQL('chatRenomearConversa', `UPDATE CHAT_CONVERSA SET TITULO = '{{titulo}}' WHERE ID = {{id}} AND USUARIO_ID = :VAR_USER AND ${NONCE}`, 'Renomeia a conversa');
await sfSQL('chatTocarConversa', `UPDATE CHAT_CONVERSA SET ATUALIZADO_EM = ${AGORA} WHERE ID = {{id}} AND USUARIO_ID = :VAR_USER AND ${NONCE}`, 'Atualiza a data da conversa');
await sfSQL('chatArquivarConversa', `UPDATE CHAT_CONVERSA SET ARQUIVADA = {{arquivada}} WHERE ID = {{id}} AND USUARIO_ID = :VAR_USER AND ${NONCE}`, 'Arquiva ou desarquiva a conversa');
await sfSQL('chatExcluirConversa', `DELETE FROM CHAT_CONVERSA WHERE ID = {{id}} AND USUARIO_ID = :VAR_USER AND ${NONCE}`, 'Exclui a conversa (depois de anexos, ferramentas e mensagens)');
await sfSQL('chatExcluirMensagensConversa', `DELETE FROM CHAT_MENSAGEM WHERE CONVERSA_ID = {{id}} AND ${MINHA} AND ${NONCE}`, 'Exclui as mensagens da conversa');
await sfSQL('chatExcluirFerramentasConversa', `DELETE FROM CHAT_FERRAMENTA_EXEC WHERE CONVERSA_ID = {{id}} AND ${MINHA} AND ${NONCE}`, 'Exclui as execucoes de ferramenta da conversa');

await sfSQL(
  'chatSalvarMensagem',
  `INSERT INTO CHAT_MENSAGEM (CHAVE, CONVERSA_ID, AUTOR, CONTEUDO, SEQUENCIA, STATUS, CRIADO_EM)
   SELECT '{{chave}}', C.ID, '{{autor}}', CONVERT(FROM_BASE64('{{conteudo}}') USING utf8mb4), {{sequencia}}, '{{status}}', ${AGORA}
   FROM CHAT_CONVERSA C WHERE C.ID = {{conversaId}} AND C.USUARIO_ID = :VAR_USER AND ${NONCE}`,
  'Grava uma mensagem (conteudo em base64)',
);
await sfSQL(
  'chatAtualizarMensagem',
  `UPDATE CHAT_MENSAGEM SET CONTEUDO = CONVERT(FROM_BASE64('{{conteudo}}') USING utf8mb4), STATUS = '{{status}}'
   WHERE ID = {{id}} AND ${MINHA} AND ${NONCE}`,
  'Promove o rascunho da resposta a mensagem final, na mesma linha',
);
await sfSQL('chatObterMensagemPorChave', `SELECT ID, STATUS, SEQUENCIA FROM CHAT_MENSAGEM WHERE CHAVE = '{{chave}}' AND ${MINHA} AND ${NONCE}`, 'Le a mensagem pela chave gerada no cliente');
await sfSQL(
  'chatListarMensagens',
  `SELECT ID, CHAVE, AUTOR, CONTEUDO, SEQUENCIA, STATUS, CRIADO_EM FROM CHAT_MENSAGEM
   WHERE CONVERSA_ID = {{conversaId}} AND STATUS <> 'DESCARTADA' AND ${MINHA} AND ${NONCE}
   ORDER BY SEQUENCIA, ID LIMIT {{limite}} OFFSET {{offset}}`,
  'Mensagens da conversa, em ordem',
);
await sfSQL('chatContarMensagens', `SELECT COUNT(*) AS TOTAL, COALESCE(MAX(SEQUENCIA), 0) AS ULTIMA FROM CHAT_MENSAGEM WHERE CONVERSA_ID = {{conversaId}} AND ${MINHA} AND ${NONCE}`, 'Conta as mensagens da conversa');
await sfSQL(
  'chatRegistrarFerramenta',
  `INSERT INTO CHAT_FERRAMENTA_EXEC (CONVERSA_ID, MENSAGEM_ID, FERRAMENTA, ARGUMENTOS, RESULTADO, SUCESSO, DURACAO_MS, CRIADO_EM)
   SELECT C.ID, NULLIF({{mensagemId}}, 0), '{{ferramenta}}', CONVERT(FROM_BASE64('{{argumentos}}') USING utf8mb4), LEFT(CONVERT(FROM_BASE64('{{resultado}}') USING utf8mb4), 60000), {{sucesso}}, {{duracaoMs}}, ${AGORA}
   FROM CHAT_CONVERSA C WHERE C.ID = {{conversaId}} AND C.USUARIO_ID = :VAR_USER AND ${NONCE}`,
  'Registra a execucao de uma ferramenta',
);
await sfSQL(
  'chatListarFerramentas',
  `SELECT ID, MENSAGEM_ID, FERRAMENTA, ARGUMENTOS, LEFT(RESULTADO, 2000) AS RESULTADO, SUCESSO, DURACAO_MS, CRIADO_EM FROM CHAT_FERRAMENTA_EXEC
   WHERE CONVERSA_ID = {{conversaId}} AND ${MINHA} AND ${NONCE} ORDER BY ID LIMIT 200`,
  'Execucoes de ferramenta da conversa',
);
fim('Chat (dados) pronto.');
