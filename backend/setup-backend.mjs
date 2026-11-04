// Etapa 1 - Nucleo: tabelas, lookups e Server Functions que nao dependem do ERP.
// Idempotente: tabela existente e ignorada, lookup so e populado vazio, SF e criada ou
// atualizada pelo nome. Nao apaga nada.
import { ddl, consulta, dml, sfSQL, NONCE, VISIVEL, LOTE_CTE, jx, sqlAdmin, garantirPerfis, fim } from './lib/base.mjs';

const AGORA = `DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s')`;

await garantirPerfis();
const ADMIN = await sqlAdmin();

const tabelas = [
  `CREATE TABLE EMPRESAS (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    CODEMP INT NOT NULL,
    NOME VARCHAR(200) NOT NULL,
    CNPJ VARCHAR(20),
    ATIVO BOOLEAN DEFAULT TRUE,
    CRIADO_EM VARCHAR(19),
    UNIQUE KEY UK_EMPRESA_COD (CODEMP)
  ) COMMENT='Empresas do grupo; vem do ERP ou de cadastro manual. RETENCAO: tudo, cadastro'`,
  `CREATE TABLE TIPOS_DOCUMENTO (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    CODIGO VARCHAR(30) UNIQUE,
    DESCRICAO VARCHAR(100),
    DESTINO_PADRAO VARCHAR(20) DEFAULT 'FINANCEIRO',
    TIPMOV_ESPERADO VARCHAR(2)
  ) COMMENT='Tipos de documento. RETENCAO: tudo, lookup'`,
  `CREATE TABLE STATUS_LANCAMENTO (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    CODIGO VARCHAR(30) UNIQUE,
    DESCRICAO VARCHAR(100),
    ORDEM INT
  ) COMMENT='Situacoes do lancamento. RETENCAO: tudo, lookup'`,
  `CREATE TABLE TOPS (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    CODTIPOPER INT NOT NULL,
    DESCRICAO VARCHAR(200),
    ATIVO BOOLEAN DEFAULT TRUE,
    TIPMOV VARCHAR(2),
    MOVIMENTO VARCHAR(60),
    ATUALIZA_FINANCEIRO INT,
    UNIQUE KEY UK_TOP_COD (CODTIPOPER)
  ) COMMENT='TOPs do ERP. RETENCAO: tudo, cadastro'`,
  `CREATE TABLE NATUREZAS (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    CODNAT VARCHAR(30) NOT NULL,
    DESCRICAO VARCHAR(200),
    ATIVO BOOLEAN DEFAULT TRUE,
    UNIQUE KEY UK_NAT_COD (CODNAT)
  ) COMMENT='Naturezas do ERP. RETENCAO: tudo, cadastro'`,
  `CREATE TABLE CENTROS_RESULTADO (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    CODCENCUS VARCHAR(30) NOT NULL,
    DESCRICAO VARCHAR(200),
    ATIVO BOOLEAN DEFAULT TRUE,
    UNIQUE KEY UK_CENTRO_COD (CODCENCUS)
  ) COMMENT='Centros de resultado do ERP. RETENCAO: tudo, cadastro'`,
  `CREATE TABLE CONTAS_BANCARIAS (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    CODCTABCO INT NOT NULL,
    DESCRICAO VARCHAR(200),
    BANCO VARCHAR(100),
    ATIVO BOOLEAN DEFAULT TRUE,
    UNIQUE KEY UK_CONTA_COD (CODCTABCO)
  ) COMMENT='Contas bancarias do ERP. RETENCAO: tudo, cadastro'`,
  `CREATE TABLE PARAMETROS_LANCAMENTO (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    EMPRESA_ID INT NOT NULL,
    TIPO_DOCUMENTO_ID INT NOT NULL,
    TOP_ID INT, NATUREZA_ID INT, CENTRO_ID INT, CONTA_ID INT,
    LIMITE_APROVACAO DECIMAL(15,2) DEFAULT 0,
    DESTINO_ERP VARCHAR(20) DEFAULT 'FINANCEIRO',
    CODTIPTIT INT,
    CODPROD_PADRAO INT,
    CRIADO_EM VARCHAR(19),
    UNIQUE KEY UK_PARAM_EMP_TIPO (EMPRESA_ID, TIPO_DOCUMENTO_ID),
    FOREIGN KEY (EMPRESA_ID) REFERENCES EMPRESAS(ID),
    FOREIGN KEY (TIPO_DOCUMENTO_ID) REFERENCES TIPOS_DOCUMENTO(ID),
    FOREIGN KEY (TOP_ID) REFERENCES TOPS(ID),
    FOREIGN KEY (NATUREZA_ID) REFERENCES NATUREZAS(ID),
    FOREIGN KEY (CENTRO_ID) REFERENCES CENTROS_RESULTADO(ID),
    FOREIGN KEY (CONTA_ID) REFERENCES CONTAS_BANCARIAS(ID)
  ) COMMENT='Classificacao e alcada por empresa e tipo. RETENCAO: tudo, configuracao'`,
  `CREATE TABLE DOCUMENTOS (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    EMPRESA_ID INT NOT NULL,
    TIPO_DOCUMENTO_ID INT NOT NULL,
    ARQUIVO_NOME VARCHAR(300),
    ARQUIVO_URL VARCHAR(500) COMMENT 'Key do arquivo privado; o link sai de SF na hora',
    HASH_DOCUMENTO VARCHAR(64) UNIQUE,
    CRIADO_POR INT,
    CRIADO_EM VARCHAR(19),
    FOREIGN KEY (EMPRESA_ID) REFERENCES EMPRESAS(ID),
    FOREIGN KEY (TIPO_DOCUMENTO_ID) REFERENCES TIPOS_DOCUMENTO(ID)
  ) COMMENT='Papel recebido; o hash garante um lancamento por papel. RETENCAO: tudo, registro fiscal'`,
  `CREATE TABLE LANCAMENTOS (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    DOCUMENTO_ID INT NOT NULL,
    EMPRESA_ID INT NOT NULL,
    CNPJ_FORNECEDOR VARCHAR(20),
    NOME_FORNECEDOR VARCHAR(200),
    CODPARC INT,
    NUMERO_DOC VARCHAR(30), SERIE VARCHAR(10),
    DATA_EMISSAO VARCHAR(10), DATA_VENCIMENTO VARCHAR(10),
    VALOR_TOTAL DECIMAL(15,2),
    TOP_ID INT, NATUREZA_ID INT, CENTRO_ID INT, CONTA_ID INT,
    ORIGEM_CLASSIFICACAO VARCHAR(30),
    STATUS_ID INT NOT NULL,
    NUNOTA_SANKHYA INT, NUFIN_SANKHYA INT,
    ENVIANDO_DESDE VARCHAR(19),
    CRIADO_POR INT, CRIADO_EM VARCHAR(19),
    FOREIGN KEY (DOCUMENTO_ID) REFERENCES DOCUMENTOS(ID) ON DELETE CASCADE,
    FOREIGN KEY (EMPRESA_ID) REFERENCES EMPRESAS(ID),
    FOREIGN KEY (STATUS_ID) REFERENCES STATUS_LANCAMENTO(ID),
    FOREIGN KEY (TOP_ID) REFERENCES TOPS(ID),
    FOREIGN KEY (NATUREZA_ID) REFERENCES NATUREZAS(ID),
    FOREIGN KEY (CENTRO_ID) REFERENCES CENTROS_RESULTADO(ID),
    FOREIGN KEY (CONTA_ID) REFERENCES CONTAS_BANCARIAS(ID)
  ) COMMENT='Lancamentos. RETENCAO: tudo, registro fiscal'`,
  `CREATE TABLE LANCAMENTO_ITENS (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    LANCAMENTO_ID INT NOT NULL,
    DESCRICAO VARCHAR(300),
    QUANTIDADE DECIMAL(15,4),
    VALOR_UNITARIO DECIMAL(15,4),
    CODPROD INT,
    FOREIGN KEY (LANCAMENTO_ID) REFERENCES LANCAMENTOS(ID) ON DELETE CASCADE
  ) COMMENT='Itens do lancamento. RETENCAO: tudo, registro fiscal'`,
  `CREATE TABLE APROVACOES (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    LANCAMENTO_ID INT NOT NULL,
    USUARIO_ID INT, ACAO VARCHAR(20), MOTIVO VARCHAR(500), CRIADO_EM VARCHAR(19),
    FOREIGN KEY (LANCAMENTO_ID) REFERENCES LANCAMENTOS(ID) ON DELETE CASCADE
  ) COMMENT='Decisoes de aprovacao. RETENCAO: tudo, auditoria'`,
  `CREATE TABLE LOG_EXECUCAO (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    LANCAMENTO_ID INT NOT NULL,
    ETAPA VARCHAR(60), STATUS VARCHAR(20), MENSAGEM VARCHAR(1000), CRIADO_EM VARCHAR(19),
    FOREIGN KEY (LANCAMENTO_ID) REFERENCES LANCAMENTOS(ID) ON DELETE CASCADE
  ) COMMENT='Trilha do lancamento. RETENCAO: tudo, auditoria'`,
  `CREATE TABLE SINCRONIZACAO_ERP (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    CADASTRO VARCHAR(60), LIDOS_DO_ERP INT, NOVOS INT, ATUALIZADOS INT, TOTAL INT,
    CRIADO_EM VARCHAR(19)
  ) COMMENT='Historico de cargas de cadastro. RETENCAO: tudo, poucas linhas por carga manual'`,
  `CREATE TABLE TIPOS_TITULO (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    CODTIPTIT INT NOT NULL, DESCRICAO VARCHAR(200), ATIVO BOOLEAN DEFAULT TRUE,
    UNIQUE KEY UK_TIPTIT_COD (CODTIPTIT)
  ) COMMENT='Tipos de titulo do ERP. RETENCAO: tudo, cadastro'`,
  `CREATE TABLE APROVADORES (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    CODUSU INT NOT NULL,
    NOME VARCHAR(200) NOT NULL,
    EMAIL VARCHAR(200),
    GRUPO VARCHAR(100),
    LIMITE_ALCADA DECIMAL(15,2) NULL,
    USUARIO_MITRA_ID INT NULL,
    ATIVO BOOLEAN DEFAULT TRUE,
    CRIADO_EM VARCHAR(19),
    UNIQUE KEY UK_APROVADOR_CODUSU (CODUSU)
  ) COMMENT='Aprovadores e alcada. RETENCAO: tudo, configuracao'`,
  `CREATE TABLE ERP_ENVIO (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    LANCAMENTO_ID INT NOT NULL,
    DESTINO VARCHAR(20),
    CHAVE_ERP VARCHAR(40),
    NUMERO_ITENS INT DEFAULT 0,
    STATUS VARCHAR(20),
    MENSAGEM VARCHAR(1000),
    CRIADO_EM VARCHAR(19),
    FOREIGN KEY (LANCAMENTO_ID) REFERENCES LANCAMENTOS(ID)
  ) COMMENT='Tentativas de envio ao ERP. RETENCAO: tudo, auditoria'`,
  `CREATE TABLE PERMISSOES_USUARIO (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    USUARIO_ID INT NOT NULL,
    TODOS_OS_TIPOS BOOLEAN DEFAULT TRUE,
    ATUALIZADO_EM VARCHAR(19), ATUALIZADO_POR INT,
    UNIQUE KEY UK_PERMISSAO_USUARIO (USUARIO_ID)
  ) COMMENT='Alcance por tipo de documento. Administrador e o perfil da plataforma. RETENCAO: tudo, configuracao'`,
  `CREATE TABLE PERMISSAO_TIPO_DOCUMENTO (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    USUARIO_ID INT NOT NULL, TIPO_DOCUMENTO_ID INT NOT NULL,
    UNIQUE KEY UK_PERMISSAO_TIPO (USUARIO_ID, TIPO_DOCUMENTO_ID),
    FOREIGN KEY (TIPO_DOCUMENTO_ID) REFERENCES TIPOS_DOCUMENTO(ID)
  ) COMMENT='Tipos liberados por usuario. RETENCAO: tudo, configuracao'`,
];
for (const t of tabelas) await ddl(t);

