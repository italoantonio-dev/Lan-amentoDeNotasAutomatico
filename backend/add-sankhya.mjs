// Etapa 11 - Sankhya: conexao, leitura de cadastro e sincronizacao por upsert.
import { sdk, projectId, sf, sfSQL, sfJS, NONCE, LOTE_CTE, jx, sqlAdmin, fim, textoErro } from './lib/base.mjs';

const SLUG_ERP = 'sankhya';
const AGORA = `DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s')`;
const ADMIN = await sqlAdmin();

// A conexao nasce com valor de preenchimento e o usuario troca pela tela de Integracoes.
// Se ja existir, nao e tocada: a credencial e do cliente.
try {
  const lista = await sdk.listIntegrationsMitra({ projectId });
  const itens = lista?.result ?? lista ?? [];
  if (!itens.some((i) => String(i.slug) === SLUG_ERP)) {
    await sdk.createIntegrationMitra({
      projectId, name: 'Sankhya', slug: SLUG_ERP, blueprintId: 'sankhya_oauth', blueprintType: 'HTTP_REQUEST', authType: 'DYNAMIC_TOKEN',
      credentials: { client_id: 'PREENCHER', client_secret: 'PREENCHER', x_token: 'PREENCHER' },
    });
    console.log('Conexao sankhya criada com valor de preenchimento.');
  } else {
    console.log('Conexao sankhya ja existe: nao foi alterada.');
  }
} catch (e) {
  console.warn('[AVISO] Nao consegui criar a conexao sankhya; crie pela aba de Integracoes.', textoErro(e));
}

const consulta = (sql) => ({
  connection: SLUG_ERP, method: 'POST',
  endpoint: '/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
  body: { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql } },
});
const leitura = (nome, sql, desc) => sf(nome, 'INTEGRATION', consulta(sql), desc);

await leitura('sankhyaEmpresas', 'SELECT CODEMP, NOMEFANTASIA, RAZAOSOCIAL, CGC FROM TSIEMP ORDER BY CODEMP', 'Empresas no ERP');
// TGFTOP e versionada por DHALTER: so a versao vigente de cada TOP.
await leitura('sankhyaTops', 'SELECT T.CODTIPOPER, T.DESCROPER, T.TIPMOV, T.ATIVO, T.ATUALFIN FROM TGFTOP T WHERE T.DHALTER = (SELECT MAX(X.DHALTER) FROM TGFTOP X WHERE X.CODTIPOPER = T.CODTIPOPER) ORDER BY T.CODTIPOPER', 'TOPs vigentes no ERP');
await leitura('sankhyaNaturezas', 'SELECT CODNAT, DESCRNAT, ATIVA FROM TGFNAT ORDER BY CODNAT', 'Naturezas no ERP');
await leitura('sankhyaCentros', 'SELECT CODCENCUS, DESCRCENCUS, ATIVO FROM TSICUS ORDER BY CODCENCUS', 'Centros de resultado no ERP');
await leitura('sankhyaContas', 'SELECT CODCTABCOINT, DESCRICAO, CODBCO, ATIVA FROM TSICTA ORDER BY CODCTABCOINT', 'Contas bancarias no ERP');
await leitura('sankhyaTiposTitulo', 'SELECT CODTIPTIT, DESCRTIPTIT, ATIVO FROM TGFTIT ORDER BY CODTIPTIT', 'Tipos de titulo no ERP');
await leitura('sankhyaUsuarios', 'SELECT CODUSU, NOMEUSU, EMAIL, VLRMAXAUT, CODGRUPO FROM TSIUSU ORDER BY NOMEUSU', 'Usuarios do ERP, candidatos a aprovador');

const upsert = (nome, tabela, colunas, atualiza, valores) =>
  sfSQL(
    nome,
    `INSERT INTO ${tabela} (${colunas.join(', ')}) ${LOTE_CTE}
     SELECT ${valores.join(', ')} FROM n, j WHERE ${NONCE} AND ${ADMIN}
     ON DUPLICATE KEY UPDATE ${atualiza.map((c) => `${c} = VALUES(${c})`).join(', ')}`,
    `Grava em lote no cadastro ${tabela}, atualizando pelo codigo (somente administrador)`,
  );
