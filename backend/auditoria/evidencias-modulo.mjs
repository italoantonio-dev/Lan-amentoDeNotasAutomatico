// Evidencias tecnicas para a proposta do modulo documental. SOMENTE LEITURA, com a mesma trava e registro
// da auditoria. Nao grava no ERP nem no sistema.
//   cd backend && node auditoria/evidencias-modulo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { DIR_BACKEND } from '../lib/base.mjs';
import { ler, dicionario, exigirColunas, registro } from './leitura.mjs';

const SAIDA = path.join(DIR_BACKEND, '..', 'modulo-documental');
fs.mkdirSync(SAIDA, { recursive: true });
const EMPRESAS = [200, 300, 100, 201, 301, 302, 400, 500, 202, 203, 501, 700, 600];
const IN_EMP = EMPRESAS.join(',');
const hoje = new Date();
const ini = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 12, 1)).toISOString().slice(0, 10);
const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1)).toISOString().slice(0, 10);
const PERIODO = `DTNEG de ${ini} a ${new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 0)).toISOString().slice(0, 10)}`;
const PER = (a) => `${a}.DTNEG >= TO_DATE('${ini}', 'YYYY-MM-DD') AND ${a}.DTNEG < TO_DATE('${fim}', 'YYYY-MM-DD')`;
const meta = (objetivo, origem, filtros, periodo = PERIODO) => ({ objetivo, origem, periodo, filtros });

const dic = await dicionario(['TGFVAR', 'TGFITE', 'TGFCAB', 'TGFTOP', 'TGFFIN']);
exigirColunas(dic, 'TGFVAR', ['NUNOTA', 'SEQUENCIA', 'NUNOTAORIG', 'SEQUENCIAORIG', 'QTDATENDIDA', 'STATUSNOTA']);
exigirColunas(dic, 'TGFITE', ['NUNOTA', 'SEQUENCIA', 'CODPROD', 'QTDNEG', 'QTDENTREGUE', 'VLRUNIT', 'CODVOL', 'PENDENTE']);
exigirColunas(dic, 'TGFCAB', ['NUNOTA', 'CODEMP', 'CODPARC', 'TIPMOV', 'CODTIPOPER', 'DTNEG', 'STATUSNOTA', 'PENDENTE', 'CHAVENFE', 'VLRNOTA']);
const COLS_TOP = ['TIPMOV', 'ATIVO', 'EXIGECONF', 'EXIGELIB', 'EXIGECOTACAO', 'PERCTOLVARQTD', 'PERCTOLVARVLRUNIT', 'VALVARIACVLRUNIT', 'DESCONSIDPEDXML', 'PENDENTE', 'TEMFINORIGEM', 'ATUALFIN', 'ATUALEST'].filter((c) => dic.TGFTOP.has(c));
const TOPV = `TOPV AS (SELECT CODTIPOPER, DESCROPER, ${COLS_TOP.join(', ')} FROM (SELECT T.*, ROW_NUMBER() OVER (PARTITION BY T.CODTIPOPER ORDER BY T.DHALTER DESC) AS RN FROM TGFTOP T) WHERE RN = 1)`;

const pedidos = await ler(`SELECT C.CODEMP, C.STATUSNOTA, C.PENDENTE, COUNT(*) AS PEDIDOS, ROUND(SUM(C.VLRNOTA), 2) AS VALOR FROM TGFCAB C
  WHERE C.TIPMOV = 'O' AND C.CODEMP IN (${IN_EMP}) AND ${PER('C')} GROUP BY C.CODEMP, C.STATUSNOTA, C.PENDENTE ORDER BY C.CODEMP`,
meta('Pedidos de compra por empresa, situacao e pendencia', 'TGFCAB', `TIPMOV = 'O', CODEMP em ${IN_EMP}`));