// Lookups: so constantes de sistema, e so se a tabela estiver vazia.
if (!(await consulta('SELECT 1 AS X FROM TIPOS_DOCUMENTO LIMIT 1')).length) {
  await dml(`INSERT INTO TIPOS_DOCUMENTO (CODIGO, DESCRICAO, DESTINO_PADRAO, TIPMOV_ESPERADO) VALUES
    ('NOTA_FISCAL', 'Nota Fiscal de Entrada', 'NOTA', 'C'),
    ('BOLETO', 'Boleto', 'FINANCEIRO', 'I'),
    ('GUIA_IMPOSTO', 'Guia de Imposto', 'FINANCEIRO', 'I'),
    ('FOLHA_PAGAMENTO', 'Folha de Pagamento', 'FINANCEIRO', 'I')`);
}
if (!(await consulta('SELECT 1 AS X FROM STATUS_LANCAMENTO LIMIT 1')).length) {
  await dml(`INSERT INTO STATUS_LANCAMENTO (CODIGO, DESCRICAO, ORDEM) VALUES
    ('AGUARDANDO_APROVACAO', 'Aguardando aprovação', 2),
    ('APROVADO', 'Aprovado', 3),
    ('LANCADO', 'Lançado', 4),
    ('REJEITADO', 'Rejeitado', 5),
    ('ERRO', 'Erro', 6)`);
}

