// Piloto assistido de conferencia de NF-e (somente leitura no ERP). Cria a tabela de registro e as SFs.
// Restrito ao perfil Administrador (permissao existente; nenhum perfil e alterado).
import { sf, sfSQL, NONCE, sqlAdmin, ddl, fim, lerSF, montarJS } from './lib/base.mjs';

const ADMIN = await sqlAdmin();
const AGORA = `DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s')`;

await ddl(`CREATE TABLE PILOTO_CONFERENCIA (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  HASH_ARQUIVO VARCHAR(64) NOT NULL,
  CHAVE_NFE VARCHAR(44), NUMERO VARCHAR(20), SERIE VARCHAR(5), DATA_EMISSAO VARCHAR(10),
  CNPJ_EMITENTE VARCHAR(14), NOME_EMITENTE VARCHAR(200), ARQUIVO VARCHAR(200), VALOR_TOTAL DECIMAL(15,2),
  RECEBIDO_EM VARCHAR(19) NOT NULL, REGISTRADO_POR INT NOT NULL,
  STATUS VARCHAR(30) NOT NULL, ERRO_CONSULTA VARCHAR(1000),
  CODEMP VARCHAR(50), CODPARC VARCHAR(100),
  CLASSIFICACAO VARCHAR(20), PEDIDOS_CANDIDATOS VARCHAR(1000), PEDIDO_SUGERIDO VARCHAR(500), DIVERGENCIAS VARCHAR(500), JUSTIFICATIVA VARCHAR(1000),
  PREVISAO_JSON MEDIUMTEXT,
  RESULTADO VARCHAR(30), PEDIDOS_CONFERIDOS VARCHAR(500), MOTIVO VARCHAR(1000), CONFERIDO_POR INT, CONFERIDO_EM VARCHAR(19),
  UNIQUE KEY UK_PILOTO_HASH (HASH_ARQUIVO)
) COMMENT='Piloto assistido: previsao do motor guardada antes da conferencia humana. RETENCAO: tudo, evidencia do piloto'`);

await sfSQL('pilotoSituacao', `SELECT CASE WHEN ${ADMIN} THEN 1 ELSE 0 END AS PODE,
   (SELECT COUNT(*) FROM PILOTO_CONFERENCIA) AS TOTAL, (SELECT MIN(RECEBIDO_EM) FROM PILOTO_CONFERENCIA) AS INICIO,
   (SELECT COUNT(*) FROM PILOTO_CONFERENCIA WHERE STATUS = 'AGUARDANDO_CONFERENCIA') AS AGUARDANDO,
   (SELECT COUNT(*) FROM PILOTO_CONFERENCIA WHERE STATUS = 'CONFERIDO') AS CONFERIDOS,
   (SELECT COUNT(*) FROM PILOTO_CONFERENCIA WHERE STATUS = 'ERRO_CONSULTA') AS ERROS
 FROM DUAL WHERE ${NONCE}`, 'Situacao do piloto e se quem chama pode operar (perfil Administrador)');
await sfSQL('pilotoPorHash', `SELECT ID FROM PILOTO_CONFERENCIA WHERE (HASH_ARQUIVO = '{{hash}}' OR ('{{chave}}' <> '' AND CHAVE_NFE = '{{chave}}')) AND ${NONCE} AND ${ADMIN} LIMIT 1`, 'Documento ja registrado no piloto');
await sfSQL('pilotoInserir', `INSERT INTO PILOTO_CONFERENCIA (HASH_ARQUIVO, CHAVE_NFE, NUMERO, SERIE, DATA_EMISSAO, CNPJ_EMITENTE, NOME_EMITENTE, ARQUIVO, VALOR_TOTAL, RECEBIDO_EM, REGISTRADO_POR,
   STATUS, ERRO_CONSULTA, CODEMP, CODPARC, CLASSIFICACAO, PEDIDOS_CANDIDATOS, PEDIDO_SUGERIDO, DIVERGENCIAS, JUSTIFICATIVA, PREVISAO_JSON)
 SELECT '{{hash}}', NULLIF('{{chave}}', ''), '{{numero}}', '{{serie}}', NULLIF('{{emissao}}', ''), '{{cnpjEmitente}}', '{{nomeEmitente}}', '{{arquivo}}', {{valor}}, ${AGORA}, :VAR_USER,
   CASE '{{status}}' WHEN 'ERRO_CONSULTA' THEN 'ERRO_CONSULTA' ELSE 'AGUARDANDO_CONFERENCIA' END, NULLIF('{{erro}}', ''), NULLIF('{{codemp}}', ''), NULLIF('{{codparc}}', ''),
   NULLIF('{{classificacao}}', ''), NULLIF('{{candidatos}}', ''), NULLIF('{{sugerido}}', ''), NULLIF('{{divergencias}}', ''), NULLIF('{{justificativa}}', ''),
   NULLIF(CONVERT(FROM_BASE64('{{previsao}}') USING utf8mb4), '')
 FROM DUAL WHERE ${NONCE} AND ${ADMIN} AND (SELECT COUNT(*) FROM PILOTO_CONFERENCIA) < 20`, 'Registra o documento e a previsao do motor (so pelo pilotoRegistrarDocumento)');
