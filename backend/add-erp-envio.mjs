// Etapa 13 - Envio ao ERP: o passo irreversivel. A gravacao so existe dentro do orquestrador,
// que le o estado do banco; nao ha SF de escrita no ERP que a tela possa chamar direto.
import { sfSQL, sfJS, NONCE, VISIVEL, fim } from './lib/base.mjs';

const AGORA = `DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s')`;

await sfSQL(
  'erpDadosEnvio',
  `SELECT L.ID, L.DOCUMENTO_ID, L.EMPRESA_ID, L.CNPJ_FORNECEDOR, L.NOME_FORNECEDOR, L.CODPARC, L.NUMERO_DOC, L.SERIE, L.DATA_EMISSAO, L.DATA_VENCIMENTO, L.VALOR_TOTAL,
     S.CODIGO AS STATUS, E.CODEMP, E.NOME AS EMPRESA, TD.ID AS TIPO_ID, TD.CODIGO AS TIPO, TD.DESCRICAO AS TIPO_DESC, TD.DESTINO_PADRAO, TD.TIPMOV_ESPERADO,
     P.DESTINO_ERP, P.CODTIPTIT, P.CODPROD_PADRAO, T.CODTIPOPER, T.TIPMOV AS TOP_TIPMOV, T.MOVIMENTO AS TOP_MOVIMENTO, T.DESCRICAO AS TOP_DESC,
     N.CODNAT, C.CODCENCUS, CT.CODCTABCO, CT.BANCO,
     (SELECT JSON_ARRAYAGG(JSON_OBJECT('STATUS', EE.STATUS, 'CHAVE_ERP', EE.CHAVE_ERP, 'DESTINO', EE.DESTINO)) FROM ERP_ENVIO EE WHERE EE.LANCAMENTO_ID = L.ID) AS ENVIOS_JSON
   FROM LANCAMENTOS L
   JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID
   JOIN EMPRESAS E ON E.ID = L.EMPRESA_ID
   JOIN DOCUMENTOS D ON D.ID = L.DOCUMENTO_ID
   JOIN TIPOS_DOCUMENTO TD ON TD.ID = D.TIPO_DOCUMENTO_ID
   LEFT JOIN PARAMETROS_LANCAMENTO P ON P.EMPRESA_ID = L.EMPRESA_ID AND P.TIPO_DOCUMENTO_ID = D.TIPO_DOCUMENTO_ID
   LEFT JOIN TOPS T ON T.ID = L.TOP_ID
   LEFT JOIN NATUREZAS N ON N.ID = L.NATUREZA_ID
   LEFT JOIN CENTROS_RESULTADO C ON C.ID = L.CENTRO_ID
   LEFT JOIN CONTAS_BANCARIAS CT ON CT.ID = L.CONTA_ID
   WHERE L.ID = {{id}} AND ${NONCE} AND ${VISIVEL()}`,
  'Tudo o que o envio ao ERP precisa, lido do banco',
);
await sfSQL(
  'listarEnviosLancamento',
  `SELECT EE.ID, EE.DESTINO, EE.CHAVE_ERP, EE.NUMERO_ITENS, EE.STATUS, EE.MENSAGEM, EE.CRIADO_EM
   FROM ERP_ENVIO EE JOIN LANCAMENTOS L ON L.ID = EE.LANCAMENTO_ID JOIN DOCUMENTOS D ON D.ID = L.DOCUMENTO_ID
   WHERE EE.LANCAMENTO_ID = {{lancamentoId}} AND ${NONCE} AND ${VISIVEL()} ORDER BY EE.ID DESC`,
  'Historico de envios de um lancamento',
);
await sfSQL(
  'erpRegistrarEnvio',
  `INSERT INTO ERP_ENVIO (LANCAMENTO_ID, DESTINO, CHAVE_ERP, NUMERO_ITENS, STATUS, MENSAGEM, CRIADO_EM)
   SELECT {{lancamentoId}}, '{{destino}}', NULLIF('{{chave}}', ''), {{numeroItens}}, '{{statusEnvio}}', LEFT('{{mensagem}}', 1000), ${AGORA} FROM DUAL WHERE ${NONCE}`,
  'Registra o resultado de uma tentativa de envio',
);
// Dois cliques nao podem gerar dois titulos: quem reserva primeiro envia.
await sfSQL(
  'erpReservarEnvio',
  `UPDATE LANCAMENTOS SET ENVIANDO_DESDE = ${AGORA}
   WHERE ID = {{id}} AND ${NONCE} AND (ENVIANDO_DESDE IS NULL OR ENVIANDO_DESDE < DATE_FORMAT(NOW() - INTERVAL 5 MINUTE, '%Y-%m-%dT%H:%i:%s'))`,
  'Reserva o envio; recusa se outro envio do mesmo lancamento estiver em andamento',
);
await sfSQL(
  'erpConcluirEnvio',
  `UPDATE LANCAMENTOS L JOIN STATUS_LANCAMENTO ATUAL ON ATUAL.ID = L.STATUS_ID
   SET L.ENVIANDO_DESDE = NULL,
     L.STATUS_ID = (SELECT ID FROM STATUS_LANCAMENTO WHERE CODIGO = '{{status}}'),
     L.NUFIN_SANKHYA = COALESCE(NULLIF({{nufin}}, 0), L.NUFIN_SANKHYA), L.NUNOTA_SANKHYA = COALESCE(NULLIF({{nunota}}, 0), L.NUNOTA_SANKHYA)
   WHERE L.ID = {{id}} AND '{{status}}' IN ('LANCADO', 'ERRO') AND ATUAL.CODIGO IN ('APROVADO', 'ERRO') AND ${NONCE}`,
  'Fecha o envio: libera a reserva, grava a situacao e a chave devolvida pelo ERP',
);
await sfSQL(
  'corrigirDadosLancamentoParceiro',
  `UPDATE LANCAMENTOS L JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID SET L.CODPARC = {{codparc}}
   WHERE L.ID = {{id}} AND S.CODIGO <> 'LANCADO' AND ${NONCE}`,
  'Guarda o parceiro escolhido por uma pessoa',
);
await sfJS('enviarLancamentoParaErp', ['sf/_comum.js', 'sf/_erp.js', 'sf/enviarLancamentoParaErp.js'], 'Confere o lancamento contra o ERP pelas mesmas guardas do envio. Com simular=S devolve o que seria enviado, sem gravar. Gravacao no ERP desligada (Fase 0): sem simular a funcao recusa com GRAVACAO_BLOQUEADA. Nota de entrada nunca e criada aqui. Parametros: lancamentoId (numero); simular (S); opcional codparc.');
fim('Envio ao ERP pronto.');