await sfSQL('listarTiposDocumento', `SELECT ID, CODIGO, DESCRICAO, DESTINO_PADRAO, TIPMOV_ESPERADO FROM TIPOS_DOCUMENTO WHERE ${NONCE} ORDER BY ID`, 'Lista os tipos de documento');
await sfSQL('listarStatusLancamento', `SELECT ID, CODIGO, DESCRICAO, ORDEM FROM STATUS_LANCAMENTO WHERE ${NONCE} ORDER BY ORDEM`, 'Lista as situacoes possiveis de um lancamento');

// CRUD de cadastro: leitura para todo usuario logado, escrita so para administrador.
const CADASTROS = [
  { sing: 'Empresa', plur: 'Empresas', tab: 'EMPRESAS', cod: 'CODEMP', codNum: true, desc: 'NOME', extra: [['CNPJ', 'cnpj']], criado: true },
  { sing: 'Top', plur: 'Tops', tab: 'TOPS', cod: 'CODTIPOPER', codNum: true, desc: 'DESCRICAO', extra: [['TIPMOV', 'tipmov'], ['MOVIMENTO', 'movimento']], num: [['ATUALIZA_FINANCEIRO', 'atualizaFinanceiro']] },
  { sing: 'Natureza', plur: 'Naturezas', tab: 'NATUREZAS', cod: 'CODNAT', codNum: false, desc: 'DESCRICAO', extra: [] },
  { sing: 'Centro', plur: 'Centros', tab: 'CENTROS_RESULTADO', cod: 'CODCENCUS', codNum: false, desc: 'DESCRICAO', extra: [] },
  { sing: 'Conta', plur: 'Contas', tab: 'CONTAS_BANCARIAS', cod: 'CODCTABCO', codNum: true, desc: 'DESCRICAO', extra: [['BANCO', 'banco']] },
  { sing: 'TipoTitulo', plur: 'TiposTitulo', tab: 'TIPOS_TITULO', cod: 'CODTIPTIT', codNum: true, desc: 'DESCRICAO', extra: [] },
];

for (const c of CADASTROS) {
  const v = (expr) => (c.codNum ? `${expr}` : `'${expr}'`);
  const extras = c.extra ?? [];
  const nums = c.num ?? [];
  const colsExtra = [...extras.map(([col]) => col), ...nums.map(([col]) => col)];
  const valsExtra = [...extras.map(([, p]) => `'{{${p}}}'`), ...nums.map(([, p]) => `NULLIF('{{${p}}}', '')`)];
  await sfSQL(
    `listar${c.plur}`,
    `SELECT T.*, COUNT(*) OVER() AS TOTAL_GERAL FROM ${c.tab} T
     WHERE ${NONCE} AND ('{{busca}}' = '' OR T.${c.desc} LIKE '%{{busca}}%' OR CAST(T.${c.cod} AS CHAR) LIKE '%{{busca}}%')
     ORDER BY T.${c.desc} LIMIT {{limite}} OFFSET {{offset}}`,
    `Lista ${c.plur} com busca e paginacao`,
  );
  await sfSQL(
    `criar${c.sing}`,
    `INSERT INTO ${c.tab} (${c.cod}, ${c.desc}, ATIVO${colsExtra.map((x) => `, ${x}`).join('')}${c.criado ? ', CRIADO_EM' : ''})
     SELECT ${v(`{{codigo}}`)}, '{{descricao}}', {{ativo}}${valsExtra.map((x) => `, ${x}`).join('')}${c.criado ? `, ${AGORA}` : ''} FROM DUAL
     WHERE ${NONCE} AND ${ADMIN}`,
    `Cria ${c.sing} (somente administrador)`,
  );
  await sfSQL(
    `atualizar${c.sing}`,
    `UPDATE ${c.tab} SET ${c.cod} = ${v(`{{codigo}}`)}, ${c.desc} = '{{descricao}}', ATIVO = {{ativo}}${colsExtra.map((x, i) => `, ${x} = ${valsExtra[i]}`).join('')}
     WHERE ID = {{id}} AND ${NONCE} AND ${ADMIN}`,
    `Atualiza ${c.sing} (somente administrador)`,
  );
  await sfSQL(
    `excluir${c.sing}`,
    `DELETE FROM ${c.tab} WHERE ID = {{id}} AND ${NONCE} AND ${ADMIN}`,
    `Exclui ${c.sing} (somente administrador; recusado pelo banco se estiver em uso)`,
  );
}