const notasPorTop = await ler(`WITH ${TOPV}, N AS (SELECT C.NUNOTA, C.CODTIPOPER, CASE WHEN C.CHAVENFE IS NOT NULL THEN 1 ELSE 0 END AS TEM_CHAVE,
    CASE WHEN EXISTS (SELECT 1 FROM TGFVAR V JOIN TGFCAB P ON P.NUNOTA = V.NUNOTAORIG WHERE V.NUNOTA = C.NUNOTA AND P.TIPMOV = 'O') THEN 1 ELSE 0 END AS DE_PEDIDO
    FROM TGFCAB C WHERE C.TIPMOV = 'C' AND C.CODEMP IN (${IN_EMP}) AND ${PER('C')})
  SELECT * FROM (SELECT N.CODTIPOPER, T.DESCROPER, COUNT(*) AS NOTAS, SUM(DE_PEDIDO) AS DE_PEDIDO, SUM(TEM_CHAVE) AS COM_CHAVE_NFE
    FROM N JOIN TOPV T ON T.CODTIPOPER = N.CODTIPOPER GROUP BY N.CODTIPOPER, T.DESCROPER ORDER BY NOTAS DESC) WHERE ROWNUM <= 20`,
meta('Notas de compra por TOP: quantas vieram de pedido (TGFVAR)', 'TGFCAB + TGFVAR', `TIPMOV = 'C', CODEMP em ${IN_EMP}; pedido = TGFVAR.NUNOTAORIG com TIPMOV 'O'`));

const paresTop = await ler(`SELECT * FROM (SELECT P.CODTIPOPER AS TOP_PEDIDO, C.CODTIPOPER AS TOP_NOTA, COUNT(DISTINCT C.NUNOTA) AS NOTAS FROM TGFVAR V
  JOIN TGFCAB C ON C.NUNOTA = V.NUNOTA JOIN TGFCAB P ON P.NUNOTA = V.NUNOTAORIG
  WHERE C.TIPMOV = 'C' AND P.TIPMOV = 'O' AND C.CODEMP IN (${IN_EMP}) AND ${PER('C')} GROUP BY P.CODTIPOPER, C.CODTIPOPER ORDER BY NOTAS DESC) WHERE ROWNUM <= 25`,
meta('TOP do pedido para TOP da nota (faturamento observado)', 'TGFVAR + TGFCAB', `nota TIPMOV 'C', origem TIPMOV 'O', CODEMP em ${IN_EMP}`));

const divergencia = await ler(`SELECT COUNT(*) AS ITENS,
  SUM(CASE WHEN ABS(NI.VLRUNIT - PI.VLRUNIT) > 0.01 * GREATEST(PI.VLRUNIT, 0.01) THEN 1 ELSE 0 END) AS PRECO_DIFERENTE_1PCT,
  SUM(CASE WHEN NI.CODVOL <> PI.CODVOL THEN 1 ELSE 0 END) AS UNIDADE_DIFERENTE,
  SUM(CASE WHEN V.QTDATENDIDA < PI.QTDNEG THEN 1 ELSE 0 END) AS ATENDIMENTO_PARCIAL,
  SUM(CASE WHEN NI.CODPROD <> PI.CODPROD THEN 1 ELSE 0 END) AS PRODUTO_DIFERENTE,
  COUNT(DISTINCT V.NUNOTA) AS NOTAS
  FROM TGFVAR V JOIN TGFCAB C ON C.NUNOTA = V.NUNOTA JOIN TGFCAB P ON P.NUNOTA = V.NUNOTAORIG
  JOIN TGFITE NI ON NI.NUNOTA = V.NUNOTA AND NI.SEQUENCIA = V.SEQUENCIA
  JOIN TGFITE PI ON PI.NUNOTA = V.NUNOTAORIG AND PI.SEQUENCIA = V.SEQUENCIAORIG
  WHERE C.TIPMOV = 'C' AND P.TIPMOV = 'O' AND C.CODEMP IN (${IN_EMP}) AND ${PER('C')}`,
meta('Divergencia entre item do pedido e item da nota faturada', 'TGFVAR + TGFCAB + TGFITE', `nota TIPMOV 'C', origem TIPMOV 'O', CODEMP em ${IN_EMP}`));

const statusProv = await ler(`SELECT C.STATUSNOTA, COUNT(DISTINCT C.NUNOTA) AS NOTAS,
  COUNT(DISTINCT CASE WHEN F.NUFIN IS NOT NULL THEN C.NUNOTA END) AS COM_TITULO,
  SUM(CASE WHEN F.PROVISAO = 'S' THEN 1 ELSE 0 END) AS TITULOS_PROVISAO, SUM(CASE WHEN F.PROVISAO = 'N' THEN 1 ELSE 0 END) AS TITULOS_REAIS
  FROM TGFCAB C LEFT JOIN TGFFIN F ON F.NUNOTA = C.NUNOTA
  WHERE C.TIPMOV IN ('C', 'O') AND C.CODEMP IN (${IN_EMP}) AND ${PER('C')} GROUP BY C.STATUSNOTA`,
meta('Situacao da nota x titulos de provisao e reais (compras e pedidos)', 'TGFCAB + TGFFIN', `TIPMOV em ('C','O'), CODEMP em ${IN_EMP}`));

