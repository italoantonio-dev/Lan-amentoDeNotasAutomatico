// Auditoria tecnica dos parametros de lancamento no Sankhya. SOMENTE LEITURA.
// Nao grava no ERP, nao grava no sistema, nao altera parametro nem executa lancamento.
//   cd backend && node auditoria/auditoria-parametros.mjs
// Saida em ../auditoria/: auditoria-tops.md, matriz-fornecedores.csv, divergencias-classificacao.csv,
// simulacao-alcadas.csv, regras-automacao.md, pendencias-aprovacao.csv, duplicidades-inconsistencias.csv
// e registro-analises.md (origem, periodo, filtros e linhas de cada consulta).
import fs from 'node:fs';
import path from 'node:path';
import { DIR_BACKEND } from '../lib/base.mjs';
import { ler, dicionario, exigirColunas, temColuna, registro } from './leitura.mjs';
import { analisarLinha, cnpjValido, cpfValido, soDigitos } from './validacoes.mjs';

const SAIDA = path.join(DIR_BACKEND, '..', 'auditoria');
fs.mkdirSync(SAIDA, { recursive: true });

// ---------- Escopo ----------
const EMPRESAS = [200, 300, 100, 201, 301, 302, 400, 500, 202, 203, 501, 700, 600];
const FOCO = [1607, 1600, 1112, 1403, 1404, 1609];
const LIMITES = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
const hoje = new Date();
const ini = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 12, 1)).toISOString().slice(0, 10);
const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1)).toISOString().slice(0, 10);
const fimIncl = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 0)).toISOString().slice(0, 10);
const PERIODO = `DTNEG de ${ini} a ${fimIncl} (12 meses completos)`;
const PER = (a) => `${a}.DTNEG >= TO_DATE('${ini}', 'YYYY-MM-DD') AND ${a}.DTNEG < TO_DATE('${fim}', 'YYYY-MM-DD')`;
const IN_EMP = EMPRESAS.join(',');
const FILTRO_BASE = `TGFFIN.RECDESP = -1 (despesa), PROVISAO = 'N' (sem provisao de pedido), CODEMP em ${IN_EMP}`;
const meta = (objetivo, origem, filtros, periodo = PERIODO) => ({ objetivo, origem, periodo, filtros });

// ---------- 1. Validar tabelas e colunas ----------
const dic = await dicionario(['TGFFIN', 'TGFTOP', 'TGFCAB', 'TGFPAR', 'TGFNAT', 'TSICUS', 'TSICTA', 'TGFTIT', 'TSIEMP', 'TSIUSU']);
exigirColunas(dic, 'TGFFIN', ['NUFIN', 'NUNOTA', 'CODEMP', 'CODPARC', 'CODTIPOPER', 'CODNAT', 'CODCENCUS', 'CODCTABCOINT', 'CODTIPTIT', 'VLRDESDOB', 'DTNEG', 'DTVENC', 'NUMNOTA', 'SERIENOTA', 'ORIGEM', 'PROVISAO', 'RECDESP', 'LINHADIGITAVEL', 'CODBARRA', 'NOSSONUM', 'EMVPIX', 'CHAVECTE', 'CHAVENFEGNRE', 'CODBCO', 'DHBAIXA', 'CODRATEIO']);
exigirColunas(dic, 'TGFTOP', ['CODTIPOPER', 'DESCROPER', 'TIPMOV', 'ATIVO', 'ATUALFIN', 'TIPATUALFIN', 'ATUALEST', 'ATUALLIVFIS', 'ATUALCTB', 'ATUALCOM', 'NFE', 'TEMFINORIGEM', 'DHALTER']);
exigirColunas(dic, 'TGFCAB', ['NUNOTA', 'CODEMP', 'CODPARC', 'NUMNOTA', 'SERIENOTA', 'TIPMOV', 'CODTIPOPER', 'DTNEG', 'VLRNOTA', 'STATUSNOTA', 'CHAVENFE', 'CHAVECTE', 'STATUSNFE']);
exigirColunas(dic, 'TGFPAR', ['CODPARC', 'NOMEPARC', 'RAZAOSOCIAL', 'CGC_CPF', 'TIPPESSOA', 'FORNECEDOR', 'CLIENTE', 'ATIVO', 'CODBCO', 'CODAGE', 'CODCTABCO', 'CHAVEPIX']);
exigirColunas(dic, 'TGFNAT', ['CODNAT', 'DESCRNAT', 'CODNATPAI', 'ATIVA']);
exigirColunas(dic, 'TSICUS', ['CODCENCUS', 'DESCRCENCUS', 'ATIVO']);
exigirColunas(dic, 'TSICTA', ['CODCTABCOINT', 'DESCRICAO', 'ATIVA']);
exigirColunas(dic, 'TGFTIT', ['CODTIPTIT', 'DESCRTIPTIT', 'ATIVO']);
exigirColunas(dic, 'TSIEMP', ['CODEMP', 'NOMEFANTASIA']);
exigirColunas(dic, 'TSIUSU', ['CODUSU', 'EMAIL', 'VLRMAXAUT']);
const CTA_EMP = temColuna(dic, 'TSICTA', 'CODEMP');

// ---------- 2. Nomes ----------
const nomes = { NAT: {}, CEN: {}, CTA: {}, TIT: {}, TOP: {}, EMP: {} };
for (const r of await ler(`SELECT N.CODNAT, N.DESCRNAT, N.ATIVA, P.DESCRNAT AS GRUPO FROM TGFNAT N LEFT JOIN TGFNAT P ON P.CODNAT = N.CODNATPAI`, meta('Nomes e grupos de natureza', 'TGFNAT', 'todas', '—'))) nomes.NAT[r.CODNAT] = { d: r.DESCRNAT, ativo: r.ATIVA === 'S', grupo: r.GRUPO };
for (const r of await ler(`SELECT CODCENCUS, DESCRCENCUS, ATIVO FROM TSICUS`, meta('Nomes de centros', 'TSICUS', 'todos', '—'))) nomes.CEN[r.CODCENCUS] = { d: r.DESCRCENCUS, ativo: r.ATIVO === 'S' };
for (const r of await ler(`SELECT CODCTABCOINT, DESCRICAO, ATIVA${CTA_EMP ? ', CODEMP' : ''} FROM TSICTA`, meta('Nomes de contas', 'TSICTA', 'todas', '—'))) nomes.CTA[r.CODCTABCOINT] = { d: r.DESCRICAO, ativo: r.ATIVA === 'S', emp: r.CODEMP };
for (const r of await ler(`SELECT CODTIPTIT, DESCRTIPTIT, ATIVO FROM TGFTIT`, meta('Nomes de tipos de titulo', 'TGFTIT', 'todos', '—'))) nomes.TIT[r.CODTIPTIT] = { d: r.DESCRTIPTIT, ativo: r.ATIVO === 'S' };
for (const r of await ler(`SELECT CODEMP, NOMEFANTASIA FROM TSIEMP`, meta('Nomes de empresas', 'TSIEMP', 'todas', '—'))) nomes.EMP[r.CODEMP] = { d: r.NOMEFANTASIA };
const TOPV = `TOPV AS (SELECT CODTIPOPER, TIPMOV, DESCROPER, ATIVO FROM (SELECT T.CODTIPOPER, T.TIPMOV, T.DESCROPER, T.ATIVO, ROW_NUMBER() OVER (PARTITION BY T.CODTIPOPER ORDER BY T.DHALTER DESC) AS RN FROM TGFTOP T) WHERE RN = 1)`;
for (const r of await ler(`WITH ${TOPV} SELECT CODTIPOPER, TIPMOV, DESCROPER, ATIVO FROM TOPV`, meta('Versao vigente de cada TOP', 'TGFTOP (maior DHALTER por codigo)', 'todas', '—'))) nomes.TOP[r.CODTIPOPER] = { d: r.DESCROPER, ativo: r.ATIVO === 'S', tipmov: r.TIPMOV };
const nm = (g, c) => (c == null || c === 'null' ? '(vazio)' : `${c} ${nomes[g][c]?.d ?? '(sem cadastro)'}`.trim());

// ---------- 3. Base: cada titulo de despesa com a categoria da operacao real ----------
// A categoria nao vem do nome da TOP: vem do grupo e da descricao da natureza, do tipo de titulo,
// da chave de CT-e, da origem e do movimento da TOP. Ordem de prioridade documentada em regras-automacao.md.
const CATEGORIA = `CASE
  WHEN F.ORIGEM = 'P' THEN 'FOLHA_INTEGRADA'
  WHEN F.CHAVECTE IS NOT NULL OR C.CHAVECTE IS NOT NULL THEN 'CTE_FRETE'
  WHEN F.ORIGEM = 'E' AND T.TIPMOV = 'C' AND C.CHAVENFE IS NOT NULL THEN 'NOTA_FISCAL'
  WHEN F.ORIGEM = 'E' AND T.TIPMOV = 'C' THEN 'NOTA_SERVICO'
  WHEN UPPER(NP.DESCRNAT) LIKE '%FOLHA%' AND REGEXP_LIKE(UPPER(N.DESCRNAT), 'INSS|GPS|FGTS|IRRF|SINDICAL') THEN 'GUIA_ENCARGO_FOLHA'
  WHEN UPPER(NP.DESCRNAT) LIKE '%FOLHA%' AND REGEXP_LIKE(UPPER(N.DESCRNAT), 'SALARI|HORAS EXTRAS|BONUS|RESCIS|FERIAS|PREMIA|INDENIZ|13 SAL') THEN 'FOLHA_PAGAMENTO'
  WHEN UPPER(NP.DESCRNAT) LIKE '%TRIBUT%' OR REGEXP_LIKE(UPPER(N.DESCRNAT), 'ICMS|ISSQN|IRPJ|CSLL|PIS |COFINS|DIFAL|IR RETIDO|IMPOSTO|TRIBUT|TAXA DE IMPORTA|MULTAS FISCAIS') OR REGEXP_LIKE(UPPER(TT.DESCRTIPTIT), 'DARF|DAE|GNRE|GPS|DAS') THEN 'GUIA_IMPOSTO'
  WHEN UPPER(T.DESCROPER) LIKE '%CT-E%' AND UPPER(N.DESCRNAT) LIKE '%FRETE%' THEN 'CTE_FRETE'
  WHEN REGEXP_LIKE(UPPER(T.DESCROPER) || ' ' || UPPER(N.DESCRNAT), 'ADIANTAMENTO') THEN 'ADIANTAMENTO'
  WHEN UPPER(TT.DESCRTIPTIT) LIKE '%DEBITO AUTOMATICO%' OR UPPER(T.DESCROPER) LIKE '%BANC%' THEN 'DEBITO_AUTOMATICO_TARIFA'
  WHEN F.LINHADIGITAVEL IS NOT NULL OR F.CODBARRA IS NOT NULL OR UPPER(TT.DESCRTIPTIT) LIKE '%BOLETO%' THEN 'BOLETO'
  WHEN F.ORIGEM = 'E' THEN 'NOTA_OUTRA_OPERACAO'
  ELSE 'OUTRO_FINANCEIRO' END`;
const BASE = `WITH ${TOPV},
B AS (SELECT F.NUFIN, F.NUNOTA, F.CODEMP, F.CODPARC, F.CODTIPOPER, F.CODNAT, F.CODCENCUS, F.CODCTABCOINT, F.CODTIPTIT, F.VLRDESDOB, F.DTNEG, F.DTVENC, F.NUMNOTA, F.SERIENOTA, F.ORIGEM,
  F.LINHADIGITAVEL, F.CODBARRA, F.NOSSONUM, F.EMVPIX, F.CHAVECTE, F.CHAVENFEGNRE, F.CODBCO, TT.DESCRTIPTIT AS TIT_DESC, T.TIPMOV,
  CASE WHEN F.NUNOTA IS NOT NULL THEN 'N' || F.NUNOTA ELSE 'F' || F.NUFIN END AS DOC,
  ${CATEGORIA} AS CATEGORIA
  FROM TGFFIN F
  LEFT JOIN TOPV T ON T.CODTIPOPER = F.CODTIPOPER
  LEFT JOIN TGFNAT N ON N.CODNAT = F.CODNAT
  LEFT JOIN TGFNAT NP ON NP.CODNAT = N.CODNATPAI
  LEFT JOIN TGFTIT TT ON TT.CODTIPTIT = F.CODTIPTIT
  LEFT JOIN TGFCAB C ON C.NUNOTA = F.NUNOTA
  WHERE F.RECDESP = -1 AND F.PROVISAO = 'N' AND F.CODEMP IN (${IN_EMP}) AND ${PER('F')})`;