await sfSQL('contarEmpresas', `SELECT COUNT(*) AS TOTAL FROM EMPRESAS WHERE ${NONCE}`, 'Conta as empresas cadastradas');

// Uma chamada so para preencher todos os seletores de uma tela.
await sfSQL(
  'listarOpcoesCadastro',
  `SELECT 'EMPRESA' AS GRUPO, ID, CAST(CODEMP AS CHAR) AS CODIGO, NOME AS DESCRICAO, NULL AS TIPMOV, ATIVO FROM EMPRESAS WHERE ${NONCE}
   UNION ALL SELECT 'TOP', ID, CAST(CODTIPOPER AS CHAR), DESCRICAO, TIPMOV, ATIVO FROM TOPS
   UNION ALL SELECT 'NATUREZA', ID, CODNAT, DESCRICAO, NULL, ATIVO FROM NATUREZAS
   UNION ALL SELECT 'CENTRO', ID, CODCENCUS, DESCRICAO, NULL, ATIVO FROM CENTROS_RESULTADO
   UNION ALL SELECT 'CONTA', ID, CAST(CODCTABCO AS CHAR), DESCRICAO, NULL, ATIVO FROM CONTAS_BANCARIAS
   UNION ALL SELECT 'TIPO_TITULO', ID, CAST(CODTIPTIT AS CHAR), DESCRICAO, NULL, ATIVO FROM TIPOS_TITULO
   UNION ALL SELECT 'TIPO_DOCUMENTO', ID, CODIGO, DESCRICAO, TIPMOV_ESPERADO, TRUE FROM TIPOS_DOCUMENTO
   ORDER BY 1, 4`,
  'Opcoes para os seletores: empresas, TOPs, naturezas, centros, contas, tipos',
);

await sfSQL(
  'listarParametros',
  `SELECT P.*, E.NOME AS EMPRESA, E.CODEMP, TD.DESCRICAO AS TIPO, TD.CODIGO AS TIPO_CODIGO,
          T.DESCRICAO AS TOP_DESC, T.CODTIPOPER, N.DESCRICAO AS NATUREZA_DESC, C.DESCRICAO AS CENTRO_DESC, CT.DESCRICAO AS CONTA_DESC,
          COUNT(*) OVER() AS TOTAL_GERAL
   FROM PARAMETROS_LANCAMENTO P
   JOIN EMPRESAS E ON E.ID = P.EMPRESA_ID
   JOIN TIPOS_DOCUMENTO TD ON TD.ID = P.TIPO_DOCUMENTO_ID
   LEFT JOIN TOPS T ON T.ID = P.TOP_ID
   LEFT JOIN NATUREZAS N ON N.ID = P.NATUREZA_ID
   LEFT JOIN CENTROS_RESULTADO C ON C.ID = P.CENTRO_ID
   LEFT JOIN CONTAS_BANCARIAS CT ON CT.ID = P.CONTA_ID
   WHERE ${NONCE} ORDER BY E.NOME, TD.ID LIMIT {{limite}} OFFSET {{offset}}`,
  'Lista os parametros de lancamento por empresa e tipo',
);
await sfSQL(
  'salvarParametro',
  `INSERT INTO PARAMETROS_LANCAMENTO (EMPRESA_ID, TIPO_DOCUMENTO_ID, TOP_ID, NATUREZA_ID, CENTRO_ID, CONTA_ID, LIMITE_APROVACAO, DESTINO_ERP, CODTIPTIT, CODPROD_PADRAO, CRIADO_EM)
   SELECT {{empresaId}}, {{tipoId}}, NULLIF({{topId}}, 0), NULLIF({{naturezaId}}, 0), NULLIF({{centroId}}, 0), NULLIF({{contaId}}, 0), {{limite}}, '{{destino}}', NULLIF({{codTipTit}}, 0), NULLIF({{codProdPadrao}}, 0), ${AGORA}
   FROM DUAL WHERE ${NONCE} AND ${ADMIN}
   ON DUPLICATE KEY UPDATE TOP_ID = VALUES(TOP_ID), NATUREZA_ID = VALUES(NATUREZA_ID), CENTRO_ID = VALUES(CENTRO_ID), CONTA_ID = VALUES(CONTA_ID),
     LIMITE_APROVACAO = VALUES(LIMITE_APROVACAO), DESTINO_ERP = VALUES(DESTINO_ERP), CODTIPTIT = VALUES(CODTIPTIT), CODPROD_PADRAO = VALUES(CODPROD_PADRAO)`,
  'Cria ou atualiza o parametro da empresa e tipo (somente administrador)',
);
await sfSQL('excluirParametro', `DELETE FROM PARAMETROS_LANCAMENTO WHERE ID = {{id}} AND ${NONCE} AND ${ADMIN}`, 'Exclui um parametro (somente administrador)');
await sfSQL(
  'parametroComEmpresa',
  `SELECT P.*, E.CODEMP, E.NOME AS EMPRESA, TD.CODIGO AS TIPO_CODIGO, TD.TIPMOV_ESPERADO, T.CODTIPOPER, T.TIPMOV AS TOP_TIPMOV, T.DESCRICAO AS TOP_DESC,
          N.CODNAT, N.DESCRICAO AS NATUREZA_DESC, C.CODCENCUS, C.DESCRICAO AS CENTRO_DESC, CT.CODCTABCO, CT.DESCRICAO AS CONTA_DESC
   FROM PARAMETROS_LANCAMENTO P
   JOIN EMPRESAS E ON E.ID = P.EMPRESA_ID
   JOIN TIPOS_DOCUMENTO TD ON TD.ID = P.TIPO_DOCUMENTO_ID
   LEFT JOIN TOPS T ON T.ID = P.TOP_ID
   LEFT JOIN NATUREZAS N ON N.ID = P.NATUREZA_ID
   LEFT JOIN CENTROS_RESULTADO C ON C.ID = P.CENTRO_ID
   LEFT JOIN CONTAS_BANCARIAS CT ON CT.ID = P.CONTA_ID
   WHERE P.EMPRESA_ID = {{empresaId}} AND P.TIPO_DOCUMENTO_ID = {{tipoId}} AND ${NONCE}`,
  'Parametro de uma empresa e tipo, com os codigos do ERP',
);