const statusTipmov = await ler(`SELECT C.TIPMOV, C.STATUSNOTA, COUNT(*) AS NOTAS FROM TGFCAB C WHERE C.TIPMOV IN ('C', 'O') AND C.CODEMP IN (${IN_EMP}) AND ${PER('C')} GROUP BY C.TIPMOV, C.STATUSNOTA ORDER BY C.TIPMOV, NOTAS DESC`,
meta('Situacao por tipo de movimento', 'TGFCAB', `TIPMOV em ('C','O'), CODEMP em ${IN_EMP}`));

const topsUsadas = [...new Set([...notasPorTop.map((r) => r.CODTIPOPER), ...paresTop.map((r) => r.TOP_PEDIDO)])].slice(0, 40);
const cfgTops = await ler(`WITH ${TOPV} SELECT CODTIPOPER, DESCROPER, ${COLS_TOP.join(', ')} FROM TOPV WHERE CODTIPOPER IN (${topsUsadas.join(',')}) ORDER BY TIPMOV, CODTIPOPER`,
meta('Campos de configuracao das TOPs de pedido e de compra (valores brutos, sem interpretacao)', 'TGFTOP', `CODTIPOPER em ${topsUsadas.join(',')}`, '— (cadastro)'));

const pendentesAgora = await ler(`SELECT C.CODEMP, COUNT(*) AS PEDIDOS_PENDENTES, ROUND(SUM(C.VLRNOTA), 2) AS VALOR FROM TGFCAB C WHERE C.TIPMOV = 'O' AND C.PENDENTE = 'S' AND C.CODEMP IN (${IN_EMP}) GROUP BY C.CODEMP ORDER BY PEDIDOS_PENDENTES DESC`,
meta('Pedidos de compra marcados como pendentes hoje (qualquer data)', 'TGFCAB', `TIPMOV = 'O', PENDENTE = 'S', CODEMP em ${IN_EMP}`, '— (situacao atual)'));