console.log('Escopo e categorias...');
const escopo = await ler(`SELECT F.CODEMP, SUM(CASE WHEN F.PROVISAO = 'N' THEN 1 ELSE 0 END) AS TITULOS, SUM(CASE WHEN F.PROVISAO = 'S' THEN 1 ELSE 0 END) AS PROVISOES,
  ROUND(SUM(CASE WHEN F.PROVISAO = 'N' THEN F.VLRDESDOB END), 2) AS VALOR, COUNT(DISTINCT CASE WHEN F.PROVISAO = 'N' THEN F.CODPARC END) AS PARCEIROS,
  COUNT(DISTINCT CASE WHEN F.PROVISAO = 'N' THEN F.CODTIPOPER END) AS TOPS
  FROM TGFFIN F WHERE F.RECDESP = -1 AND F.CODEMP IN (${IN_EMP}) AND ${PER('F')} GROUP BY F.CODEMP ORDER BY TITULOS DESC`, meta('Volume por empresa (titulos reais e provisoes)', 'TGFFIN', `RECDESP = -1, CODEMP em ${IN_EMP}`));
const origem = await ler(`SELECT F.ORIGEM, F.PROVISAO, COUNT(*) AS N FROM TGFFIN F WHERE F.RECDESP = -1 AND F.CODEMP IN (${IN_EMP}) AND ${PER('F')} GROUP BY F.ORIGEM, F.PROVISAO ORDER BY N DESC`, meta('Origem x provisao', 'TGFFIN', `RECDESP = -1, CODEMP em ${IN_EMP}`));
const catEmp = await ler(`${BASE} SELECT CODEMP, CATEGORIA, COUNT(*) AS TITULOS, COUNT(DISTINCT DOC) AS DOCS, ROUND(SUM(VLRDESDOB), 2) AS VALOR FROM B GROUP BY CODEMP, CATEGORIA`, meta('Categoria real x empresa', 'TGFFIN + TGFTOP + TGFNAT + TGFTIT', FILTRO_BASE));
const catTop = await ler(`${BASE} SELECT CODTIPOPER, CATEGORIA, COUNT(*) AS TITULOS, COUNT(DISTINCT DOC) AS DOCS, ROUND(SUM(VLRDESDOB), 2) AS VALOR FROM B GROUP BY CODTIPOPER, CATEGORIA`, meta('Categoria real x TOP', 'TGFFIN + TGFTOP + TGFNAT + TGFTIT', FILTRO_BASE));

// TOPs analisadas: foco + as 14 mais usadas.
const porTop = {};
catTop.forEach((r) => { porTop[r.CODTIPOPER] = (porTop[r.CODTIPOPER] ?? 0) + Number(r.DOCS); });
const maisUsadas = Object.entries(porTop).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([c]) => Number(c));
const TOPS = [...new Set([...FOCO, ...maisUsadas])];
const IN_TOPS = TOPS.join(',');

console.log('TOPs...');
const topCfg = await ler(`SELECT CODTIPOPER, DESCROPER, TIPMOV, ATIVO, ATUALFIN, TIPATUALFIN, ATUALEST, ATUALLIVFIS, ATUALCTB, ATUALCOM, NFE, TEMFINORIGEM,
  TO_CHAR(DHALTER, 'YYYY-MM-DD') AS ULTIMA_VERSAO, TO_CHAR(PRIMEIRA, 'YYYY-MM-DD') AS PRIMEIRA_VERSAO, VERSOES FROM (
  SELECT T.CODTIPOPER, T.DESCROPER, T.TIPMOV, T.ATIVO, T.ATUALFIN, T.TIPATUALFIN, T.ATUALEST, T.ATUALLIVFIS, T.ATUALCTB, T.ATUALCOM, T.NFE, T.TEMFINORIGEM, T.DHALTER,
    MIN(T.DHALTER) OVER (PARTITION BY T.CODTIPOPER) AS PRIMEIRA, COUNT(*) OVER (PARTITION BY T.CODTIPOPER) AS VERSOES,
    ROW_NUMBER() OVER (PARTITION BY T.CODTIPOPER ORDER BY T.DHALTER DESC) AS RN
  FROM TGFTOP T WHERE T.CODTIPOPER IN (${IN_TOPS})) WHERE RN = 1`, meta('Configuracao vigente das TOPs analisadas', 'TGFTOP', `CODTIPOPER em ${IN_TOPS}`, '— (cadastro)'));
const topUso = await ler(`${BASE} SELECT CODTIPOPER, COUNT(*) AS TITULOS, COUNT(DISTINCT DOC) AS DOCS, COUNT(DISTINCT CODEMP) AS EMPRESAS, COUNT(DISTINCT CODPARC) AS PARCEIROS,
  ROUND(SUM(VLRDESDOB), 2) AS VALOR, ROUND(MEDIAN(VLRDESDOB), 2) AS MEDIANA,
  SUM(CASE WHEN ORIGEM = 'E' THEN 1 ELSE 0 END) AS ORIG_NOTA, SUM(CASE WHEN ORIGEM = 'F' THEN 1 ELSE 0 END) AS ORIG_FIN, SUM(CASE WHEN ORIGEM NOT IN ('E', 'F') THEN 1 ELSE 0 END) AS ORIG_OUTRA
  FROM B WHERE CODTIPOPER IN (${IN_TOPS}) GROUP BY CODTIPOPER`, meta('Uso das TOPs analisadas', 'TGFFIN', `${FILTRO_BASE}, CODTIPOPER em ${IN_TOPS}`));
const topProv = await ler(`SELECT F.CODTIPOPER, COUNT(*) AS PROVISOES FROM TGFFIN F WHERE F.RECDESP = -1 AND F.PROVISAO = 'S' AND F.CODEMP IN (${IN_EMP}) AND ${PER('F')} AND F.CODTIPOPER IN (${IN_TOPS}) GROUP BY F.CODTIPOPER`, meta('Provisoes por TOP', 'TGFFIN', `RECDESP = -1, PROVISAO = 'S', CODTIPOPER em ${IN_TOPS}`));
const topEmp = await ler(`${BASE} SELECT CODTIPOPER, CODEMP, COUNT(DISTINCT DOC) AS DOCS FROM B WHERE CODTIPOPER IN (${FOCO.join(',')}) GROUP BY CODTIPOPER, CODEMP`, meta('TOPs do foco por empresa', 'TGFFIN', `${FILTRO_BASE}, CODTIPOPER em ${FOCO.join(',')}`));
const DIMSQL = { NATUREZA: 'CODNAT', CENTRO: 'CODCENCUS', CONTA: 'CODCTABCOINT', TITULO: 'CODTIPTIT' };
const topDim = {};
for (const [dim, col] of Object.entries(DIMSQL)) {
  const r = await ler(`${BASE}, G AS (SELECT CODTIPOPER, TO_CHAR(${col}) AS COD, COUNT(DISTINCT DOC) AS N FROM B WHERE CODTIPOPER IN (${IN_TOPS}) GROUP BY CODTIPOPER, ${col})
    SELECT CODTIPOPER, COD, N, TOT FROM (SELECT CODTIPOPER, COD, N, SUM(N) OVER (PARTITION BY CODTIPOPER) AS TOT, ROW_NUMBER() OVER (PARTITION BY CODTIPOPER ORDER BY N DESC, COD) AS RN FROM G) WHERE RN <= 6`,
  meta(`${dim} dentro de cada TOP analisada`, 'TGFFIN', `${FILTRO_BASE}, CODTIPOPER em ${IN_TOPS}`));
  r.forEach((x) => ((topDim[`${x.CODTIPOPER}:${dim}`] ??= [])).push({ cod: x.COD, n: Number(x.N), tot: Number(x.TOT), id: r.id }));
}
const notasCab = await ler(`SELECT C.CODTIPOPER, COUNT(*) AS NOTAS, SUM(CASE WHEN C.CHAVENFE IS NOT NULL THEN 1 ELSE 0 END) AS COM_CHAVE_NFE, SUM(CASE WHEN C.CHAVECTE IS NOT NULL THEN 1 ELSE 0 END) AS COM_CHAVE_CTE,
  SUM(CASE WHEN C.STATUSNOTA = 'L' THEN 1 ELSE 0 END) AS LIBERADAS, ROUND(MEDIAN(C.VLRNOTA), 2) AS MEDIANA
  FROM TGFCAB C WHERE C.TIPMOV = 'C' AND C.CODEMP IN (${IN_EMP}) AND ${PER('C')} GROUP BY C.CODTIPOPER`, meta('Notas de compra por TOP (cabecalho)', 'TGFCAB', `TIPMOV = 'C', CODEMP em ${IN_EMP}`));

console.log('Fornecedores...');
const totais = [];
const dimsForn = {};
const DIMF = { TOP: 'CODTIPOPER', NATUREZA: 'CODNAT', CENTRO: 'CODCENCUS', CONTA: 'CODCTABCOINT', TITULO: 'CODTIPTIT', CATEGORIA: 'CATEGORIA' };
for (const e of EMPRESAS) {
  const t = await ler(`${BASE} SELECT CODPARC, COUNT(*) AS TITULOS, COUNT(DISTINCT DOC) AS DOCS, ROUND(SUM(VLRDESDOB), 2) AS VALOR, ROUND(MEDIAN(VLRDESDOB), 2) AS MEDIANA,
    ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY VLRDESDOB), 2) AS P90, TO_CHAR(MIN(DTNEG), 'YYYY-MM-DD') AS PRIMEIRO, TO_CHAR(MAX(DTNEG), 'YYYY-MM-DD') AS ULTIMO,
    SUM(CASE WHEN REGEXP_LIKE(UPPER(TIT_DESC), 'TED|PIX|CREDITO EM CONTA|TRANSF') THEN 1 ELSE 0 END) AS PAGTO_TRANSF
    FROM B WHERE CODEMP = ${e} GROUP BY CODPARC`, meta(`Totais por fornecedor, empresa ${e}`, 'TGFFIN', `${FILTRO_BASE.replace(`CODEMP em ${IN_EMP}`, `CODEMP = ${e}`)}`));
  t.forEach((x) => totais.push({ ...x, CODEMP: e, id: t.id }));
  // Duas consultas por empresa, cada uma com tres dimensoes: menos chamadas ao ERP de producao.
  for (const grupo of [['TOP', 'NATUREZA', 'CENTRO'], ['CONTA', 'TITULO', 'CATEGORIA']]) {
    const sets = grupo.map((d) => `(CODPARC, ${DIMF[d]})`).join(', ');
    const qual = grupo.map((d) => `WHEN GROUPING(${DIMF[d]}) = 0 THEN '${d}'`).join(' ');
    const cod = grupo.map((d) => `WHEN GROUPING(${DIMF[d]}) = 0 THEN TO_CHAR(${DIMF[d]})`).join(' ');
    const r = await ler(`${BASE}, G AS (SELECT CODPARC, CASE ${qual} END AS DIM, CASE ${cod} END AS COD, COUNT(DISTINCT DOC) AS N FROM B WHERE CODEMP = ${e} GROUP BY GROUPING SETS (${sets}))
      SELECT CODPARC, DIM, COD, N FROM (SELECT CODPARC, DIM, COD, N, SUM(N) OVER (PARTITION BY CODPARC, DIM) AS TOT, ROW_NUMBER() OVER (PARTITION BY CODPARC, DIM ORDER BY N DESC, COD) AS RN FROM G) WHERE RN <= 3 AND TOT >= 2`,
    meta(`${grupo.join(', ')} por fornecedor, empresa ${e}`, 'TGFFIN', `${FILTRO_BASE.replace(`CODEMP em ${IN_EMP}`, `CODEMP = ${e}`)}, fornecedores com 2+ documentos`));
    r.forEach((x) => ((dimsForn[`${e}:${x.CODPARC}:${x.DIM}`] ??= [])).push({ cod: x.COD, n: Number(x.N), id: r.id }));
  }
}
const parceiros = {};
for (let k = 0; k < 3; k++) {
  const r = await ler(`SELECT P.CODPARC, P.NOMEPARC, P.RAZAOSOCIAL, P.CGC_CPF, P.TIPPESSOA, P.FORNECEDOR, P.CLIENTE, P.ATIVO,
    CASE WHEN P.CODBCO IS NOT NULL AND P.CODBCO <> 0 THEN 'S' ELSE 'N' END AS TEM_BANCO, CASE WHEN P.CODAGE IS NOT NULL THEN 'S' ELSE 'N' END AS TEM_AGENCIA,
    CASE WHEN P.CODCTABCO IS NOT NULL THEN 'S' ELSE 'N' END AS TEM_CONTA, CASE WHEN P.CHAVEPIX IS NOT NULL THEN 'S' ELSE 'N' END AS TEM_PIX
    FROM TGFPAR P WHERE MOD(P.CODPARC, 3) = ${k} AND P.CODPARC IN (SELECT F.CODPARC FROM TGFFIN F WHERE F.RECDESP = -1 AND F.PROVISAO = 'N' AND F.CODEMP IN (${IN_EMP}) AND ${PER('F')})`,
  meta(`Cadastro dos fornecedores pagos (parte ${k + 1} de 3)`, 'TGFPAR', `parceiros com titulo de despesa no periodo, MOD(CODPARC, 3) = ${k}`));
  r.forEach((x) => { parceiros[x.CODPARC] = { ...x, id: r.id }; });
}
const cgcDup = await ler(`SELECT P.CGC_CPF, COUNT(*) AS N, LISTAGG(P.CODPARC, ',') WITHIN GROUP (ORDER BY P.CODPARC) AS PARCEIROS FROM TGFPAR P
  WHERE P.ATIVO = 'S' AND LENGTH(P.CGC_CPF) IN (11, 14) AND P.CGC_CPF IN (SELECT P2.CGC_CPF FROM TGFPAR P2 WHERE P2.CODPARC IN (SELECT F.CODPARC FROM TGFFIN F WHERE F.RECDESP = -1 AND F.PROVISAO = 'N' AND F.CODEMP IN (${IN_EMP}) AND ${PER('F')}))
  GROUP BY P.CGC_CPF HAVING COUNT(*) > 1`, meta('CNPJ/CPF repetido entre parceiros ativos', 'TGFPAR', 'ATIVO = S, CGC_CPF de parceiros pagos no periodo', '— (cadastro)'));