await sfSQL('pilotoListar', `SELECT P.ID, P.CHAVE_NFE, P.NUMERO, P.SERIE, P.DATA_EMISSAO, P.CNPJ_EMITENTE, P.NOME_EMITENTE, P.VALOR_TOTAL, P.RECEBIDO_EM, P.STATUS, P.ERRO_CONSULTA,
   P.CODEMP, P.CODPARC, P.CLASSIFICACAO, P.PEDIDOS_CANDIDATOS, P.PEDIDO_SUGERIDO, P.DIVERGENCIAS, P.RESULTADO, P.PEDIDOS_CONFERIDOS, P.MOTIVO, P.CONFERIDO_EM,
   UR.DESCR AS REGISTRADO_POR, UC.DESCR AS CONFERIDO_POR, COUNT(*) OVER() AS TOTAL_GERAL
 FROM PILOTO_CONFERENCIA P LEFT JOIN INT_USER UR ON UR.ID = P.REGISTRADO_POR LEFT JOIN INT_USER UC ON UC.ID = P.CONFERIDO_POR
 WHERE ${NONCE} AND ${ADMIN} AND ('{{status}}' = '' OR P.STATUS = '{{status}}')
 ORDER BY P.ID DESC LIMIT {{limite}} OFFSET {{offset}}`, 'Fila e registro do piloto');
await sfSQL('pilotoObter', `SELECT P.*, UR.DESCR AS REGISTRADO_POR_LOGIN, UC.DESCR AS CONFERIDO_POR_LOGIN FROM PILOTO_CONFERENCIA P
 LEFT JOIN INT_USER UR ON UR.ID = P.REGISTRADO_POR LEFT JOIN INT_USER UC ON UC.ID = P.CONFERIDO_POR
 WHERE P.ID = {{id}} AND ${NONCE} AND ${ADMIN}`, 'Documento do piloto com a previsao guardada');
// A conferencia humana grava uma vez so e nunca toca na previsao. Confirmar a sugestao so vale para
// correspondencia SEGURA; os demais resultados exigem motivo.
await sfSQL('pilotoRegistrarConferencia', `UPDATE PILOTO_CONFERENCIA SET RESULTADO = '{{resultado}}', PEDIDOS_CONFERIDOS = NULLIF('{{pedidos}}', ''), MOTIVO = NULLIF('{{motivo}}', ''),
   CONFERIDO_POR = :VAR_USER, CONFERIDO_EM = ${AGORA}, STATUS = 'CONFERIDO'
 WHERE ID = {{id}} AND STATUS = 'AGUARDANDO_CONFERENCIA' AND RESULTADO IS NULL AND ${NONCE} AND ${ADMIN}
   AND '{{resultado}}' IN ('CONFIRMOU_SUGESTAO', 'ESCOLHEU_PEDIDO', 'CORRIGIU_PEDIDO', 'SEM_PEDIDO', 'REJEITOU_DOCUMENTO')
   AND ('{{resultado}}' <> 'CONFIRMOU_SUGESTAO' OR CLASSIFICACAO = 'SEGURA')
   AND ('{{resultado}}' = 'CONFIRMOU_SUGESTAO' OR TRIM('{{motivo}}') <> '')
   AND ('{{resultado}}' NOT IN ('ESCOLHEU_PEDIDO', 'CORRIGIU_PEDIDO') OR TRIM('{{pedidos}}') <> '')`, 'Registra a conferencia humana (uma vez, sem alterar a previsao)');

const MOTOR = `const leitura = (function () { ${lerSF('robo/leitura.cjs').replace('module.exports =', 'return')}\n })();`;
await sf('pilotoRegistrarDocumento', 'JAVASCRIPT', MOTOR + '\n' + (await montarJS('sf/_comum.js', 'sf/pilotoRegistrarDocumento.js')), 'Piloto assistido: confere a NF-e com os pedidos (so leitura no ERP) e guarda a previsao antes da conferencia humana. Nao cria lancamento nem grava no ERP.');
fim('Piloto pronto.');