// ----- Relatorio -----
const pct = (n, t) => (Number(t) ? Math.round((1000 * Number(n)) / Number(t)) / 10 : 0);
const brl = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const md = [];
md.push(`# Evidências técnicas — módulo de entrada de documentos\n`);
md.push(`Somente leitura no Oracle do Sankhya (trava de SELECT/WITH). Período: ${PERIODO}. Empresas: ${IN_EMP}. Cada número entre colchetes é uma consulta em \`registro-consultas.md\`.\n`);
md.push(`## 1. Estruturas confirmadas no dicionário do Oracle\n`);
md.push(`- **TGFVAR** (vínculo entre item de origem e item gerado): ${[...dic.TGFVAR].sort().join(', ')}.`);
md.push(`- **TGFITE**, colunas de atendimento: ${['QTDNEG', 'QTDENTREGUE', 'QTDFAT', 'PENDENTE', 'FATURAR', 'NUMPEDIDO', 'SEQPEDIDO', 'STATUSNOTA'].filter((c) => dic.TGFITE.has(c)).join(', ')}.`);
md.push(`- **TGFCAB**, colunas de situação: ${['STATUSNOTA', 'PENDENTE', 'APROVADO', 'CONFIRMNOTAFAT', 'DTFATUR', 'SEQCONFIRMA', 'CODUSUINC', 'CODUSUCOMPRADOR'].filter((c) => dic.TGFCAB.has(c)).join(', ')}.`);
md.push(`- **TGFTOP**, colunas que parecem tratar pedido, tolerância e confirmação (o significado exato precisa ser confirmado com a TI/Sankhya): ${COLS_TOP.join(', ')}.\n`);
md.push(`## 2. Pedidos de compra [${pedidos.id}]\n`);
const porEmp = {};
pedidos.forEach((r) => { const e = (porEmp[r.CODEMP] ??= { n: 0, v: 0, pend: 0 }); e.n += Number(r.PEDIDOS); e.v += Number(r.VALOR); if (r.PENDENTE === 'S') e.pend += Number(r.PEDIDOS); });
md.push(`| Empresa | Pedidos no período | Valor | Ainda pendentes |\n|---|---:|---:|---:|`);
Object.entries(porEmp).forEach(([e, x]) => md.push(`| ${e} | ${x.n} | ${brl(x.v)} | ${x.pend} |`));
md.push(`\nPedidos pendentes hoje, qualquer data [${pendentesAgora.id}]: ${pendentesAgora.map((r) => `${r.CODEMP}: ${r.PEDIDOS_PENDENTES}`).join('; ') || 'nenhum'}.\n`);
md.push(`## 3. Notas de compra que vieram de pedido [${notasPorTop.id}]\n`);
md.push(`| TOP da nota | Notas | Vieram de pedido | % | Com chave NF-e |\n|---|---:|---:|---:|---:|`);
notasPorTop.forEach((r) => md.push(`| ${r.CODTIPOPER} ${r.DESCROPER} | ${r.NOTAS} | ${r.DE_PEDIDO} | ${pct(r.DE_PEDIDO, r.NOTAS)}% | ${r.COM_CHAVE_NFE} |`));
md.push(`\n## 4. TOP do pedido → TOP da nota [${paresTop.id}]\n`);
md.push(`| TOP do pedido | TOP da nota | Notas |\n|---|---|---:|`);
paresTop.forEach((r) => md.push(`| ${r.TOP_PEDIDO} | ${r.TOP_NOTA} | ${r.NOTAS} |`));
const d = divergencia[0] ?? {};
md.push(`\n## 5. Divergência entre pedido e nota faturada [${divergencia.id}]\n`);
md.push(`${d.ITENS} itens em ${d.NOTAS} notas faturadas a partir de pedido: preço unitário diferente em mais de 1% em ${d.PRECO_DIFERENTE_1PCT} (${pct(d.PRECO_DIFERENTE_1PCT, d.ITENS)}%); unidade diferente em ${d.UNIDADE_DIFERENTE}; produto diferente em ${d.PRODUTO_DIFERENTE}; atendimento parcial (quantidade atendida menor que a pedida) em ${d.ATENDIMENTO_PARCIAL} (${pct(d.ATENDIMENTO_PARCIAL, d.ITENS)}%).\n`);
md.push(`## 6. Situação da nota e provisão financeira [${statusProv.id}] [${statusTipmov.id}]\n`);
md.push(`| STATUSNOTA | Notas (compras e pedidos) | Com título | Títulos de provisão | Títulos reais |\n|---|---:|---:|---:|---:|`);
statusProv.forEach((r) => md.push(`| ${r.STATUSNOTA} | ${r.NOTAS} | ${r.COM_TITULO} | ${r.TITULOS_PROVISAO} | ${r.TITULOS_REAIS} |`));
md.push(`\nPor movimento: ${statusTipmov.map((r) => `${r.TIPMOV}/${r.STATUSNOTA}: ${r.NOTAS}`).join('; ')}.`);
md.push(`\n> Leitura, não teste: os dados mostram como o ambiente está hoje. Que salvar sem confirmar gera provisão e que a confirmação gera o título real é **hipótese consistente com os números**, a validar por TOP em homologação.\n`);
md.push(`## 7. Configuração das TOPs de pedido e de compra [${cfgTops.id}]\n`);
md.push(`Valores brutos, sem interpretação.\n`);
md.push(`| TOP | ${COLS_TOP.join(' | ')} |\n|---|${COLS_TOP.map(() => '---').join('|')}|`);
cfgTops.forEach((r) => md.push(`| ${r.CODTIPOPER} ${r.DESCROPER} | ${COLS_TOP.map((c) => r[c] ?? '—').join(' | ')} |`));
fs.writeFileSync(path.join(SAIDA, 'evidencias-tecnicas.md'), md.join('\n'));

const reg = [`# Registro das consultas (somente leitura)\n`, `| ID | Objetivo | Origem | Período | Filtros | Linhas | Lido em |\n|---|---|---|---|---|---:|---|`];
registro.forEach((r) => reg.push(`| ${r.id} | ${r.objetivo} | ${r.origem} | ${r.periodo} | ${String(r.filtros).replace(/\|/g, '/')} | ${r.linhas} | ${r.lidoEm ?? ''} |`));
fs.writeFileSync(path.join(SAIDA, 'registro-consultas.md'), reg.join('\n'));
console.log(JSON.stringify({ consultas: registro.length, erros: registro.filter((r) => r.erro).length }));