console.log('Divergencias e duplicidades...');
const usoDim = {};
for (const [dim, col] of Object.entries({ ...DIMSQL, TOP: 'CODTIPOPER' })) {
  const r = await ler(`${BASE} SELECT CODEMP, TO_CHAR(${col}) AS COD, COUNT(DISTINCT DOC) AS DOCS, ROUND(SUM(VLRDESDOB), 2) AS VALOR FROM B GROUP BY CODEMP, ${col}`, meta(`${dim} usado por empresa`, 'TGFFIN', FILTRO_BASE));
  usoDim[dim] = r.map((x) => ({ ...x, id: r.id }));
}
const centroSufixo = await ler(`${BASE} SELECT CODEMP, CASE WHEN MOD(CODCENCUS, 1000) = CODEMP THEN 'MESMA' WHEN MOD(CODCENCUS, 1000) IN (${IN_EMP}) THEN 'OUTRA' ELSE 'NEUTRO' END AS SUFIXO,
  COUNT(DISTINCT DOC) AS DOCS FROM B WHERE CODCENCUS IS NOT NULL GROUP BY CODEMP, CASE WHEN MOD(CODCENCUS, 1000) = CODEMP THEN 'MESMA' WHEN MOD(CODCENCUS, 1000) IN (${IN_EMP}) THEN 'OUTRA' ELSE 'NEUTRO' END`,
meta('Convencao do centro: final do codigo = empresa?', 'TGFFIN', FILTRO_BASE));
const dupTit = await ler(`SELECT * FROM (${BASE} SELECT CODEMP, CODPARC, NUMNOTA, TO_CHAR(DTVENC, 'YYYY-MM-DD') AS VENC, VLRDESDOB, COUNT(*) AS TITULOS, COUNT(DISTINCT DOC) AS DOCS,
  LISTAGG(NUFIN, ',') WITHIN GROUP (ORDER BY NUFIN) AS NUFINS, LISTAGG(DISTINCT CATEGORIA, ',') WITHIN GROUP (ORDER BY CATEGORIA) AS CATEGORIAS
  FROM B WHERE NUMNOTA > 0 GROUP BY CODEMP, CODPARC, NUMNOTA, DTVENC, VLRDESDOB HAVING COUNT(DISTINCT DOC) > 1 ORDER BY VLRDESDOB DESC) WHERE ROWNUM <= 1500`,
meta('Titulos com mesma empresa, parceiro, numero, vencimento e valor em documentos diferentes', 'TGFFIN', `${FILTRO_BASE}, NUMNOTA > 0`));
const dupLinha = await ler(`${BASE} SELECT CODEMP, CODPARC, SUBSTR(NVL(LINHADIGITAVEL, CODBARRA), -10) AS FINAL_LINHA, COUNT(DISTINCT DOC) AS DOCS, LISTAGG(NUFIN, ',') WITHIN GROUP (ORDER BY NUFIN) AS NUFINS, MAX(VLRDESDOB) AS VALOR
  FROM B WHERE NVL(LINHADIGITAVEL, CODBARRA) IS NOT NULL GROUP BY CODEMP, CODPARC, NVL(LINHADIGITAVEL, CODBARRA) HAVING COUNT(DISTINCT DOC) > 1`,
meta('Mesma linha digitavel em documentos diferentes', 'TGFFIN', `${FILTRO_BASE}, LINHADIGITAVEL ou CODBARRA preenchido`));
const dupNfe = await ler(`SELECT C.CODEMP, C.CODPARC, SUBSTR(C.CHAVENFE, -12) AS FINAL_CHAVE, COUNT(*) AS NOTAS, LISTAGG(C.NUNOTA, ',') WITHIN GROUP (ORDER BY C.NUNOTA) AS NUNOTAS
  FROM TGFCAB C WHERE C.TIPMOV = 'C' AND C.CHAVENFE IS NOT NULL AND C.CODEMP IN (${IN_EMP}) AND ${PER('C')} GROUP BY C.CODEMP, C.CODPARC, C.CHAVENFE HAVING COUNT(*) > 1`,
meta('Mesma chave de NF-e em mais de uma nota de compra', 'TGFCAB', `TIPMOV = 'C', CHAVENFE preenchida, CODEMP em ${IN_EMP}`));
const dupNum = await ler(`SELECT C.CODEMP, C.CODPARC, C.NUMNOTA, C.SERIENOTA, COUNT(*) AS NOTAS, LISTAGG(C.NUNOTA, ',') WITHIN GROUP (ORDER BY C.NUNOTA) AS NUNOTAS, LISTAGG(DISTINCT C.CODTIPOPER, ',') WITHIN GROUP (ORDER BY C.CODTIPOPER) AS TOPS
  FROM TGFCAB C WHERE C.TIPMOV = 'C' AND C.STATUSNOTA = 'L' AND C.NUMNOTA > 0 AND C.CODEMP IN (${IN_EMP}) AND ${PER('C')} GROUP BY C.CODEMP, C.CODPARC, C.NUMNOTA, C.SERIENOTA HAVING COUNT(*) > 1`,
meta('Mesmo numero e serie de nota do mesmo parceiro mais de uma vez', 'TGFCAB', `TIPMOV = 'C', STATUSNOTA = 'L', NUMNOTA > 0, CODEMP em ${IN_EMP}`));

console.log('Alcadas e leitura...');
const colsLim = LIMITES.map((l) => `SUM(CASE WHEN V <= ${l} THEN 1 ELSE 0 END) AS Q${l}, ROUND(SUM(CASE WHEN V <= ${l} THEN V ELSE 0 END), 2) AS V${l}`).join(', ');
const simul = await ler(`${BASE}, D AS (SELECT CODEMP, CATEGORIA, DOC, SUM(VLRDESDOB) AS V FROM B GROUP BY CODEMP, CATEGORIA, DOC)
  SELECT NVL(TO_CHAR(CODEMP), 'TODAS') AS CODEMP, CATEGORIA, COUNT(*) AS DOCS, ROUND(SUM(V), 2) AS VALOR, ROUND(MEDIAN(V), 2) AS P50,
  ROUND(PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY V), 2) AS P80, ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY V), 2) AS P90,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY V), 2) AS P95, ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY V), 2) AS P99, ROUND(MAX(V), 2) AS MAXIMO, ${colsLim}
  FROM D GROUP BY GROUPING SETS ((CODEMP, CATEGORIA), (CATEGORIA))`,
meta('Distribuicao de valor por documento e simulacao de limites', 'TGFFIN', `${FILTRO_BASE}; valor do documento = soma dos titulos do mesmo NUNOTA ou NUFIN`));
const preenchimento = await ler(`${BASE} SELECT CATEGORIA, COUNT(*) AS TITULOS,
  SUM(CASE WHEN LINHADIGITAVEL IS NOT NULL THEN 1 ELSE 0 END) AS LINHADIGITAVEL, SUM(CASE WHEN CODBARRA IS NOT NULL THEN 1 ELSE 0 END) AS CODBARRA,
  SUM(CASE WHEN NOSSONUM IS NOT NULL THEN 1 ELSE 0 END) AS NOSSONUM, SUM(CASE WHEN EMVPIX IS NOT NULL THEN 1 ELSE 0 END) AS EMVPIX,
  SUM(CASE WHEN CHAVECTE IS NOT NULL THEN 1 ELSE 0 END) AS CHAVECTE, SUM(CASE WHEN CHAVENFEGNRE IS NOT NULL THEN 1 ELSE 0 END) AS CHAVENFEGNRE,
  SUM(CASE WHEN NUMNOTA > 0 THEN 1 ELSE 0 END) AS NUMNOTA, SUM(CASE WHEN SERIENOTA IS NOT NULL THEN 1 ELSE 0 END) AS SERIENOTA,
  SUM(CASE WHEN CODBCO IS NOT NULL AND CODBCO <> 0 THEN 1 ELSE 0 END) AS CODBCO, SUM(CASE WHEN DTVENC > DTNEG THEN 1 ELSE 0 END) AS VENC_APOS_EMISSAO
  FROM B GROUP BY CATEGORIA`, meta('Preenchimento dos identificadores por categoria', 'TGFFIN', FILTRO_BASE));
const amostraLinhas = await ler(`SELECT * FROM (${BASE} SELECT NVL(LINHADIGITAVEL, CODBARRA) AS LINHA, TO_CHAR(DTVENC, 'YYYY-MM-DD') AS VENC, VLRDESDOB, CATEGORIA
  FROM B WHERE NVL(LINHADIGITAVEL, CODBARRA) IS NOT NULL AND ORA_HASH(NUFIN, 19) = 0) WHERE ROWNUM <= 600`,
meta('Amostra de linhas digitaveis para validar digito, vencimento e valor', 'TGFFIN', `${FILTRO_BASE}, linha preenchida, amostra ORA_HASH(NUFIN, 19) = 0 (cerca de 5%)`));
const debito = await ler(`SELECT * FROM (${BASE} SELECT CODNAT, COUNT(DISTINCT DOC) AS DOCS FROM B WHERE CATEGORIA = 'DEBITO_AUTOMATICO_TARIFA' GROUP BY CODNAT ORDER BY DOCS DESC) WHERE ROWNUM <= 10`,
  meta('Naturezas dos documentos pagos por debito automatico ou tarifa', 'TGFFIN', `${FILTRO_BASE}, categoria debito automatico/tarifa`));
