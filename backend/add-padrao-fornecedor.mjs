// Etapa 15 - Padrao do fornecedor e criacao do lancamento. As tres portas (tela, chat e robo)
// terminam nesta mesma logica: sf/_lancamento.js.
import { sfSQL, sfJS, NONCE, VISIVEL, fim } from './lib/base.mjs';

await sfSQL(
  'padraoLocalFornecedor',
  `SELECT L.NATUREZA_ID, L.CENTRO_ID, L.CONTA_ID, N.CODNAT, N.DESCRICAO AS NATUREZA_DESC, C.CODCENCUS, C.DESCRICAO AS CENTRO_DESC, CT.CODCTABCO, CT.DESCRICAO AS CONTA_DESC
   FROM LANCAMENTOS L
   JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID
   LEFT JOIN NATUREZAS N ON N.ID = L.NATUREZA_ID
   LEFT JOIN CENTROS_RESULTADO C ON C.ID = L.CENTRO_ID
   LEFT JOIN CONTAS_BANCARIAS CT ON CT.ID = L.CONTA_ID
   WHERE L.EMPRESA_ID = {{empresaId}} AND L.CNPJ_FORNECEDOR = '{{cnpj}}' AND '{{cnpj}}' <> '' AND S.CODIGO NOT IN ('REJEITADO', 'REVISAO_LEITURA') AND ${NONCE}
   ORDER BY L.ID DESC LIMIT 200`,
  'Classificacoes ja usadas neste sistema para o fornecedor',
);
await sfSQL(
  'mapearCodigosErp',
  `SELECT 'NATUREZA' AS DIM, ID, CODNAT AS COD, DESCRICAO FROM NATUREZAS WHERE ATIVO = TRUE AND FIND_IN_SET(CODNAT, '{{naturezas}}') AND ${NONCE}
   UNION ALL SELECT 'CENTRO', ID, CODCENCUS, DESCRICAO FROM CENTROS_RESULTADO WHERE ATIVO = TRUE AND FIND_IN_SET(CODCENCUS, '{{centros}}')
   UNION ALL SELECT 'CONTA', ID, CAST(CODCTABCO AS CHAR), DESCRICAO FROM CONTAS_BANCARIAS WHERE ATIVO = TRUE AND FIND_IN_SET(CODCTABCO, '{{contas}}')`,
  'Traduz codigos do ERP para os cadastros locais',
);
await sfSQL(
  'keyArquivoDocumento',
  `SELECT D.ARQUIVO_URL AS CHAVE_ARQUIVO, D.ARQUIVO_NOME AS NOME FROM DOCUMENTOS D WHERE D.ID = {{id}} AND ${NONCE} AND ${VISIVEL()}`,
  'Key do arquivo de um documento que o usuario enxerga',
);
await sfSQL(
  'keyArquivoAnexoChat',
  `SELECT URL AS CHAVE_ARQUIVO, NOME FROM CHAT_ANEXO WHERE ID = {{id}} AND CONVERSA_ID IN (SELECT ID FROM CHAT_CONVERSA WHERE USUARIO_ID = :VAR_USER) AND ${NONCE}`,
  'Key do arquivo de um anexo do proprio usuario',
);
await sfJS('sankhyaPadraoFornecedor', ['sf/_comum.js', 'sf/_erp.js', 'sf/_lancamento.js', 'sf/sankhyaPadraoFornecedor.js'], 'Historico de classificacao de um fornecedor no ERP. Parametros: codemp (numero), codparc (numero).');
await sfJS('resolverClassificacaoLancamento', ['sf/_comum.js', 'sf/_erp.js', 'sf/_lancamento.js', 'sf/resolverClassificacaoLancamento.js'], 'Resolve TOP, natureza, centro e conta para empresa, tipo e fornecedor. Parametros: empresaId, tipoId, cnpj.');
await sfJS('criarLancamentoViaChat', ['sf/_comum.js', 'sf/_erp.js', 'sf/_lancamento.js', 'sf/criarLancamentoViaChat.js'], 'Cria o lancamento a partir de um documento. Parametros: empresaId (numero), tipoId (numero), cnpj, nome, numeroDoc, serie, dataEmissao (AAAA-MM-DD), dataVencimento (AAAA-MM-DD), valorTotal (numero); opcionais anexoId, hash, arquivoNome, itens. Recusa documento ja lancado.');
fim('Padrao do fornecedor pronto.');