// Documento e lancamento
await sfSQL(
  'verificarDuplicidadeDocumento',
  `SELECT D.ID AS DOCUMENTO_ID, D.ARQUIVO_NOME, D.CRIADO_EM, L.ID AS LANCAMENTO_ID, S.CODIGO AS STATUS
   FROM DOCUMENTOS D LEFT JOIN LANCAMENTOS L ON L.DOCUMENTO_ID = D.ID LEFT JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID
   WHERE D.HASH_DOCUMENTO = '{{hash}}' AND ${NONCE}`,
  'Verifica pelo hash do conteudo se o documento ja entrou',
);
await sfSQL(
  'criarDocumento',
  `INSERT INTO DOCUMENTOS (EMPRESA_ID, TIPO_DOCUMENTO_ID, ARQUIVO_NOME, ARQUIVO_URL, HASH_DOCUMENTO, CRIADO_POR, CRIADO_EM)
   SELECT {{empresaId}}, {{tipoId}}, '{{nome}}', NULLIF('{{arquivoKey}}', ''), '{{hash}}', :VAR_USER, ${AGORA} FROM DUAL WHERE ${NONCE}`,
  'Registra o documento recebido',
);
await sfSQL(
  'obterDocumentoPorHash',
  `SELECT ID, EMPRESA_ID, TIPO_DOCUMENTO_ID, ARQUIVO_NOME FROM DOCUMENTOS WHERE HASH_DOCUMENTO = '{{hash}}' AND ${NONCE}`,
  'Le o documento pelo hash (o INSERT nao devolve o id)',
);

// A situacao inicial e decidida aqui, nunca recebida da tela: e o que impede criar
// um lancamento ja aprovado chamando a SF direto.
const STATUS_POR_ALCADA = (valor, empresa, tipo) => `(SELECT ID FROM STATUS_LANCAMENTO WHERE CODIGO = CASE
    WHEN EXISTS (SELECT 1 FROM PARAMETROS_LANCAMENTO PA WHERE PA.EMPRESA_ID = ${empresa} AND PA.TIPO_DOCUMENTO_ID = ${tipo}
                 AND PA.LIMITE_APROVACAO > 0 AND ${valor} < PA.LIMITE_APROVACAO) THEN 'APROVADO'
    ELSE 'AGUARDANDO_APROVACAO' END)`;

await sfSQL(
  'criarLancamento',
  `INSERT INTO LANCAMENTOS (DOCUMENTO_ID, EMPRESA_ID, CNPJ_FORNECEDOR, NOME_FORNECEDOR, CODPARC, NUMERO_DOC, SERIE, DATA_EMISSAO, DATA_VENCIMENTO, VALOR_TOTAL,
     TOP_ID, NATUREZA_ID, CENTRO_ID, CONTA_ID, ORIGEM_CLASSIFICACAO, STATUS_ID, CRIADO_POR, CRIADO_EM)
   SELECT D.ID, D.EMPRESA_ID, '{{cnpj}}', '{{nome}}', NULLIF({{codparc}}, 0), '{{numeroDoc}}', '{{serie}}', NULLIF('{{dataEmissao}}', ''), NULLIF('{{dataVencimento}}', ''), {{valorTotal}},
     NULLIF({{topId}}, 0), NULLIF({{naturezaId}}, 0), NULLIF({{centroId}}, 0), NULLIF({{contaId}}, 0), '{{origem}}',
     CASE WHEN '{{revisao}}' = 'S' THEN (SELECT ID FROM STATUS_LANCAMENTO WHERE CODIGO = 'REVISAO_LEITURA')
          ELSE ${STATUS_POR_ALCADA('{{valorTotal}}', 'D.EMPRESA_ID', 'D.TIPO_DOCUMENTO_ID')} END,
     :VAR_USER, ${AGORA}
   FROM DOCUMENTOS D WHERE D.ID = {{documentoId}} AND ${NONCE}`,
  'Cria o lancamento; a situacao inicial sai da alcada, no servidor',
);
await sfSQL(
  'obterLancamentoPorDocumento',
  `SELECT L.ID, S.CODIGO AS STATUS FROM LANCAMENTOS L JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID WHERE L.DOCUMENTO_ID = {{documentoId}} AND ${NONCE}`,
  'Le o lancamento criado para um documento',
);
await sfSQL(
  'criarItemLancamento',
  `INSERT INTO LANCAMENTO_ITENS (LANCAMENTO_ID, DESCRICAO, QUANTIDADE, VALOR_UNITARIO, CODPROD)
   SELECT {{lancamentoId}}, '{{descricao}}', {{quantidade}}, {{valorUnitario}}, NULLIF({{codprod}}, 0) FROM DUAL WHERE ${NONCE}`,
  'Acrescenta um item ao lancamento',
);
await sfSQL(
  'criarItensLancamento',
  `INSERT INTO LANCAMENTO_ITENS (LANCAMENTO_ID, DESCRICAO, QUANTIDADE, VALOR_UNITARIO, CODPROD)
   ${LOTE_CTE} SELECT {{lancamentoId}}, ${jx('descricao')}, ${jx('quantidade')}, ${jx('valorUnitario')}, NULLIF(${jx('codprod')}, '0') FROM n, j WHERE ${NONCE}`,
  'Grava os itens do lancamento em lote (JSON em base64)',
);
await sfSQL(
  'atualizarItemLancamento',
  `UPDATE LANCAMENTO_ITENS SET DESCRICAO = '{{descricao}}', QUANTIDADE = {{quantidade}}, VALOR_UNITARIO = {{valorUnitario}}, CODPROD = NULLIF({{codprod}}, 0)
   WHERE ID = {{id}} AND ${NONCE}
     AND LANCAMENTO_ID IN (SELECT L.ID FROM LANCAMENTOS L JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID WHERE S.CODIGO <> 'LANCADO')`,
  'Corrige um item (nao vale para lancamento ja enviado)',
);
await sfSQL('listarItensLancamento', `SELECT I.* FROM LANCAMENTO_ITENS I WHERE I.LANCAMENTO_ID = {{lancamentoId}} AND ${NONCE} ORDER BY I.ID`, 'Lista os itens de um lancamento');