const usuarios = await ler(`SELECT COUNT(*) AS USUARIOS, COUNT(EMAIL) AS COM_EMAIL, COUNT(VLRMAXAUT) AS COM_ALCADA FROM TSIUSU`, meta('Usuarios do ERP com e-mail e alcada', 'TSIUSU', 'todos', '— (cadastro)'));

// ======================= Composicao dos entregaveis =======================
const pct = (n, t) => (t ? Math.round((1000 * n) / t) / 10 : 0);
const brl = (v) => (v == null ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const csvLinha = (l) => l.map((x) => { const t = String(x ?? ''); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }).join(';');
const gravarCsv = (nome, cab, linhas) => fs.writeFileSync(path.join(SAIDA, nome), `﻿${[cab, ...linhas].map(csvLinha).join('\n')}\n`);
const nomeEmp = (e) => nomes.EMP[e]?.d ?? '';
const ROT_CAT = {
  FOLHA_INTEGRADA: 'Folha vinda de integração (origem P)', NOTA_SERVICO: 'Nota de serviço (sem chave NF-e)',
  NOTA_FISCAL: 'NF-e de compra', CTE_FRETE: 'CT-e / frete', BOLETO: 'Boleto', GUIA_IMPOSTO: 'Guia tributária', GUIA_ENCARGO_FOLHA: 'Guia de encargo de folha',
  FOLHA_PAGAMENTO: 'Folha de pagamento', ADIANTAMENTO: 'Adiantamento', DEBITO_AUTOMATICO_TARIFA: 'Débito automático ou tarifa (sem documento a ler)', NOTA_OUTRA_OPERACAO: 'Nota de outra operação', OUTRO_FINANCEIRO: 'Outro financeiro',
};
const confianca = (docs, share) => (docs < 3 ? 'INSUFICIENTE' : share >= 90 && docs >= 5 ? 'ALTA' : share >= 70 ? 'MEDIA' : 'BAIXA');
const pendencias = [];
const pend = (tema, decisao, recomendacao, evidencia, ocorrencias, conf, risco, responsavel) => pendencias.push([`P${String(pendencias.length + 1).padStart(2, '0')}`, tema, decisao, recomendacao, evidencia, ocorrencias, conf, risco, responsavel, 'PENDENTE']);
const totalDocsCat = {};
catEmp.forEach((r) => { totalDocsCat[r.CATEGORIA] = (totalDocsCat[r.CATEGORIA] ?? 0) + Number(r.DOCS); });
const totalDocs = Object.values(totalDocsCat).reduce((a, b) => a + b, 0);

// Antes de acusar falta de dado bancario, medir se o cadastro usa esses campos.
const listaParc = Object.values(parceiros);
const usaBanco = listaParc.filter((p) => p.TEM_BANCO === 'S' || p.TEM_PIX === 'S').length;
const pctBanco = pct(usaBanco, listaParc.length);
const bancoConfiavel = pctBanco >= 30;

// ---------- matriz-fornecedores.csv ----------
const matriz = [];
const resumoForn = { fornecedores: 0, comHistorico: 0, porDim: {} };
for (const t of totais) {
  const p = parceiros[t.CODPARC] ?? {};
  const docs = Number(t.DOCS);
  const dom = (dim) => {
    const l = (dimsForn[`${t.CODEMP}:${t.CODPARC}:${dim}`] ?? []).slice().sort((a, b) => b.n - a.n);
    if (!l.length) return { cod: '', share: 0, conf: confianca(docs, 0), comp: '' };
    const share = pct(l[0].n, docs);
    return { cod: l[0].cod, share, conf: confianca(docs, share), comp: l.map((x) => `${x.cod}:${pct(x.n, docs)}%`).join(' | ') };
  };
  const D = Object.fromEntries(Object.keys(DIMF).map((k) => [k, dom(k)]));
  const doc = soDigitos(p.CGC_CPF);
  const docValido = doc.length === 14 ? cnpjValido(doc) : doc.length === 11 ? cpfValido(doc) : false;
  const flags = [];
  if (!doc) flags.push('SEM_CNPJ_CPF');
  else if (!docValido) flags.push('CNPJ_CPF_INVALIDO');
  if (p.FORNECEDOR !== 'S') flags.push('NAO_MARCADO_FORNECEDOR');
  if (p.ATIVO !== 'S') flags.push('PARCEIRO_INATIVO');
  if (bancoConfiavel && Number(t.PAGTO_TRANSF) > 0 && p.TEM_BANCO !== 'S' && p.TEM_PIX !== 'S') flags.push('PAGO_POR_TRANSFERENCIA_SEM_BANCO_OU_PIX');
  if (cgcDup.some((c) => c.CGC_CPF === p.CGC_CPF)) flags.push('CNPJ_EM_MAIS_DE_UM_PARCEIRO');
  const dimsOk = ['NATUREZA', 'CENTRO', 'CONTA', 'TITULO'].filter((k) => D[k].conf === 'ALTA' || D[k].conf === 'MEDIA');
  resumoForn.fornecedores++;
  if (docs >= 3) resumoForn.comHistorico++;
  for (const k of ['NATUREZA', 'CENTRO', 'CONTA', 'TITULO']) resumoForn.porDim[k] = (resumoForn.porDim[k] ?? 0) + (dimsOk.includes(k) ? 1 : 0);
  matriz.push([
    t.CODEMP, nomeEmp(t.CODEMP), t.CODPARC, p.RAZAOSOCIAL || p.NOMEPARC || '', doc, p.TIPPESSOA ?? '', p.FORNECEDOR ?? '', p.ATIVO ?? '',
    docs, t.TITULOS, t.VALOR, t.MEDIANA, t.P90, t.PRIMEIRO, t.ULTIMO,
    ROT_CAT[D.CATEGORIA.cod] ?? D.CATEGORIA.cod, D.CATEGORIA.share,
    nm('TOP', D.TOP.cod), D.TOP.share, D.TOP.conf,
    nm('NAT', D.NATUREZA.cod), D.NATUREZA.share, D.NATUREZA.conf,
    nm('CEN', D.CENTRO.cod), D.CENTRO.share, D.CENTRO.conf,
    nm('CTA', D.CONTA.cod), D.CONTA.share, D.CONTA.conf,
    nm('TIT', D.TITULO.cod), D.TITULO.share, D.TITULO.conf,
    dimsOk.length ? dimsOk.join(',') : 'NENHUMA', docs >= 3 && dimsOk.length && !flags.some((f) => /INVALIDO|SEM_CNPJ|INATIVO/.test(f)) ? 'SIM' : 'NAO',
    flags.join(','), `${t.id}; ${p.id ?? ''}`,
  ]);
}
matriz.sort((a, b) => a[0] - b[0] || b[8] - a[8]);
gravarCsv('matriz-fornecedores.csv', [
  'CODEMP', 'EMPRESA', 'CODPARC', 'FORNECEDOR', 'CNPJ_CPF', 'TIPPESSOA', 'MARCADO_FORNECEDOR', 'ATIVO', 'DOCUMENTOS_12M', 'TITULOS_12M', 'VALOR_12M', 'MEDIANA_TITULO', 'P90_TITULO', 'PRIMEIRO', 'ULTIMO',
  'CATEGORIA_DOMINANTE', 'CATEGORIA_PCT', 'TOP_DOMINANTE', 'TOP_PCT', 'TOP_CONFIANCA', 'NATUREZA_DOMINANTE', 'NATUREZA_PCT', 'NATUREZA_CONFIANCA', 'CENTRO_DOMINANTE', 'CENTRO_PCT', 'CENTRO_CONFIANCA',
  'CONTA_DOMINANTE', 'CONTA_PCT', 'CONTA_CONFIANCA', 'TIPO_TITULO_DOMINANTE', 'TIPO_TITULO_PCT', 'TIPO_TITULO_CONFIANCA', 'DIMENSOES_CONSISTENTES', 'APTO_A_SUGERIR', 'ALERTAS_CADASTRAIS', 'EVIDENCIA',
], matriz);

// ---------- divergencias-classificacao.csv ----------
const div = [];
const addDiv = (tipo, emp, codparc, forn, dim, dominante, pctDom, composicao, docs, valor, evid, conf, risco, resp) => div.push([tipo, emp, emp ? nomeEmp(emp) : '', codparc, forn, dim, dominante, pctDom, composicao, docs, valor, evid, conf, risco, resp]);
const RESP_DIM = { NATUREZA: 'Contabilidade', CENTRO: 'Controladoria / Contabilidade', CONTA: 'Financeiro (tesouraria)', TITULO: 'Financeiro' };
for (const t of totais) {
  const docs = Number(t.DOCS);
  if (docs < 3) continue;
  const p = parceiros[t.CODPARC] ?? {};
  for (const dim of ['NATUREZA', 'CENTRO', 'CONTA', 'TITULO']) {
    const l = (dimsForn[`${t.CODEMP}:${t.CODPARC}:${dim}`] ?? []).slice().sort((a, b) => b.n - a.n);
    if (!l.length) continue;
    const share = pct(l[0].n, docs);
    if (share >= 70) continue;
    const g = { NATUREZA: 'NAT', CENTRO: 'CEN', CONTA: 'CTA', TITULO: 'TIT' }[dim];
    addDiv(`${dim}_DISPERSA`, t.CODEMP, t.CODPARC, p.RAZAOSOCIAL || p.NOMEPARC || '', dim, nm(g, l[0].cod), share, l.map((x) => `${nm(g, x.cod)} ${pct(x.n, docs)}%`).join(' | '), docs, t.VALOR, l[0].id,
      docs >= 10 ? 'ALTA' : 'MEDIA', dim === 'NATUREZA' ? 'Herdar a natureza deste fornecedor classificaria errado parte dos documentos (a natureza muda por documento).' : 'O padrão não sustenta sugestão automática nesta dimensão.', RESP_DIM[dim]);
  }
}
const conv = { MESMA: 0, OUTRA: 0, NEUTRO: 0 };
centroSufixo.forEach((r) => { conv[r.SUFIXO] += Number(r.DOCS); });
const convencaoForte = pct(conv.MESMA, conv.MESMA + conv.OUTRA) >= 80;
for (const r of usoDim.CENTRO) {
  const c = Number(r.COD);
  if (!Number.isFinite(c)) continue;
  const suf = c % 1000;
  if (convencaoForte && suf !== Number(r.CODEMP) && EMPRESAS.includes(suf)) {
    addDiv('CENTRO_DE_OUTRA_EMPRESA', r.CODEMP, '', '', 'CENTRO', nm('CEN', r.COD), '', `final do código = empresa ${suf} (${nomeEmp(suf)})`, r.DOCS, r.VALOR, `${r.id}; ${centroSufixo.id}`,
      'MEDIA', 'Hipótese pela convenção de código (final = empresa). Pode ser rateio ou despesa compartilhada legítima.', 'Controladoria');
  }
}
const inativos = [['NATUREZA', 'NAT'], ['CENTRO', 'CEN'], ['CONTA', 'CTA'], ['TITULO', 'TIT'], ['TOP', 'TOP']];
for (const [dim, g] of inativos) {
  for (const r of usoDim[dim]) {
    const cad = nomes[g][r.COD];
    if (r.COD == null || r.COD === '0') {
      if (dim !== 'TOP' && dim !== 'CONTA') addDiv('SEM_CLASSIFICACAO', r.CODEMP, '', '', dim, nm(g, r.COD), '', 'código vazio ou zero', r.DOCS, r.VALOR, r.id, 'ALTA', 'Lançamento sem esta dimensão não entra correto no resultado.', RESP_DIM[dim] ?? 'Contabilidade');
      continue;
    }
    if (cad && cad.ativo === false) addDiv('CADASTRO_INATIVO_EM_USO', r.CODEMP, '', '', dim, nm(g, r.COD), '', 'cadastro inativo usado no período', r.DOCS, r.VALOR, r.id, 'ALTA', 'Não pode virar sugestão: o sistema só usa cadastro ativo.', RESP_DIM[dim] ?? 'Contabilidade');
    if (dim === 'CONTA' && CTA_EMP && cad?.emp != null && Number(cad.emp) !== 0 && Number(cad.emp) !== Number(r.CODEMP)) addDiv('CONTA_DE_OUTRA_EMPRESA', r.CODEMP, '', '', 'CONTA', nm('CTA', r.COD), '', `conta cadastrada na empresa ${cad.emp}`, r.DOCS, r.VALOR, r.id, 'MEDIA', 'Pagamento por conta de outra empresa do grupo: confirmar se é intencional.', 'Financeiro (tesouraria)');
  }
}
// TOP x operacao: a TOP e usada para categorias diferentes das que o nome indica.
const catPorTop = {};
catTop.forEach((r) => { (catPorTop[r.CODTIPOPER] ??= []).push(r); });
for (const top of TOPS) {
  const l = (catPorTop[top] ?? []).slice().sort((a, b) => Number(b.DOCS) - Number(a.DOCS));
  const tot = l.reduce((s, x) => s + Number(x.DOCS), 0);
  if (!tot) continue;
  for (const x of l.slice(1)) {
    if (pct(Number(x.DOCS), tot) < 2) continue;
    addDiv('TOP_USADA_EM_OUTRA_OPERACAO', '', '', '', 'TOP', nm('TOP', top), pct(Number(l[0].DOCS), tot), `${ROT_CAT[x.CATEGORIA] ?? x.CATEGORIA} ${pct(Number(x.DOCS), tot)}% (dominante: ${ROT_CAT[l[0].CATEGORIA] ?? l[0].CATEGORIA})`, x.DOCS, x.VALOR, catTop.id, 'MEDIA', 'Um parâmetro único por tipo de documento classificaria esta parcela com a operação errada.', 'Contabilidade');
  }
}
gravarCsv('divergencias-classificacao.csv', ['TIPO_DIVERGENCIA', 'CODEMP', 'EMPRESA', 'CODPARC', 'FORNECEDOR', 'DIMENSAO', 'DOMINANTE', 'PCT_DOMINANTE', 'COMPOSICAO', 'DOCUMENTOS', 'VALOR', 'EVIDENCIA', 'CONFIANCA', 'RISCO', 'RESPONSAVEL'], div);

// ---------- duplicidades-inconsistencias.csv ----------
const dup = [];
dupTit.forEach((r) => dup.push(['TITULO_REPETIDO', r.CODEMP, nomeEmp(r.CODEMP), r.CODPARC, parceiros[r.CODPARC]?.RAZAOSOCIAL || parceiros[r.CODPARC]?.NOMEPARC || '', `numero ${r.NUMNOTA}, venc ${r.VENC}, valor ${r.VLRDESDOB}`, r.DOCS, r.VLRDESDOB, `NUFIN ${r.NUFINS}`, r.CATEGORIAS, dupTit.id, 'MEDIA', 'Pode ser duplicidade real ou parcelas legítimas iguais; conferir no ERP.', 'Financeiro']));
dupLinha.forEach((r) => dup.push(['LINHA_DIGITAVEL_REPETIDA', r.CODEMP, nomeEmp(r.CODEMP), r.CODPARC, parceiros[r.CODPARC]?.RAZAOSOCIAL || parceiros[r.CODPARC]?.NOMEPARC || '', `linha terminada em ${r.FINAL_LINHA}`, r.DOCS, r.VALOR, `NUFIN ${r.NUFINS}`, '', dupLinha.id, 'ALTA', 'O mesmo boleto lançado em mais de um documento: risco de pagamento em dobro.', 'Financeiro']));
dupNfe.forEach((r) => dup.push(['CHAVE_NFE_REPETIDA', r.CODEMP, nomeEmp(r.CODEMP), r.CODPARC, parceiros[r.CODPARC]?.RAZAOSOCIAL || '', `chave terminada em ${r.FINAL_CHAVE}`, r.NOTAS, '', `NUNOTA ${r.NUNOTAS}`, '', dupNfe.id, 'ALTA', 'A mesma NF-e entrou mais de uma vez.', 'Fiscal']));
dupNum.forEach((r) => dup.push(['NUMERO_SERIE_REPETIDO', r.CODEMP, nomeEmp(r.CODEMP), r.CODPARC, parceiros[r.CODPARC]?.RAZAOSOCIAL || '', `nota ${r.NUMNOTA} série ${r.SERIENOTA ?? ''}, TOPs ${r.TOPS}`, r.NOTAS, '', `NUNOTA ${r.NUNOTAS}`, '', dupNum.id, 'MEDIA', 'Mesmo número e série do mesmo parceiro em mais de uma nota liberada.', 'Fiscal']));
cgcDup.forEach((r) => dup.push(['CNPJ_EM_MAIS_DE_UM_PARCEIRO', '', '', r.PARCEIROS, '', `CNPJ/CPF ${r.CGC_CPF}`, r.N, '', '', '', cgcDup.id, 'ALTA', 'O envio para e pergunta qual parceiro usar; o cadastro precisa de um parceiro principal.', 'Cadastro / Financeiro']));
const cad = { semDoc: 0, invalido: 0, naoForn: 0, inativo: 0, semBanco: 0 };
for (const t of totais) {
  const p = parceiros[t.CODPARC];
  if (!p) continue;
  const doc = soDigitos(p.CGC_CPF);
  const valido = doc.length === 14 ? cnpjValido(doc) : doc.length === 11 ? cpfValido(doc) : false;
  const base = [t.CODEMP, nomeEmp(t.CODEMP), t.CODPARC, p.RAZAOSOCIAL || p.NOMEPARC || ''];
  if (!doc) { cad.semDoc++; dup.push(['PARCEIRO_SEM_CNPJ_CPF', ...base, 'parceiro pago sem CNPJ/CPF', t.DOCS, t.VALOR, '', '', p.id, 'ALTA', 'Sem documento, a leitura não casa o fornecedor e a duplicidade no ERP não é conferida.', 'Cadastro']); } else if (!valido) { cad.invalido++; dup.push(['CNPJ_CPF_INVALIDO', ...base, `documento ${doc}`, t.DOCS, t.VALOR, '', '', p.id, 'ALTA', 'Dígito verificador não confere: o casamento por CNPJ falha.', 'Cadastro']); }
  if (p.FORNECEDOR !== 'S') { cad.naoForn++; dup.push(['PAGO_SEM_MARCA_DE_FORNECEDOR', ...base, 'FORNECEDOR <> S', t.DOCS, t.VALOR, '', '', p.id, 'ALTA', 'Nota de entrada é recusada pelo gatilho do ERP (ORA-20101) quando o parceiro não é fornecedor.', 'Cadastro / Fiscal']); }
  if (p.ATIVO !== 'S') { cad.inativo++; dup.push(['PARCEIRO_INATIVO_COM_PAGAMENTO', ...base, 'ATIVO <> S', t.DOCS, t.VALOR, '', '', p.id, 'MEDIA', 'O sistema só procura parceiro ativo: o documento pararia sem parceiro.', 'Cadastro']); }
  if (bancoConfiavel && Number(t.PAGTO_TRANSF) > 0 && p.TEM_BANCO !== 'S' && p.TEM_PIX !== 'S') { cad.semBanco++; dup.push(['TRANSFERENCIA_SEM_DADO_BANCARIO', ...base, `${t.PAGTO_TRANSF} títulos por TED/PIX/crédito em conta`, t.DOCS, t.VALOR, '', '', p.id, 'MEDIA', 'Pagamento por transferência sem banco nem PIX no cadastro do parceiro.', 'Financeiro (tesouraria)']); }
}
if (!bancoConfiavel) dup.push(['DADO_BANCARIO_FORA_DO_CADASTRO_DO_PARCEIRO', '', '', '', '', `só ${pctBanco}% dos ${listaParc.length} parceiros pagos têm banco ou PIX no cadastro (TGFPAR)`, listaParc.length, '', '', '', Object.values(parceiros)[0]?.id ?? '', 'BAIXA', 'O ERP provavelmente guarda a conta de pagamento em outro lugar; a falta não foi marcada por fornecedor.', 'Financeiro (tesouraria) + TI']);
gravarCsv('duplicidades-inconsistencias.csv', ['TIPO', 'CODEMP', 'EMPRESA', 'CODPARC', 'PARCEIRO', 'DETALHE', 'DOCUMENTOS', 'VALOR', 'REFERENCIAS_ERP', 'CATEGORIAS', 'EVIDENCIA', 'CONFIANCA', 'RISCO', 'RESPONSAVEL'], dup);

// ---------- simulacao-alcadas.csv ----------
const sim = [];
for (const r of simul) {
  for (const l of LIMITES) {
    const q = Number(r[`Q${l}`]);
    const v = Number(r[`V${l}`]);
    sim.push([r.CODEMP, r.CODEMP === 'TODAS' ? 'Todas as 13' : nomeEmp(r.CODEMP), r.CATEGORIA, ROT_CAT[r.CATEGORIA] ?? r.CATEGORIA, r.DOCS, r.VALOR, r.P50, r.P80, r.P90, r.P95, r.P99, r.MAXIMO,
      l, q, pct(q, Number(r.DOCS)), Math.round(v * 100) / 100, pct(v, Number(r.VALOR)), Number(r.DOCS) - q, Math.round((Number(r.VALOR) - v) * 100) / 100, simul.id]);
  }
}
gravarCsv('simulacao-alcadas.csv', ['CODEMP', 'EMPRESA', 'CATEGORIA', 'CATEGORIA_DESCRICAO', 'DOCUMENTOS_12M', 'VALOR_12M', 'P50', 'P80', 'P90', 'P95', 'P99', 'MAXIMO',
  'LIMITE_SIMULADO', 'DOCS_ATE_O_LIMITE', 'PCT_DOCS_ATE_O_LIMITE', 'VALOR_ATE_O_LIMITE', 'PCT_VALOR_ATE_O_LIMITE', 'DOCS_PARA_APROVACAO', 'VALOR_PARA_APROVACAO', 'EVIDENCIA'], sim);

// ---------- Validacao das linhas digitaveis ----------
const lin = { total: amostraLinhas.length, validas: 0, boleto: 0, arrec: 0, vencOk: 0, valorOk: 0, comVenc: 0 };
for (const a of amostraLinhas) {
  const r = analisarLinha(a.LINHA);
  if (r.tipo === 'BOLETO') lin.boleto++;
  if (r.tipo === 'ARRECADACAO') lin.arrec++;
  if (r.valida) lin.validas++;
  if (r.tipo === 'BOLETO' && r.valida) {
    lin.comVenc++;
    if (r.vencimentos.includes(a.VENC)) lin.vencOk++;
    if (Math.abs(r.valor - Number(a.VLRDESDOB)) < 0.01) lin.valorOk++;
  }
}

// ---------- auditoria-tops.md ----------
const md = [];
const cfg = Object.fromEntries(topCfg.map((t) => [t.CODTIPOPER, t]));
const uso = Object.fromEntries(topUso.map((t) => [t.CODTIPOPER, t]));
const prov = Object.fromEntries(topProv.map((t) => [t.CODTIPOPER, t.PROVISOES]));
const cab = Object.fromEntries(notasCab.map((t) => [t.CODTIPOPER, t]));
md.push(`# Auditoria das TOPs e dos parâmetros de lançamento — Grupo Lidon\n`);
md.push(`**Somente leitura.** Nenhum dado foi gravado no ERP nem no sistema. Nenhum parâmetro foi cadastrado.\n`);
md.push(`| Item | Valor |\n|---|---|\n| Origem | Oracle do Sankhya, via consulta (DbExplorer), tabelas validadas no dicionário (\`USER_TAB_COLUMNS\`) antes do uso |\n| Período | ${PERIODO} |\n| Empresas | ${EMPRESAS.map((e) => `${e} ${nomeEmp(e)}`).join('; ')} |\n| Filtro base | ${FILTRO_BASE} |\n| Unidade | documento = NUNOTA (título vindo de nota) ou NUFIN (título financeiro avulso); parcelas da mesma nota contam uma vez |\n| Rastreio | cada número entre colchetes, como [A012], é uma consulta registrada em \`registro-analises.md\` |\n`);
md.push(`> O padrão mais frequente é **evidência**, não verdade. Onde a frequência e o significado da operação discordam, a recomendação diz isso e pede a decisão de quem responde pela área.\n`);

md.push(`## 1. Escopo por empresa [${escopo.id}]\n`);
md.push(`| Empresa | Títulos reais | Provisões (fora da análise) | Valor dos títulos | Fornecedores | TOPs |\n|---|---:|---:|---:|---:|---:|`);
escopo.forEach((e) => md.push(`| ${e.CODEMP} ${nomeEmp(e.CODEMP)} | ${e.TITULOS} | ${e.PROVISOES} | ${brl(e.VALOR)} | ${e.PARCEIROS} | ${e.TOPS} |`));
md.push(`\nOrigem dos títulos [${origem.id}]: ${origem.map((o) => `ORIGEM ${o.ORIGEM} / PROVISAO ${o.PROVISAO}: ${o.N}`).join('; ')}. Provisões são títulos de pedido de compra, sem documento fiscal: ficam fora dos padrões e das alçadas.\n`);

md.push(`## 2. Operação real dos documentos [${catEmp.id}]\n`);
md.push(`Cada título foi classificado pela operação, não pelo nome da TOP (regras na seção 1 de \`regras-automacao.md\`).\n`);
md.push(`| Categoria | Documentos | % |\n|---|---:|---:|`);
Object.entries(totalDocsCat).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => md.push(`| ${ROT_CAT[c] ?? c} | ${n} | ${pct(n, totalDocs)}% |`));

