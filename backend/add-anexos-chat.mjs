// Etapa 9 - Anexos na conversa. URL guarda a key do arquivo privado.
import { ddl, sfSQL, NONCE, fim } from './lib/base.mjs';

const AGORA = `DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s')`;
const MINHA = `CONVERSA_ID IN (SELECT ID FROM CHAT_CONVERSA WHERE USUARIO_ID = :VAR_USER)`;

await ddl(`CREATE TABLE CHAT_ANEXO (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  CHAVE VARCHAR(40), CONVERSA_ID INT, MENSAGEM_ID INT,
  NOME VARCHAR(255), TIPO_ARQUIVO VARCHAR(120), TAMANHO INT,
  URL VARCHAR(600) COMMENT 'Key do arquivo privado',
  HASH VARCHAR(64),
  TEXTO_EXTRAIDO TEXT,
  CAMPOS_JSON TEXT,
  STATUS VARCHAR(20),
  LANCAMENTO_ID INT, CRIADO_EM VARCHAR(19),
  FOREIGN KEY (CONVERSA_ID) REFERENCES CHAT_CONVERSA(ID),
  FOREIGN KEY (MENSAGEM_ID) REFERENCES CHAT_MENSAGEM(ID)
) COMMENT='Documentos enviados na conversa. RETENCAO: tudo, prova do que foi lido'`);

await sfSQL(
  'chatSalvarAnexo',
  `INSERT INTO CHAT_ANEXO (CHAVE, CONVERSA_ID, NOME, TIPO_ARQUIVO, TAMANHO, URL, HASH, TEXTO_EXTRAIDO, CAMPOS_JSON, STATUS, LANCAMENTO_ID, CRIADO_EM)
   SELECT '{{chave}}', C.ID, '{{nome}}', '{{tipoArquivo}}', {{tamanho}}, NULLIF('{{arquivoKey}}', ''), '{{hash}}',
     LEFT(CONVERT(FROM_BASE64('{{texto}}') USING utf8mb4), 60000), CONVERT(FROM_BASE64('{{campos}}') USING utf8mb4), '{{status}}', NULLIF({{lancamentoId}}, 0), ${AGORA}
   FROM CHAT_CONVERSA C WHERE C.ID = {{conversaId}} AND C.USUARIO_ID = :VAR_USER AND ${NONCE}`,
  'Grava o anexo lido no navegador',
);
await sfSQL('chatObterAnexo', `SELECT * FROM CHAT_ANEXO WHERE ID = {{id}} AND ${MINHA} AND ${NONCE}`, 'Le um anexo completo, com o texto extraido');
await sfSQL('chatObterAnexoPorChave', `SELECT ID, STATUS, MENSAGEM_ID FROM CHAT_ANEXO WHERE CHAVE = '{{chave}}' AND ${MINHA} AND ${NONCE}`, 'Le o anexo pela chave gerada no cliente');
await sfSQL(
  'chatListarAnexos',
  `SELECT ID, CHAVE, MENSAGEM_ID, NOME, TIPO_ARQUIVO, TAMANHO, HASH, CAMPOS_JSON, STATUS, LANCAMENTO_ID, CRIADO_EM FROM CHAT_ANEXO
   WHERE CONVERSA_ID = {{conversaId}} AND ${MINHA} AND ${NONCE} ORDER BY ID LIMIT 200`,
  'Anexos da conversa, sem o texto bruto',
);
await sfSQL('chatVincularAnexoMensagem', `UPDATE CHAT_ANEXO SET MENSAGEM_ID = {{mensagemId}} WHERE ID = {{id}} AND ${MINHA} AND ${NONCE}`, 'Liga o anexo a mensagem que o levou');
await sfSQL(
  'chatMarcarAnexoLancado',
  `UPDATE CHAT_ANEXO SET STATUS = 'LANCADO', LANCAMENTO_ID = {{lancamentoId}} WHERE ID = {{id}} AND STATUS <> 'LANCADO' AND ${MINHA} AND ${NONCE}`,
  'Fecha o ciclo do anexo depois do lancamento',
);
await sfSQL('chatExcluirAnexos', `DELETE FROM CHAT_ANEXO WHERE CONVERSA_ID = {{id}} AND ${MINHA} AND ${NONCE}`, 'Exclui os anexos da conversa');
fim('Chat (anexos) pronto.');