const SELECT_LANC = `L.ID, L.DOCUMENTO_ID, L.EMPRESA_ID, L.CNPJ_FORNECEDOR, L.NOME_FORNECEDOR, L.CODPARC, L.NUMERO_DOC, L.SERIE, L.DATA_EMISSAO, L.DATA_VENCIMENTO,
  L.VALOR_TOTAL, L.TOP_ID, L.NATUREZA_ID, L.CENTRO_ID, L.CONTA_ID, L.ORIGEM_CLASSIFICACAO, L.NUNOTA_SANKHYA, L.NUFIN_SANKHYA, L.CRIADO_POR, L.CRIADO_EM,
  E.NOME AS EMPRESA, E.CODEMP, S.CODIGO AS STATUS, S.DESCRICAO AS STATUS_DESC, D.TIPO_DOCUMENTO_ID, TD.CODIGO AS TIPO, TD.DESCRICAO AS TIPO_DESC, D.ARQUIVO_NOME`;
const JOIN_LANC = `FROM LANCAMENTOS L
  JOIN DOCUMENTOS D ON D.ID = L.DOCUMENTO_ID
  JOIN EMPRESAS E ON E.ID = L.EMPRESA_ID
  JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID
  JOIN TIPOS_DOCUMENTO TD ON TD.ID = D.TIPO_DOCUMENTO_ID`;