md.push(`\n## 3. TOPs analisadas\n`);
md.push(`Foco pedido: ${FOCO.join(', ')}. Incluídas também as mais usadas no período: ${maisUsadas.filter((t) => !FOCO.includes(t)).join(', ')}.\n`);
md.push(`Configuração vigente [${topCfg.id}], uso [${topUso.id}], provisões [${topProv.id}], notas de compra [${notasCab.id}], composição por categoria [${catTop.id}].\n`);
const flagTop = (c) => `TIPMOV ${c.TIPMOV} · ativa ${c.ATIVO} · atualiza financeiro ${c.ATUALFIN}${c.TIPATUALFIN ? ` (${c.TIPATUALFIN})` : ''} · estoque ${c.ATUALEST} · livro fiscal ${c.ATUALLIVFIS} · contabilidade ${c.ATUALCTB} · NF-e ${c.NFE ?? '—'} · financeiro de origem ${c.TEMFINORIGEM ?? '—'} · ${c.VERSOES} versões (${c.PRIMEIRA_VERSAO} a ${c.ULTIMA_VERSAO})`;
for (const top of TOPS) {
  const c = cfg[top];
  const u = uso[top];
  if (!c) continue;
  const comp = (catPorTop[top] ?? []).slice().sort((a, b) => Number(b.DOCS) - Number(a.DOCS));
  const totC = comp.reduce((s, x) => s + Number(x.DOCS), 0);
  md.push(`\n### ${top} — ${c.DESCROPER}${FOCO.includes(top) ? ' (foco)' : ''}\n`);
  md.push(`- **Configuração:** ${flagTop(c)}`);
  if (u) md.push(`- **Uso:** ${u.DOCS} documentos, ${u.TITULOS} títulos, ${u.EMPRESAS} empresas, ${u.PARCEIROS} parceiros, ${brl(u.VALOR)}; mediana do título ${brl(u.MEDIANA)}; origem nota ${u.ORIG_NOTA} · financeiro ${u.ORIG_FIN} · outra ${u.ORIG_OUTRA}${prov[top] ? `; mais ${prov[top]} provisões` : ''}`);
  else md.push(`- **Uso:** nenhum título real no período${prov[top] ? ` (${prov[top]} provisões)` : ''}`);
  if (cab[top]) md.push(`- **Notas de compra (cabeçalho):** ${cab[top].NOTAS} notas, ${cab[top].COM_CHAVE_NFE} com chave NF-e, ${cab[top].COM_CHAVE_CTE} com chave CT-e, ${cab[top].LIBERADAS} liberadas; mediana ${brl(cab[top].MEDIANA)}`);
  if (comp.length) md.push(`- **Operação real:** ${comp.slice(0, 5).map((x) => `${ROT_CAT[x.CATEGORIA] ?? x.CATEGORIA} ${pct(Number(x.DOCS), totC)}%`).join(' · ')}`);
  for (const [dim, g] of [['NATUREZA', 'NAT'], ['CENTRO', 'CEN'], ['CONTA', 'CTA'], ['TITULO', 'TIT']]) {
    const l = topDim[`${top}:${dim}`];
    if (l?.length) md.push(`- **${dim[0]}${dim.slice(1).toLowerCase()}:** ${l.slice(0, 4).map((x) => `${nm(g, x.cod)} ${pct(x.n, x.tot)}%`).join(' · ')} [${l[0].id}]`);
  }
  if (FOCO.includes(top)) {
    const porE = topEmp.filter((x) => Number(x.CODTIPOPER) === top).sort((a, b) => Number(b.DOCS) - Number(a.DOCS));
    md.push(`- **Por empresa** [${topEmp.id}]: ${porE.map((x) => `${x.CODEMP}: ${x.DOCS}`).join(' · ') || 'sem uso'}`);
  }
  // Leitura e recomendacao
  const dominante = comp[0];
  const domPct = dominante ? pct(Number(dominante.DOCS), totC) : 0;
  const obs = [];
  if (/CT-?E/i.test(c.DESCROPER) && dominante && dominante.CATEGORIA !== 'CTE_FRETE') obs.push(`O nome diz CT-e, mas ${domPct}% dos documentos são ${ROT_CAT[dominante.CATEGORIA] ?? dominante.CATEGORIA}.`);
  if (c.ATIVO !== 'S') obs.push('A TOP está inativa na versão vigente, mas tem uso no período.');
  if (domPct && domPct < 80) obs.push(`Uso misto: a operação dominante tem ${domPct}% — um parâmetro único por tipo de documento não cobre esta TOP inteira.`);
  if (obs.length) md.push(`- **Leitura:** ${obs.join(' ')}`);
}