await upsert('upsertEmpresas', 'EMPRESAS', ['CODEMP', 'NOME', 'CNPJ', 'CRIADO_EM'], ['NOME', 'CNPJ'], [jx('cod'), jx('desc'), jx('cnpj'), AGORA]);
await upsert('upsertTops', 'TOPS', ['CODTIPOPER', 'DESCRICAO', 'ATIVO', 'TIPMOV', 'MOVIMENTO', 'ATUALIZA_FINANCEIRO'], ['DESCRICAO', 'ATIVO', 'TIPMOV', 'MOVIMENTO', 'ATUALIZA_FINANCEIRO'], [jx('cod'), jx('desc'), jx('ativo'), jx('tipmov'), jx('movimento'), jx('atualFin')]);
await upsert('upsertNaturezas', 'NATUREZAS', ['CODNAT', 'DESCRICAO', 'ATIVO'], ['DESCRICAO', 'ATIVO'], [jx('cod'), jx('desc'), jx('ativo')]);
await upsert('upsertCentros', 'CENTROS_RESULTADO', ['CODCENCUS', 'DESCRICAO', 'ATIVO'], ['DESCRICAO', 'ATIVO'], [jx('cod'), jx('desc'), jx('ativo')]);
await upsert('upsertContas', 'CONTAS_BANCARIAS', ['CODCTABCO', 'DESCRICAO', 'BANCO', 'ATIVO'], ['DESCRICAO', 'BANCO', 'ATIVO'], [jx('cod'), jx('desc'), jx('banco'), jx('ativo')]);
await upsert('upsertTiposTitulo', 'TIPOS_TITULO', ['CODTIPTIT', 'DESCRICAO', 'ATIVO'], ['DESCRICAO', 'ATIVO'], [jx('cod'), jx('desc'), jx('ativo')]);

await sfSQL(
  'codigosCadastroExistentes',
  `SELECT 'EMPRESAS' AS T, CAST(CODEMP AS CHAR) AS C FROM EMPRESAS WHERE ${NONCE}
   UNION ALL SELECT 'TOPS', CAST(CODTIPOPER AS CHAR) FROM TOPS
   UNION ALL SELECT 'NATUREZAS', CODNAT FROM NATUREZAS
   UNION ALL SELECT 'CENTROS', CODCENCUS FROM CENTROS_RESULTADO
   UNION ALL SELECT 'CONTAS', CAST(CODCTABCO AS CHAR) FROM CONTAS_BANCARIAS
   UNION ALL SELECT 'TIPOS_TITULO', CAST(CODTIPTIT AS CHAR) FROM TIPOS_TITULO`,
  'Codigos ja cadastrados, para contar novos e atualizados na carga',
);
await sfSQL(
  'registrarSincronizacao',
  `INSERT INTO SINCRONIZACAO_ERP (CADASTRO, LIDOS_DO_ERP, NOVOS, ATUALIZADOS, TOTAL, CRIADO_EM)
   SELECT '{{cadastro}}', {{lidos}}, {{novos}}, {{atualizados}}, {{total}}, ${AGORA} FROM DUAL WHERE ${NONCE} AND ${ADMIN}`,
  'Registra o resultado de uma carga',
);
await sfSQL(
  'ultimaSincronizacao',
  `SELECT S.CADASTRO, S.LIDOS_DO_ERP, S.NOVOS, S.ATUALIZADOS, S.TOTAL, S.CRIADO_EM FROM SINCRONIZACAO_ERP S
   WHERE ${NONCE} AND S.ID IN (SELECT MAX(X.ID) FROM SINCRONIZACAO_ERP X GROUP BY X.CADASTRO) ORDER BY S.CADASTRO`,
  'Ultima carga de cada cadastro',
);
await sfSQL('souAdministrador', `SELECT CASE WHEN ${ADMIN} THEN 1 ELSE 0 END AS ADMIN FROM DUAL WHERE ${NONCE}`, 'Diz se o usuario logado e administrador');

await sfJS('sincronizarCadastrosSankhya', ['sf/_comum.js', 'sf/_erp.js', 'sf/sincronizarCadastros.js'], 'Traz empresas, TOPs, naturezas, centros, contas e tipos de titulo do ERP, por upsert no codigo. Somente administrador.');
await sfJS('erpVerificarConexao', ['sf/_comum.js', 'sf/_erp.js', 'sf/erpVerificarConexao.js'], 'Confere com uma consulta real se a conexao com o ERP responde.');
await sfJS('sankhyaProdutos', ['sf/_comum.js', 'sf/_erp.js', 'sf/sankhyaProdutos.js'], 'Busca produtos no ERP por nome ou codigo.');
await sfJS('sankhyaCidades', ['sf/_comum.js', 'sf/_erp.js', 'sf/sankhyaCidades.js'], 'Busca cidades no ERP, para o cadastro de parceiro.');
fim('Sankhya pronto.');