await sfSQL(
  'obterLancamento',
  `SELECT ${SELECT_LANC}, T.DESCRICAO AS TOP_DESC, T.CODTIPOPER, N.DESCRICAO AS NATUREZA_DESC, N.CODNAT, C.DESCRICAO AS CENTRO_DESC, C.CODCENCUS, CT.DESCRICAO AS CONTA_DESC, CT.CODCTABCO
   ${JOIN_LANC}
   LEFT JOIN TOPS T ON T.ID = L.TOP_ID LEFT JOIN NATUREZAS N ON N.ID = L.NATUREZA_ID
   LEFT JOIN CENTROS_RESULTADO C ON C.ID = L.CENTRO_ID LEFT JOIN CONTAS_BANCARIAS CT ON CT.ID = L.CONTA_ID
   WHERE L.ID = {{id}} AND ${NONCE} AND ${VISIVEL()}`,
  'Le um lancamento completo, respeitando os tipos que o usuario enxerga',
);
// A tela de detalhe abre com uma chamada so.
await sfSQL(
  'detalheLancamento',
  `SELECT ${SELECT_LANC}, T.DESCRICAO AS TOP_DESC, T.CODTIPOPER, N.DESCRICAO AS NATUREZA_DESC, N.CODNAT, C.DESCRICAO AS CENTRO_DESC, C.CODCENCUS, CT.DESCRICAO AS CONTA_DESC, CT.CODCTABCO,
     (SELECT JSON_ARRAYAGG(JSON_OBJECT('ID', I.ID, 'DESCRICAO', I.DESCRICAO, 'QUANTIDADE', I.QUANTIDADE, 'VALOR_UNITARIO', I.VALOR_UNITARIO, 'CODPROD', I.CODPROD)) FROM LANCAMENTO_ITENS I WHERE I.LANCAMENTO_ID = L.ID) AS ITENS_JSON,
     (SELECT JSON_ARRAYAGG(JSON_OBJECT('ID', G.ID, 'ETAPA', G.ETAPA, 'STATUS', G.STATUS, 'MENSAGEM', G.MENSAGEM, 'CRIADO_EM', G.CRIADO_EM)) FROM LOG_EXECUCAO G WHERE G.LANCAMENTO_ID = L.ID) AS TRILHA_JSON,
     (SELECT JSON_ARRAYAGG(JSON_OBJECT('ID', A.ID, 'ACAO', A.ACAO, 'MOTIVO', A.MOTIVO, 'CRIADO_EM', A.CRIADO_EM, 'USUARIO', U.DESCR)) FROM APROVACOES A LEFT JOIN INT_USER U ON U.ID = A.USUARIO_ID WHERE A.LANCAMENTO_ID = L.ID) AS DECISOES_JSON,
     (SELECT JSON_ARRAYAGG(JSON_OBJECT('ID', EE.ID, 'DESTINO', EE.DESTINO, 'CHAVE_ERP', EE.CHAVE_ERP, 'NUMERO_ITENS', EE.NUMERO_ITENS, 'STATUS', EE.STATUS, 'MENSAGEM', EE.MENSAGEM, 'CRIADO_EM', EE.CRIADO_EM)) FROM ERP_ENVIO EE WHERE EE.LANCAMENTO_ID = L.ID) AS ENVIOS_JSON
   ${JOIN_LANC}
   LEFT JOIN TOPS T ON T.ID = L.TOP_ID LEFT JOIN NATUREZAS N ON N.ID = L.NATUREZA_ID
   LEFT JOIN CENTROS_RESULTADO C ON C.ID = L.CENTRO_ID LEFT JOIN CONTAS_BANCARIAS CT ON CT.ID = L.CONTA_ID
   WHERE L.ID = {{id}} AND ${NONCE} AND ${VISIVEL()}`,
  'Tudo o que a tela de detalhe mostra, em uma chamada',
);
await sfSQL(
  'listarLancamentos',
  `SELECT ${SELECT_LANC}, COUNT(*) OVER() AS TOTAL_GERAL ${JOIN_LANC}
   WHERE ${NONCE} AND ${VISIVEL()}
     AND ('{{empresaId}}' = '' OR L.EMPRESA_ID = '{{empresaId}}')
     AND ('{{tipoId}}' = '' OR D.TIPO_DOCUMENTO_ID = '{{tipoId}}')
     AND ('{{status}}' = '' OR S.CODIGO = '{{status}}')
     AND ('{{busca}}' = '' OR L.NOME_FORNECEDOR LIKE '%{{busca}}%' OR L.NUMERO_DOC LIKE '%{{busca}}%' OR L.CNPJ_FORNECEDOR LIKE '%{{busca}}%')
   ORDER BY L.ID DESC LIMIT {{limite}} OFFSET {{offset}}`,
  'Lista os lancamentos com filtros e paginacao, respeitando os tipos do usuario',
);
await sfSQL(
  'contarLancamentos',
  `SELECT COUNT(*) AS TOTAL ${JOIN_LANC}
   WHERE ${NONCE} AND ${VISIVEL()}
     AND ('{{empresaId}}' = '' OR L.EMPRESA_ID = '{{empresaId}}')
     AND ('{{tipoId}}' = '' OR D.TIPO_DOCUMENTO_ID = '{{tipoId}}')
     AND ('{{status}}' = '' OR S.CODIGO = '{{status}}')`,
  'Conta os lancamentos com os mesmos filtros da lista',
);
await sfSQL(
  'atualizarClassificacaoLancamento',
  `UPDATE LANCAMENTOS L JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID
   SET L.TOP_ID = NULLIF({{topId}}, 0), L.NATUREZA_ID = NULLIF({{naturezaId}}, 0), L.CENTRO_ID = NULLIF({{centroId}}, 0), L.CONTA_ID = NULLIF({{contaId}}, 0), L.ORIGEM_CLASSIFICACAO = 'MANUAL'
   WHERE L.ID = {{id}} AND S.CODIGO NOT IN ('LANCADO', 'REJEITADO') AND ${NONCE}`,
  'Corrige a classificacao por decisao de uma pessoa (nao vale apos lancado ou rejeitado)',
);
// Corrigir um dado reavalia a alcada: mudar o valor invalida a aprovacao anterior.
await sfSQL(
  'corrigirDadosLancamento',
  `UPDATE LANCAMENTOS L JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID JOIN DOCUMENTOS D ON D.ID = L.DOCUMENTO_ID
   SET L.NOME_FORNECEDOR = '{{nome}}', L.CNPJ_FORNECEDOR = '{{cnpj}}', L.NUMERO_DOC = '{{numeroDoc}}', L.SERIE = '{{serie}}',
       L.DATA_EMISSAO = NULLIF('{{dataEmissao}}', ''), L.DATA_VENCIMENTO = NULLIF('{{dataVencimento}}', ''), L.VALOR_TOTAL = {{valorTotal}},
       L.CODPARC = NULLIF({{codparc}}, 0),
       L.STATUS_ID = ${STATUS_POR_ALCADA('{{valorTotal}}', 'L.EMPRESA_ID', 'D.TIPO_DOCUMENTO_ID')}
   WHERE L.ID = {{id}} AND S.CODIGO IN ('REVISAO_LEITURA', 'AGUARDANDO_APROVACAO', 'APROVADO', 'ERRO') AND ${NONCE}
     AND NOT EXISTS (SELECT 1 FROM ERP_ENVIO EE WHERE EE.LANCAMENTO_ID = L.ID AND EE.STATUS IN ('OK', 'PARCIAL'))`,
  'Corrige os dados lidos e reavalia a alcada; vale tambem para confirmar uma revisao de leitura',
);
// Sem caminho para APROVADO aqui: aprovar so passa pela conferencia de alcada (add-aprovadores).
await sfSQL(
  'atualizarStatusLancamento',
  `UPDATE LANCAMENTOS L JOIN STATUS_LANCAMENTO ATUAL ON ATUAL.ID = L.STATUS_ID
   SET L.STATUS_ID = (SELECT ID FROM STATUS_LANCAMENTO WHERE CODIGO = '{{status}}')
   WHERE L.ID = {{id}} AND '{{status}}' IN ('LANCADO', 'ERRO') AND ATUAL.CODIGO IN ('APROVADO', 'ERRO') AND ${NONCE}`,
  'Registra o resultado do envio ao ERP (so de aprovado ou erro para lancado ou erro)',
);
await sfSQL(
  'excluirLancamento',
  `DELETE D FROM DOCUMENTOS D JOIN LANCAMENTOS L ON L.DOCUMENTO_ID = D.ID JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID
   WHERE L.ID = {{id}} AND S.CODIGO <> 'LANCADO' AND ${NONCE}
     AND NOT EXISTS (SELECT 1 FROM ERP_ENVIO EE WHERE EE.LANCAMENTO_ID = L.ID)
     AND (L.CRIADO_POR = :VAR_USER OR ${ADMIN})`,
  'Exclui lancamento e documento (quem criou ou administrador; nunca depois de enviar ao ERP)',
);