md.push(`\n## 4. Recomendações sobre TOP por tipo de documento\n`);
md.push(`Cada recomendação traz evidência, ocorrências, grau de confiança, risco e responsável. Nenhuma foi aplicada.\n`);
const recTop = (tipoDoc, categorias, filtroTop) => {
  const linhas = catTop.filter((r) => categorias.includes(r.CATEGORIA)).reduce((acc, r) => { acc[r.CODTIPOPER] = (acc[r.CODTIPOPER] ?? 0) + Number(r.DOCS); return acc; }, {});
  // Nao filtra: lista todas as TOPs observadas e marca as de movimento inesperado.
  const lista = Object.entries(linhas).sort((a, b) => b[1] - a[1]).map(([t, n]) => [t, n, !filtroTop || filtroTop(Number(t))]);
  const tot = lista.reduce((s, [, n]) => s + n, 0);
  return { lista, tot };
};
const tiposDoc = [
  ['Nota fiscal de entrada', ['NOTA_FISCAL'], 'Fiscal + Contabilidade', 'Nota com TOP errada atualiza estoque, livro fiscal e custo de forma errada.', (t) => nomes.TOP[t]?.tipmov === 'C'],
  ['Boleto', ['BOLETO'], 'Financeiro + Contabilidade', 'TOP financeira genérica; natureza e centro passam a depender do fornecedor.', (t) => nomes.TOP[t]?.tipmov === 'I'],
  ['Guia tributária', ['GUIA_IMPOSTO'], 'Fiscal', 'Tributo classificado em TOP de despesa comum perde a visão de impostos.', (t) => nomes.TOP[t]?.tipmov === 'I'],
  ['Folha de pagamento', ['FOLHA_INTEGRADA', 'FOLHA_PAGAMENTO'], 'RH + Contabilidade', 'A folha já entra no ERP por integração (origem P): lançar de novo por documento duplicaria.', (t) => nomes.TOP[t]?.tipmov === 'I'],
  ['Nota de serviço (NFS-e)', ['NOTA_SERVICO'], 'Fiscal', 'Sem chave de 44 dígitos: o leitor atual de NF-e não serve; precisa de critério próprio.', (t) => nomes.TOP[t]?.tipmov === 'C'],
  ['Encargos de folha (INSS, FGTS, IRRF)', ['GUIA_ENCARGO_FOLHA'], 'RH + Fiscal', 'Encargo é guia, não folha: decide se vira tipo próprio ou entra em Guia de Imposto.', (t) => nomes.TOP[t]?.tipmov === 'I'],
];
md.push(`| Tipo | TOPs observadas (documentos) | Cobertura da 1ª | Confiança | Risco | Responsável |\n|---|---|---:|---|---|---|`);
md.push(`<!-- ⚠ = a TOP é usada nesta operação, mas o movimento dela não é o esperado pelo sistema (C para nota, I para financeiro). -->`);
for (const [rot, cats, resp, risco, filtro] of tiposDoc) {
  const { lista, tot } = recTop(rot, cats, filtro);
  const prim = lista[0];
  const cob = prim ? pct(prim[1], tot) : 0;
  const conf = !prim ? 'SEM DADO' : !prim[2] ? 'BAIXA' : cob >= 80 ? 'ALTA' : cob >= 50 ? 'MEDIA' : 'BAIXA';
  md.push(`| ${rot} | ${lista.slice(0, 4).map(([t, n, ok]) => `${nm('TOP', t)} (${n})${ok ? '' : ` ⚠ movimento ${nomes.TOP[t]?.tipmov ?? '?'}`}`).join('; ') || '—'} | ${prim ? `${cob}% de ${tot}` : '—'} | ${conf} | ${risco} | ${resp} |`);
  pend(`TOP padrão — ${rot}`, `Confirmar a TOP padrão de ${rot.toLowerCase()} por empresa`, !prim ? 'Sem histórico: definir com a área.' : !prim[2] ? `A TOP mais usada (${nm('TOP', prim[0])}, ${cob}%) não é do movimento esperado: definir a TOP com a área antes de automatizar.` : `Partir de ${nm('TOP', prim[0])} (${cob}% dos documentos da categoria); onde a cobertura for baixa, manter correção manual por documento.`, `${catTop.id}; ${topCfg.id}`, tot, conf, risco, resp);
}

// Titulos que o proprio ERP cria a partir de outra nota (TOP de venda, transferencia ou devolucao):
// ja existem no ERP e nao devem ser lancados de novo por documento.
const geradosPeloErp = catTop.filter((r) => ['GUIA_IMPOSTO', 'BOLETO'].includes(r.CATEGORIA) && ['V', 'D', 'E', 'T'].includes(nomes.TOP[r.CODTIPOPER]?.tipmov));
const gerGuia = geradosPeloErp.filter((r) => r.CATEGORIA === 'GUIA_IMPOSTO').reduce((s, r) => s + Number(r.DOCS), 0);
const gerBoleto = geradosPeloErp.filter((r) => r.CATEGORIA === 'BOLETO').reduce((s, r) => s + Number(r.DOCS), 0);
md.push(`\n**Gerados pelo próprio ERP** [${catTop.id}]: ${gerGuia} das ${totalDocsCat.GUIA_IMPOSTO ?? 0} guias tributárias e ${gerBoleto} dos ${totalDocsCat.BOLETO ?? 0} boletos estão em TOPs de venda, transferência ou devolução (${geradosPeloErp.slice().sort((a, b) => Number(b.DOCS) - Number(a.DOCS)).slice(0, 5).map((r) => `${nm('TOP', r.CODTIPOPER)}: ${r.DOCS}`).join('; ')}). São impostos e valores que o ERP cria a partir da nota de saída: já existem no ERP e ficam fora da automação por documento.`);
pend('Títulos gerados pelo ERP', 'Confirmar que guias e boletos em TOP de venda, transferência ou devolução são criados pelo próprio ERP', 'Excluir esses títulos da automação: o robô só trata documento que chega de fora.', catTop.id, gerGuia + gerBoleto, 'MEDIA', 'Lançar de novo por documento duplicaria o imposto ou o valor.', 'Fiscal');

md.push(`\n## 5. Fornecedores com histórico [${totais[0]?.id ?? ''} e seguintes]\n`);
md.push(`- ${resumoForn.fornecedores} pares empresa × fornecedor com título no período; ${resumoForn.comHistorico} com 3 ou mais documentos.`);
md.push(`- Consistentes (≥ 3 documentos e ≥ 70% no mesmo código): natureza ${resumoForn.porDim.NATUREZA}, centro ${resumoForn.porDim.CENTRO}, conta ${resumoForn.porDim.CONTA}, tipo de título ${resumoForn.porDim.TITULO}.`);
md.push(`- Detalhe por fornecedor em \`matriz-fornecedores.csv\`; dispersões em \`divergencias-classificacao.csv\`.\n`);

md.push(`## 6. Duplicidades e cadastro\n`);
md.push(`| Achado | Ocorrências | Evidência |\n|---|---:|---|`);
md.push(`| Títulos com mesmo parceiro, número, vencimento e valor em documentos diferentes | ${dupTit.length} | ${dupTit.id} |`);
md.push(`| Mesma linha digitável em documentos diferentes | ${dupLinha.length} | ${dupLinha.id} |`);
md.push(`| Mesma chave de NF-e em mais de uma nota | ${dupNfe.length} | ${dupNfe.id} |`);
md.push(`| Mesmo número e série de nota do mesmo parceiro | ${dupNum.length} | ${dupNum.id} |`);
md.push(`| CNPJ/CPF em mais de um parceiro ativo (entre os pagos) | ${cgcDup.length} | ${cgcDup.id} |`);
md.push(`| Pares empresa × fornecedor: sem CNPJ/CPF · inválido · sem marca de fornecedor · inativo | ${cad.semDoc} · ${cad.invalido} · ${cad.naoForn} · ${cad.inativo} | ${Object.values(parceiros)[0]?.id ?? ''} |`);
md.push(`| Parceiros pagos com banco ou PIX no cadastro | ${usaBanco} de ${listaParc.length} (${pctBanco}%) | ${Object.values(parceiros)[0]?.id ?? ''} |`);
md.push(bancoConfiavel ? '' : `\nO cadastro do parceiro quase não tem dado bancário: a conta de pagamento deve estar em outro lugar do ERP. Por isso nenhum fornecedor foi acusado de "transferência sem banco"; a origem certa é pendência da tesouraria.`);
md.push(`\nDébito automático e tarifa [${debito.id}]: ${debito.slice(0, 6).map((x) => `${nm('NAT', x.CODNAT)} (${x.DOCS})`).join('; ')}. É forma de pagamento: o banco debita e não chega documento para o robô ler.`);
md.push(`\nDetalhe em \`duplicidades-inconsistencias.csv\`. Os números são sinais para conferir, não duplicidade confirmada.\n`);
md.push(`## 7. Centro de resultado e empresa [${centroSufixo.id}]\n`);
md.push(`Convenção observada: o final do código do centro coincide com a empresa em ${conv.MESMA} documentos, aponta para outra empresa do grupo em ${conv.OUTRA} e não segue a convenção em ${conv.NEUTRO}. ${convencaoForte ? 'A convenção é forte o bastante para marcar exceções como divergência (tipo CENTRO_DE_OUTRA_EMPRESA).' : 'A convenção não é forte: nenhuma exceção foi marcada.'} É uma hipótese tirada do padrão de códigos; a Controladoria confirma.\n`);
fs.writeFileSync(path.join(SAIDA, 'auditoria-tops.md'), md.join('\n'));

// ---------- regras-automacao.md ----------
const pr = Object.fromEntries(preenchimento.map((r) => [r.CATEGORIA, r]));
const fill = (c, campo) => (pr[c] ? `${pct(Number(pr[c][campo]), Number(pr[c].TITULOS))}%` : '—');
const rg = [];
rg.push(`# Regras de automação — leitura, classificação e alçada\n`);
rg.push(`Base: ${PERIODO}; ${FILTRO_BASE}. Toda regra abaixo é proposta: nada foi aplicado. As decisões ficam em \`pendencias-aprovacao.csv\`.\n`);
rg.push(`## 1. Separar o documento pela operação real [${catEmp.id}]\n`);
rg.push(`Ordem de prioridade (a primeira que casar vence):\n`);
rg.push(`| # | Categoria | Regra | Documentos | Confiança |\n|---|---|---|---:|---|`);
const regrasCat = [
  ['FOLHA_INTEGRADA', 'título com ORIGEM = P (no período, todos na TOP 1607 e com naturezas de folha): folha que já entra por integração'],
  ['GUIA_ENCARGO_FOLHA', 'natureza no grupo "Despesa com folha" e descrição com INSS, GPS, FGTS, IRRF ou sindical'],
  ['FOLHA_PAGAMENTO', 'natureza no grupo "Despesa com folha" e descrição de remuneração (salários, férias, rescisão, 13º salário, bônus, horas extras, premiação, indenização); comissão fica fora porque chega como nota de serviço'],
  ['GUIA_IMPOSTO', 'natureza no grupo de tributação ou descrição de tributo (ICMS, ISSQN, IRPJ, CSLL, PIS, COFINS, DIFAL, IR retido, taxa de importação, multa fiscal), ou tipo de título DARF/DAE/GNRE/GPS/DAS'],
  ['CTE_FRETE', 'chave de CT-e no título ou no cabeçalho da nota (avaliada logo depois da folha integrada); ou TOP de CT-e com natureza de frete'],
  ['NOTA_FISCAL', 'título vindo de nota (ORIGEM = E), TOP de compra (TIPMOV = C) e cabeçalho com chave de NF-e'],
  ['NOTA_SERVICO', 'título vindo de nota de compra sem chave de NF-e (nota de serviço municipal ou nota sem XML)'],
  ['ADIANTAMENTO', 'TOP ou natureza de adiantamento'],
  ['DEBITO_AUTOMATICO_TARIFA', 'tipo de título débito automático ou TOP bancária'],
  ['BOLETO', 'linha digitável ou código de barras preenchido, ou tipo de título boleto'],
  ['NOTA_OUTRA_OPERACAO', 'veio de nota com TOP que não é de compra'],
  ['OUTRO_FINANCEIRO', 'o que sobrar'],
];
const ORDEM_REAL = ['FOLHA_INTEGRADA', 'CTE_FRETE', 'NOTA_FISCAL', 'NOTA_SERVICO', 'GUIA_ENCARGO_FOLHA', 'FOLHA_PAGAMENTO', 'GUIA_IMPOSTO', 'ADIANTAMENTO', 'DEBITO_AUTOMATICO_TARIFA', 'BOLETO', 'NOTA_OUTRA_OPERACAO', 'OUTRO_FINANCEIRO'];
regrasCat.sort((a, b) => ORDEM_REAL.indexOf(a[0]) - ORDEM_REAL.indexOf(b[0]));
const CONF_REGRA = {
  FOLHA_INTEGRADA: 'ALTA (origem, TOP e natureza coincidem)', CTE_FRETE: 'ALTA (chave de CT-e)', NOTA_FISCAL: 'ALTA (chave de NF-e)',
  NOTA_SERVICO: 'MEDIA (ausência de chave; inclui energia e nota sem XML)', GUIA_ENCARGO_FOLHA: 'ALTA (grupo contábil + descrição)', FOLHA_PAGAMENTO: 'ALTA (grupo contábil + descrição)',
  GUIA_IMPOSTO: 'ALTA (grupo contábil, descrição ou tipo de título)', OUTRO_FINANCEIRO: 'BAIXA (residual)',
};
regrasCat.forEach(([c, regra], i) => rg.push(`| ${i + 1} | ${ROT_CAT[c]} | ${regra} | ${totalDocsCat[c] ?? 0} | ${CONF_REGRA[c] ?? 'MEDIA (descrição)'} |`));
rg.push(`\nPara o sistema: os quatro tipos atuais não cobrem CT-e, encargo de folha, adiantamento e débito automático (${['CTE_FRETE', 'GUIA_ENCARGO_FOLHA', 'ADIANTAMENTO', 'DEBITO_AUTOMATICO_TARIFA'].reduce((s, c) => s + (totalDocsCat[c] ?? 0), 0)} documentos no período), e a nota de serviço (${totalDocsCat.NOTA_SERVICO ?? 0}) precisa de leitura própria. Criar tipos novos é decisão de negócio (pendências). A folha de origem P já entra no ERP por integração (${totalDocsCat.FOLHA_INTEGRADA ?? 0} documentos) e não deve ser lançada de novo por documento.\n`);

rg.push(`## 2. O que é parâmetro e o que é padrão do fornecedor\n`);
rg.push(`- **TOP:** vem do parâmetro por empresa e tipo; nunca do fornecedor. Onde a TOP dominante cobre pouco da categoria, a pessoa corrige no lançamento.`);
rg.push(`- **Natureza, centro, conta e tipo de título:** o parâmetro é o ponto de partida; o histórico do fornecedor só vale com ≥ 3 documentos e ≥ 70% no mesmo código (confiança MÉDIA) ou ≥ 5 e ≥ 90% (ALTA). Abaixo disso, a sugestão não é automática.`);
rg.push(`- **Cadastro inativo** nunca vira sugestão, mesmo que seja o mais usado.`);
rg.push(`- **Centro de outra empresa:** só como alerta (hipótese de convenção de código), nunca bloqueio.\n`);

rg.push(`## 3. Campos da leitura de PDF e XML\n`);
rg.push(`Preenchimento atual no ERP, por categoria [${preenchimento.id}]:\n`);
rg.push(`| Categoria | Linha digitável | Código de barras | Nosso número | PIX (EMV) | Chave CT-e | Chave GNRE | Número | Série | Banco | Vencimento depois da emissão |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|`);
for (const c of Object.keys(pr)) rg.push(`| ${ROT_CAT[c] ?? c} | ${fill(c, 'LINHADIGITAVEL')} | ${fill(c, 'CODBARRA')} | ${fill(c, 'NOSSONUM')} | ${fill(c, 'EMVPIX')} | ${fill(c, 'CHAVECTE')} | ${fill(c, 'CHAVENFEGNRE')} | ${fill(c, 'NUMNOTA')} | ${fill(c, 'SERIENOTA')} | ${fill(c, 'CODBCO')} | ${fill(c, 'VENC_APOS_EMISSAO')} |`);
rg.push(`\nValidação de uma amostra de ${lin.total} linhas digitáveis do ERP [${amostraLinhas.id}]: ${lin.boleto} boletos bancários (47 dígitos), ${lin.arrec} de arrecadação (48 dígitos); ${lin.validas} com dígitos verificadores corretos (${pct(lin.validas, lin.total)}%). Nos boletos válidos, o vencimento calculado pelo fator bate com o do título em ${pct(lin.vencOk, lin.comVenc)}% e o valor embutido bate em ${pct(lin.valorOk, lin.comVenc)}%. **O campo CODBARRA guarda a linha digitável de 47 dígitos, não o código de barras de 44.**\n`);
rg.push(`| Documento | Campos obrigatórios | Validação | Onde gravar no ERP |\n|---|---|---|---|`);
rg.push(`| NF-e (XML) | chave de acesso, CNPJ emitente, CNPJ destinatário, número, série, emissão, valor total, duplicatas (número, vencimento, valor), itens (código, descrição, quantidade, unitário, NCM, CFOP) | chave: módulo 11 + UF + AAMM + modelo 55 + CNPJ da chave = emitente; destinatário = empresa cadastrada; soma das duplicatas = valor da nota; soma dos itens ≈ total | TGFCAB/TGFITE pelo serviço do ERP; duplicatas viram TGFFIN |`);
rg.push(`| NFS-e (nota de serviço) | número da NFS-e, código de verificação, município, CNPJ prestador, CNPJ tomador, competência, valor dos serviços, ISS (retido ou não), retenções federais, vencimento | CNPJ prestador = fornecedor; tomador = empresa; não há chave de 44 dígitos: a confiança precisa de critério próprio (número + código de verificação + CNPJ), senão toda NFS-e cai em revisão | TGFCAB/TGFFIN pela TOP de serviço |`);
rg.push(`| NF-e (PDF/DANFE) | os mesmos, lidos do texto; chave de 44 dígitos | idem; campo sem rótulo fica "conferir" | idem |`);
rg.push(`| CT-e | chave do CT-e (modelo 57), emitente, tomador, valor, vencimento | chave módulo 11 + modelo 57; tomador = empresa | TGFFIN.CHAVECTE |`);
rg.push(`| Boleto | linha digitável (47), beneficiário (nome/CNPJ), pagador (CNPJ), vencimento, valor, nosso número | dígitos dos 3 campos (módulo 10) + DV geral (módulo 11); fator → vencimento; últimos 10 dígitos → valor; pagador = empresa | TGFFIN.LINHADIGITAVEL, CODBARRA (hoje com a linha), NOSSONUM, CODBCO |`);
rg.push(`| Guia (DARF, DAE, GNRE, GPS, DAS) | linha de arrecadação (48), código da receita, período de apuração, CNPJ contribuinte, vencimento, valor | 4 blocos de 11 + DV (módulo 10 ou 11 conforme o 3º dígito); CNPJ = empresa; GNRE: chave da GNRE | TGFFIN.LINHADIGITAVEL, CHAVENFEGNRE; tipo de título DARF/DAE/GNRE |`);
rg.push(`| Folha | competência, empresa, verba (salário, férias, 13º, rescisão), valor líquido, vencimento; por funcionário quando houver | competência = mês fechado; total = soma das verbas | TGFFIN com natureza do grupo folha; tipo de título crédito em conta |`);
rg.push(`| PIX | payload EMV (copia e cola), chave, valor, recebedor | CRC16 do payload; recebedor = fornecedor | TGFFIN.EMVPIX |`);
rg.push(`| Dados bancários do fornecedor | banco, agência, conta, chave PIX | conta e PIX do cadastro do parceiro, não do documento | TGFPAR.CODBCO, CODAGE, CODCTABCO, CHAVEPIX |`);
rg.push(`\n**Lacunas do leitor atual do sistema:** não lê linha digitável, código de barras, nosso número, PIX, chave de CT-e, código de receita nem competência; não confere fator de vencimento nem valor embutido. Hoje boletos e guias dependem de rótulo de texto. São melhorias a aprovar antes de ligar o robô para esses tipos.\n`);