await sfSQL(
  'registrarLog',
  `INSERT INTO LOG_EXECUCAO (LANCAMENTO_ID, ETAPA, STATUS, MENSAGEM, CRIADO_EM)
   SELECT {{lancamentoId}}, '{{etapa}}', '{{statusLog}}', LEFT('{{mensagem}}', 1000), ${AGORA} FROM DUAL WHERE ${NONCE}`,
  'Registra uma linha na trilha do lancamento',
);
// Chamada entre SFs tambem conta no limite por minuto do projeto: a trilha vai em lote.
await sfSQL(
  'registrarLogsLote',
  `INSERT INTO LOG_EXECUCAO (LANCAMENTO_ID, ETAPA, STATUS, MENSAGEM, CRIADO_EM)
   ${LOTE_CTE} SELECT {{lancamentoId}}, ${jx('etapa')}, ${jx('status')}, LEFT(${jx('mensagem')}, 1000), ${AGORA} FROM n, j WHERE ${NONCE}`,
  'Registra varias linhas da trilha de uma vez (JSON em base64)',
);
await sfSQL(
  'listarTrilhaLancamento',
  `SELECT G.ID, G.ETAPA, G.STATUS, G.MENSAGEM, G.CRIADO_EM FROM LOG_EXECUCAO G
   JOIN LANCAMENTOS L ON L.ID = G.LANCAMENTO_ID JOIN DOCUMENTOS D ON D.ID = L.DOCUMENTO_ID
   WHERE G.LANCAMENTO_ID = {{lancamentoId}} AND ${NONCE} AND ${VISIVEL()} ORDER BY G.ID`,
  'Trilha de auditoria de um lancamento',
);

// Painel: mesmos filtros nos quatro, para o clique em um grafico filtrar os outros.
const FILTRO_PAINEL = `('{{empresaId}}' = '' OR L.EMPRESA_ID = '{{empresaId}}') AND ('{{status}}' = '' OR S.CODIGO = '{{status}}')`;
await sfSQL(
  'kpisDashboard',
  `SELECT COUNT(*) AS TOTAL,
     COALESCE(SUM(S.CODIGO = 'AGUARDANDO_APROVACAO'), 0) AS PENDENTES,
     COALESCE(SUM(S.CODIGO = 'LANCADO'), 0) AS LANCADOS,
     COALESCE(SUM(S.CODIGO = 'ERRO'), 0) AS ERROS,
     COALESCE(SUM(S.CODIGO = 'REVISAO_LEITURA'), 0) AS REVISAO,
     COALESCE(SUM(S.CODIGO = 'APROVADO'), 0) AS APROVADOS,
     COALESCE(SUM(CASE WHEN S.CODIGO = 'LANCADO' THEN L.VALOR_TOTAL END), 0) AS VALOR_LANCADO,
     COALESCE(SUM(L.CRIADO_EM LIKE CONCAT(DATE_FORMAT(NOW(), '%Y-%m-%d'), '%')), 0) AS ENTRARAM_HOJE,
     (SELECT COUNT(*) FROM PARAMETROS_LANCAMENTO) AS TOTAL_PARAMETROS,
     (SELECT COUNT(*) FROM EMPRESAS) AS TOTAL_EMPRESAS
   ${JOIN_LANC} WHERE ${NONCE} AND ${VISIVEL()} AND ${FILTRO_PAINEL}`,
  'Indicadores do painel, com os filtros opcionais de empresa e situacao',
);
await sfSQL(
  'resumoPorStatus',
  `SELECT S.CODIGO AS CODIGO, S.DESCRICAO AS name, COUNT(*) AS value, COALESCE(SUM(L.VALOR_TOTAL), 0) AS VALOR
   ${JOIN_LANC} WHERE ${NONCE} AND ${VISIVEL()} AND ('{{empresaId}}' = '' OR L.EMPRESA_ID = '{{empresaId}}')
   GROUP BY S.CODIGO, S.DESCRICAO, S.ORDEM ORDER BY S.ORDEM`,
  'Lancamentos por situacao, com filtro opcional de empresa',
);
await sfSQL(
  'resumoPorEmpresa',
  `SELECT E.ID AS EMPRESA_ID, E.NOME AS name, COUNT(*) AS value, COALESCE(SUM(L.VALOR_TOTAL), 0) AS VALOR
   ${JOIN_LANC} WHERE ${NONCE} AND ${VISIVEL()} AND ('{{status}}' = '' OR S.CODIGO = '{{status}}')
   GROUP BY E.ID, E.NOME ORDER BY value DESC LIMIT 12`,
  'Lancamentos por empresa, com filtro opcional de situacao',
);
await sfSQL(
  'lancamentosRecentes',
  `SELECT ${SELECT_LANC} ${JOIN_LANC} WHERE ${NONCE} AND ${VISIVEL()} AND ${FILTRO_PAINEL} ORDER BY L.ID DESC LIMIT 8`,
  'Ultimos lancamentos, com os filtros opcionais do painel',
);

fim('Nucleo pronto.');