rg.push(`## 4. Alçada\n`);
rg.push(`- Nenhum usuário do ERP tem alçada cadastrada [${usuarios.id}]: ${usuarios[0].USUARIOS} usuários, ${usuarios[0].COM_EMAIL} com e-mail, ${usuarios[0].COM_ALCADA} com VLRMAXAUT.`);
rg.push(`- A simulação (\`simulacao-alcadas.csv\`) mostra, por empresa e categoria, quantos documentos e quanto valor ficariam abaixo de cada limite. Abaixo do limite o documento seria aprovado sem pessoa; acima, iria para aprovação. **Nenhum limite foi aplicado.**`);
const g = (cat) => simul.find((r) => r.CODEMP === 'TODAS' && r.CATEGORIA === cat);
for (const cat of ['NOTA_FISCAL', 'NOTA_SERVICO', 'CTE_FRETE', 'BOLETO', 'GUIA_IMPOSTO', 'FOLHA_INTEGRADA']) {
  const r = g(cat);
  if (!r) continue;
  rg.push(`- ${ROT_CAT[cat]} (todas as empresas): ${r.DOCS} documentos; mediana ${brl(r.P50)}, P80 ${brl(r.P80)}, P90 ${brl(r.P90)}, P95 ${brl(r.P95)}. Com limite de R$ 5.000: ${pct(Number(r.Q5000), Number(r.DOCS))}% dos documentos e ${pct(Number(r.V5000), Number(r.VALOR))}% do valor sem aprovação.`);
}
rg.push(`- Folha e guias têm valor alto e destino sensível: a recomendação é **não** aprovar automaticamente nenhum desses dois, independentemente de limite.\n`);
fs.writeFileSync(path.join(SAIDA, 'regras-automacao.md'), rg.join('\n'));

// ---------- pendencias-aprovacao.csv ----------
pend('Categorias de documento', 'Decidir se CT-e, encargo de folha, adiantamento e débito automático viram tipos próprios ou ficam fora da automação', 'Criar CT-e e Guia de encargo como tipos próprios; manter adiantamento e débito automático fora da automação.', catEmp.id, ['CTE_FRETE', 'GUIA_ENCARGO_FOLHA', 'ADIANTAMENTO', 'DEBITO_AUTOMATICO_TARIFA'].reduce((s, c) => s + (totalDocsCat[c] ?? 0), 0), 'ALTA', 'Sem tipo próprio, esses documentos caem em boleto ou nota com a TOP errada.', 'Financeiro + Contabilidade');
pend('Folha integrada', 'Confirmar que a origem P é a integração da folha e que a folha fica fora da automação por documento', `Não automatizar folha: os ${totalDocsCat.FOLHA_INTEGRADA ?? 0} documentos de origem P já entram no ERP sozinhos.`, catEmp.id, totalDocsCat.FOLHA_INTEGRADA ?? 0, 'ALTA', 'Lançar folha por documento duplicaria salários no ERP.', 'RH + TI');
pend('Nota de serviço (NFS-e)', 'Decidir como tratar notas de serviço sem chave de NF-e', 'Criar tipo Nota de serviço com critérios de leitura próprios; até lá, sempre com conferência humana.', notasCab.id, totalDocsCat.NOTA_SERVICO ?? 0, 'ALTA', 'O leitor atual dá no máximo 60 pontos sem chave: toda NFS-e cairia em revisão.', 'Fiscal + TI');
pend('TOP 1607', 'Confirmar se a TOP 1607 (nome CT-e) é a TOP oficial da folha ou se é uso indevido', 'Não usar a 1607 como padrão de folha até a contabilidade confirmar; se confirmar, renomear a TOP no ERP é decisão do Sankhya.', `${catTop.id}; ${topCfg.id}`, (catPorTop[1607] ?? []).reduce((s, x) => s + Number(x.DOCS), 0), 'ALTA', 'Padronizar sobre uma TOP com nome de CT-e mistura frete e folha nos relatórios.', 'Contabilidade + RH');
pend('Limite de aprovação', 'Definir o limite por empresa e tipo a partir da simulação', 'Começar com limite baixo (até a mediana) só para nota e boleto, em uma ou duas empresas; folha e guia sempre com aprovação.', simul.id, totalDocs, 'MEDIA', 'Limite alto lança no ERP de produção sem conferência humana.', 'Diretoria financeira');
pend('Aprovadores', 'Definir quem aprova e até quanto', 'Cadastrar alçadas no sistema (o ERP não tem nenhuma); usar o e-mail do usuário do ERP para vincular o login.', usuarios.id, Number(usuarios[0].COM_EMAIL), 'ALTA', 'Sem aprovador, qualquer usuário logado decide qualquer valor.', 'Diretoria financeira');
pend('Natureza por fornecedor', 'Aceitar a regra de herança (≥ 3 documentos e ≥ 70%) e a lista de fornecedores consistentes', `Usar a matriz: ${resumoForn.porDim.NATUREZA} pares com natureza consistente; os dispersos ficam com o parâmetro e conferência.`, totais[0]?.id ?? '', resumoForn.porDim.NATUREZA, 'MEDIA', 'Herdar natureza de fornecedor disperso classifica errado parte dos documentos.', 'Contabilidade');
pend('Centro de resultado', 'Confirmar a convenção "final do código = empresa" e tratar as exceções', 'Usar como alerta na tela, nunca como bloqueio.', centroSufixo.id, conv.OUTRA, convencaoForte ? 'MEDIA' : 'BAIXA', 'Centro de outra empresa distorce o resultado por loja.', 'Controladoria');
pend('Cadastro de parceiros', 'Corrigir CNPJ inválido, parceiros sem marca de fornecedor e CNPJ repetido entre ativos', 'Escolher um parceiro principal por CNPJ e marcar fornecedor nos pagos; o envio automático para e pergunta enquanto houver ambiguidade.', `${cgcDup.id}; ${Object.values(parceiros)[0]?.id ?? ''}`, cad.invalido + cad.naoForn + cgcDup.length, 'ALTA', 'Nota de entrada recusada pelo ERP (ORA-20101) e parceiro ambíguo travam o envio.', 'Cadastro / Fiscal');
pend('Duplicidades', 'Conferir os títulos e boletos repetidos apontados', 'Revisar a lista; manter a checagem de duplicidade no ERP antes de cada envio (já existe no sistema).', `${dupTit.id}; ${dupLinha.id}; ${dupNfe.id}; ${dupNum.id}`, dupTit.length + dupLinha.length + dupNfe.length + dupNum.length, 'MEDIA', 'Pagamento em dobro.', 'Financeiro');
pend('Leitor de boleto e guia', 'Aprovar a leitura de linha digitável, código de barras, nosso número e PIX', `Implementar a validação de linha digitável (a amostra do ERP tem ${pct(lin.validas, lin.total)}% de linhas válidas e o vencimento pelo fator bate em ${pct(lin.vencOk, lin.comVenc)}%).`, amostraLinhas.id, lin.total, 'ALTA', 'Sem isso, boleto e guia dependem de rótulo de texto e caem em revisão.', 'TI + Financeiro');
pend('Folha e guias no robô', 'Decidir se folha e guias podem ser lançadas sem pessoa', 'Não: manter aprovação obrigatória para folha e guias.', simul.id, (totalDocsCat.FOLHA_PAGAMENTO ?? 0) + (totalDocsCat.GUIA_IMPOSTO ?? 0) + (totalDocsCat.GUIA_ENCARGO_FOLHA ?? 0), 'ALTA', 'Erro em folha ou tributo tem impacto trabalhista e fiscal.', 'RH + Fiscal');
pend('Notas com várias TOPs', 'Decidir se a TOP da nota vem do parâmetro ou de uma regra por CFOP/produto', 'Manter TOP do parâmetro com correção manual na fase 1; avaliar regra por CFOP depois.', notasCab.id, totalDocsCat.NOTA_FISCAL ?? 0, 'MEDIA', 'TOP de compra errada afeta estoque e livro fiscal.', 'Fiscal');
gravarCsv('pendencias-aprovacao.csv', ['ID', 'TEMA', 'DECISAO_NECESSARIA', 'RECOMENDACAO', 'EVIDENCIA', 'OCORRENCIAS', 'CONFIANCA', 'RISCO', 'RESPONSAVEL', 'STATUS'], pendencias);

// ---------- registro-analises.md ----------
const reg = [`# Registro das análises\n`, `Leituras feitas em ${[...new Set(registro.map((r) => (r.lidoEm ?? '').slice(0, 10)))].filter(Boolean).join(', ')}. Resultados guardados em cache local (fora do git) para recompor os relatórios sem consultar o ERP de novo.\n`, `Todas as consultas passaram pela trava de somente leitura (só SELECT/WITH; escrita, DDL, procedimento, bloqueio e comando múltiplo são recusados antes de sair).\n`, `| ID | Objetivo | Origem | Período | Filtros | Linhas | Lido em | Observação |\n|---|---|---|---|---|---:|---|---|`];
registro.forEach((r) => reg.push(`| ${r.id} | ${r.objetivo} | ${r.origem} | ${r.periodo} | ${String(r.filtros).replace(/\|/g, '/')} | ${r.linhas} | ${r.lidoEm ?? ''} | ${r.erro ? `ERRO: ${r.erro}` : r.tentativas ? `${r.tentativas} repetição(ões) por limite do gateway` : ''} |`));
fs.writeFileSync(path.join(SAIDA, 'registro-analises.md'), reg.join('\n'));

console.log(JSON.stringify({ consultas: registro.length, erros: registro.filter((r) => r.erro).length, fornecedores: matriz.length, divergencias: div.length, duplicidades: dup.length, simulacao: sim.length, pendencias: pendencias.length, linhas: lin }, null, 0));
