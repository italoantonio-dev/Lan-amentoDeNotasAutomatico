// Levantamento para cadastrar os parametros: le o que cada empresa praticou no ERP nos ultimos
// 12 meses e sugere, por empresa e tipo de documento, TOP, natureza, centro, conta, tipo de titulo,
// produto padrao e a distribuicao de valores que orienta o limite de aprovacao.
// SOMENTE LEITURA: nao grava nada no ERP nem no sistema. Pode rodar quantas vezes quiser.
//   cd backend && node levantamento-parametros.mjs
// Gera ../levantamento-parametros.md (para ler) e ../levantamento-parametros.csv (para preencher).
import fs from 'node:fs';
import path from 'node:path';
import { sdk, projectId, consulta, DIR_BACKEND } from './lib/base.mjs';

const MESES = 12;
const EP = '/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json';
async function erp(sql) {
  const r = await sdk.callIntegrationMitra({ projectId, connection: 'sankhya', method: 'POST', endpoint: EP, body: { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql } } });
  const b = r.body;
  if (String(b?.status) !== '1' || !b.responseBody) throw new Error(`O ERP recusou a consulta: ${JSON.stringify(b?.statusMessage ?? b).slice(0, 300)}`);
  if (b.responseBody.burstLimit) console.warn('[AVISO] resultado cortado em 5.000 linhas');
  const c = b.responseBody.fieldsMetadata.map((f) => f.name);
  return b.responseBody.rows.map((l) => Object.fromEntries(c.map((x, i) => [x, l[i]])));
}
const PERIODO = `DTNEG >= ADD_MONTHS(TRUNC(SYSDATE), -${MESES})`;
const TOPV = `(SELECT T.CODTIPOPER, T.TIPMOV, T.DESCROPER FROM TGFTOP T WHERE T.DHALTER = (SELECT MAX(X.DHALTER) FROM TGFTOP X WHERE X.CODTIPOPER = T.CODTIPOPER))`;
const moeda = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const pct = (n, t) => (t ? `${Math.round((100 * n) / t)}%` : '—');

// Nomes vindos dos cadastros ja sincronizados no sistema.
const nomes = {};
for (const r of await consulta(`SELECT 'TOP' AS G, CAST(CODTIPOPER AS CHAR) AS C, DESCRICAO AS D, TIPMOV AS X FROM TOPS
  UNION ALL SELECT 'NAT', CODNAT, DESCRICAO, NULL FROM NATUREZAS UNION ALL SELECT 'CEN', CODCENCUS, DESCRICAO, NULL FROM CENTROS_RESULTADO
  UNION ALL SELECT 'CTA', CAST(CODCTABCO AS CHAR), DESCRICAO, NULL FROM CONTAS_BANCARIAS UNION ALL SELECT 'TIT', CAST(CODTIPTIT AS CHAR), DESCRICAO, NULL FROM TIPOS_TITULO
  UNION ALL SELECT 'EMP', CAST(CODEMP AS CHAR), NOME, NULL FROM EMPRESAS`)) {
  nomes[`${r.G}:${r.C}`] = { desc: String(r.D ?? '').trim(), tipmov: r.X };
}
const nome = (g, c) => (c == null ? 'vazio' : `${c} ${nomes[`${g}:${c}`]?.desc ?? '(não sincronizado)'}`);

console.log('Lendo o ERP...');
const empresas = await erp(`SELECT F.CODEMP, COUNT(*) AS N FROM TGFFIN F WHERE F.RECDESP = -1 AND F.${PERIODO} GROUP BY F.CODEMP HAVING COUNT(*) >= 30 ORDER BY N DESC`);
const listaEmp = empresas.map((e) => Number(e.CODEMP));
const inEmp = listaEmp.join(',');

// TOPs de despesa financeira (movimento I) e de compra (C), por empresa.
const topsI = await erp(`SELECT F.CODEMP, F.CODTIPOPER, COUNT(*) AS N FROM TGFFIN F JOIN ${TOPV} T ON T.CODTIPOPER = F.CODTIPOPER
  WHERE F.RECDESP = -1 AND F.${PERIODO} AND T.TIPMOV = 'I' AND F.CODEMP IN (${inEmp}) GROUP BY F.CODEMP, F.CODTIPOPER`);
const topsC = await erp(`SELECT C.CODEMP, C.CODTIPOPER, COUNT(*) AS N FROM TGFCAB C
  WHERE C.TIPMOV = 'C' AND C.${PERIODO} AND C.CODEMP IN (${inEmp}) GROUP BY C.CODEMP, C.CODTIPOPER`);

// Folha: naturezas de pessoal, e a TOP em que cada empresa as lanca.
const natFolha = await erp(`SELECT CODNAT FROM TGFNAT WHERE REGEXP_LIKE(UPPER(DESCRNAT), 'SALAR|FOLHA|PRO.?LABORE|FERIAS|RESCIS|13|DECIMO|ORDENADO')`);
const inFolha = natFolha.map((n) => Number(n.CODNAT)).join(',') || '-1';
const folha = await erp(`SELECT F.CODEMP, F.CODTIPOPER, F.CODNAT, COUNT(*) AS N FROM TGFFIN F JOIN ${TOPV} T ON T.CODTIPOPER = F.CODTIPOPER
  WHERE F.RECDESP = -1 AND F.${PERIODO} AND T.TIPMOV = 'I' AND F.CODNAT IN (${inFolha}) AND F.CODEMP IN (${inEmp}) GROUP BY F.CODEMP, F.CODTIPOPER, F.CODNAT`);

// Ranking das dimensoes dentro de cada empresa e TOP (uma consulta por empresa: o ERP corta em 5.000 linhas).
const dims = {};
for (const emp of listaEmp) {
  const linhas = await erp(`SELECT * FROM (
    SELECT CODTIPOPER, DIM, COD, N, ROW_NUMBER() OVER (PARTITION BY CODTIPOPER, DIM ORDER BY N DESC) AS RN, SUM(N) OVER (PARTITION BY CODTIPOPER, DIM) AS TOT FROM (
      SELECT CODTIPOPER,
        CASE WHEN GROUPING(CODNAT) = 0 THEN 'NAT' WHEN GROUPING(CODCENCUS) = 0 THEN 'CEN' WHEN GROUPING(CODCTABCOINT) = 0 THEN 'CTA' ELSE 'TIT' END AS DIM,
        CASE WHEN GROUPING(CODNAT) = 0 THEN TO_CHAR(CODNAT) WHEN GROUPING(CODCENCUS) = 0 THEN TO_CHAR(CODCENCUS) WHEN GROUPING(CODCTABCOINT) = 0 THEN TO_CHAR(CODCTABCOINT) ELSE TO_CHAR(CODTIPTIT) END AS COD,
        COUNT(*) AS N
      FROM TGFFIN WHERE RECDESP = -1 AND ${PERIODO} AND CODEMP = ${emp}
      GROUP BY GROUPING SETS ((CODTIPOPER, CODNAT), (CODTIPOPER, CODCENCUS), (CODTIPOPER, CODCTABCOINT), (CODTIPOPER, CODTIPTIT))
    )) WHERE RN <= 3`);
  for (const l of linhas) ((dims[`${emp}:${l.CODTIPOPER}:${l.DIM}`] ??= [])).push({ cod: l.COD, n: Number(l.N), tot: Number(l.TOT) });
}

// Valores: titulo financeiro por TOP (TGFFIN) e nota inteira por TOP de compra (TGFCAB).
const valFin = await erp(`SELECT CODEMP, CODTIPOPER, COUNT(*) AS N, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY VLRDESDOB) AS P50, PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY VLRDESDOB) AS P80,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY VLRDESDOB) AS P90, PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY VLRDESDOB) AS P95, MAX(VLRDESDOB) AS MX
  FROM TGFFIN WHERE RECDESP = -1 AND ${PERIODO} AND CODEMP IN (${inEmp}) GROUP BY CODEMP, CODTIPOPER HAVING COUNT(*) >= 5`);
const valNota = await erp(`SELECT CODEMP, CODTIPOPER, COUNT(*) AS N, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY VLRNOTA) AS P50, PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY VLRNOTA) AS P80,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY VLRNOTA) AS P90, PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY VLRNOTA) AS P95, MAX(VLRNOTA) AS MX
  FROM TGFCAB WHERE TIPMOV = 'C' AND ${PERIODO} AND CODEMP IN (${inEmp}) GROUP BY CODEMP, CODTIPOPER HAVING COUNT(*) >= 5`);
const valor = (lista, emp, top) => lista.find((v) => Number(v.CODEMP) === emp && Number(v.CODTIPOPER) === top) ?? null;

// Produto mais lancado em cada TOP de compra (candidato a produto padrao).
const produtos = await erp(`SELECT * FROM (SELECT C.CODEMP, C.CODTIPOPER, I.CODPROD, P.DESCRPROD, COUNT(*) AS N,
  ROW_NUMBER() OVER (PARTITION BY C.CODEMP, C.CODTIPOPER ORDER BY COUNT(*) DESC) AS RN
  FROM TGFCAB C JOIN TGFITE I ON I.NUNOTA = C.NUNOTA JOIN TGFPRO P ON P.CODPROD = I.CODPROD
  WHERE C.TIPMOV = 'C' AND C.${PERIODO} AND C.CODEMP IN (${inEmp}) GROUP BY C.CODEMP, C.CODTIPOPER, I.CODPROD, P.DESCRPROD) WHERE RN <= 3`);

const rank = (lista, emp) => lista.filter((t) => Number(t.CODEMP) === emp).sort((a, b) => Number(b.N) - Number(a.N));
const descTop = (cod) => nomes[`TOP:${cod}`]?.desc ?? '';
const ehTributo = (cod) => /TRIBUT|IMPOST|GUIA|DARF|GPS|DAS\b|ICMS/i.test(descTop(cod));
const ehAdiant = (cod) => /ADIANTAMENTO|CLIENTE|DEVOLU/i.test(descTop(cod));
// Conhecimento de transporte, transferencia e devolucao nao sao nota de fornecedor: ficam como alternativa.
const naoEhNotaFornecedor = (cod) => /CT-?E|TRANSFER|ENTRE (LOJAS|FILIAIS)|DEVOLU|BONIFIC|REMESSA|RETORNO/i.test(descTop(cod));

function sugestao(emp, tipo) {
  const I = rank(topsI, emp);
  let top = null;
  let porque = '';
  let alternativas = [];
  if (tipo === 'NOTA_FISCAL') {
    const C = rank(topsC, emp);
    const fornecedor = C.filter((x) => !naoEhNotaFornecedor(x.CODTIPOPER));
    top = fornecedor[0] ? Number(fornecedor[0].CODTIPOPER) : null;
    porque = 'TOP de compra de fornecedor mais usada (fora CT-e, transferência e devolução)';
    alternativas = C.filter((x) => Number(x.CODTIPOPER) !== top).slice(0, 5);
  } else if (tipo === 'GUIA_IMPOSTO') {
    const t = I.filter((x) => ehTributo(x.CODTIPOPER));
    top = t[0] ? Number(t[0].CODTIPOPER) : null;
    porque = 'TOP financeira de tributos mais usada';
    alternativas = t.slice(1, 4);
  } else if (tipo === 'FOLHA_PAGAMENTO') {
    const f = folha.filter((x) => Number(x.CODEMP) === emp);
    const porTop = {};
    f.forEach((x) => { porTop[x.CODTIPOPER] = (porTop[x.CODTIPOPER] ?? 0) + Number(x.N); });
    const melhor = Object.entries(porTop).sort((a, b) => b[1] - a[1]);
    top = melhor[0] ? Number(melhor[0][0]) : null;
    porque = 'TOP financeira em que a empresa lança naturezas de pessoal';
    alternativas = melhor.slice(1, 4).map(([c, n]) => ({ CODTIPOPER: c, N: n }));
  } else {
    const t = I.filter((x) => !ehTributo(x.CODTIPOPER) && !ehAdiant(x.CODTIPOPER));
    top = t[0] ? Number(t[0].CODTIPOPER) : null;
    porque = 'TOP financeira mais usada fora de tributos e adiantamentos';
    alternativas = t.slice(1, 4);
  }
  if (top == null) return { tipo, top: null };
  const d = (dim) => dims[`${emp}:${top}:${dim}`]?.slice().sort((a, b) => b.n - a.n) ?? [];
  let nat = d('NAT');
  if (tipo === 'FOLHA_PAGAMENTO') {
    const f = folha.filter((x) => Number(x.CODEMP) === emp && Number(x.CODTIPOPER) === top).sort((a, b) => Number(b.N) - Number(a.N));
    const tot = f.reduce((s, x) => s + Number(x.N), 0);
    nat = f.slice(0, 3).map((x) => ({ cod: String(x.CODNAT), n: Number(x.N), tot }));
  }
  let tit = d('TIT');
  if (tipo === 'GUIA_IMPOSTO') {
    const guia = tit.filter((x) => /DARF|DAE|GNRE|GPS|DAS/i.test(nomes[`TIT:${x.cod}`]?.desc ?? ''));
    if (guia.length) tit = [...guia, ...tit.filter((x) => !guia.includes(x))];
  }
  const val = tipo === 'NOTA_FISCAL' ? valor(valNota, emp, top) : valor(valFin, emp, top);
  const prods = tipo === 'NOTA_FISCAL' ? produtos.filter((p) => Number(p.CODEMP) === emp && Number(p.CODTIPOPER) === top) : [];
  return { tipo, top, porque, alternativas, nat, cen: d('CEN'), cta: d('CTA'), tit, val, prods, destino: tipo === 'NOTA_FISCAL' ? 'NOTA' : 'FINANCEIRO' };
}

const TIPOS = [['NOTA_FISCAL', 'Nota Fiscal de Entrada'], ['BOLETO', 'Boleto'], ['GUIA_IMPOSTO', 'Guia de Imposto'], ['FOLHA_PAGAMENTO', 'Folha de Pagamento']];
const md = [];
const csv = [['CODEMP', 'EMPRESA', 'TIPO_DOCUMENTO', 'DESTINO', 'CODTIPOPER', 'TOP', 'CODNAT', 'NATUREZA', 'CODCENCUS', 'CENTRO', 'CODCTABCO', 'CONTA', 'CODTIPTIT', 'TIPO_TITULO', 'CODPROD_PADRAO', 'DOCUMENTOS_12M', 'VALOR_MEDIANO', 'VALOR_P80', 'VALOR_P90', 'VALOR_P95', 'VALOR_MAXIMO', 'LIMITE_APROVACAO_DECIDIDO', 'APROVADO_POR']];
const hoje = new Date().toISOString().slice(0, 10);
md.push(`# Levantamento para os parâmetros de lançamento\n\nGerado em ${hoje} a partir do uso real no ERP nos últimos ${MESES} meses (somente leitura). Para atualizar: \`cd backend && node levantamento-parametros.mjs\`.\n`);
md.push(`## Como ler\n- **Sugestão** é o que a empresa mais praticou, com a contagem que a sustenta. Quem decide é o financeiro ou a contabilidade.\n- **Limite de aprovação** não vem do ERP: nenhum usuário do Sankhya tem alçada cadastrada. A tabela de valores mostra quanto dos documentos lançaria sozinho em cada faixa (mediana = metade dos documentos abaixo; P80 = 80% abaixo; e assim por diante).\n- **Nota de entrada usa várias TOPs** (serviço, uso e consumo, revenda...). O parâmetro guarda uma TOP padrão; quando a compra for de outro tipo, corrija a classificação no lançamento.\n- Preencha a coluna \`LIMITE_APROVACAO_DECIDIDO\` do CSV (e o \`APROVADO_POR\`) e devolva: os parâmetros podem ser cadastrados em lote a partir dela.\n`);
const linha = (g, lista) => (lista?.length ? lista.map((x) => `${nome(g, x.cod)} (${x.n} de ${x.tot}, ${pct(x.n, x.tot)})`).join('; ') : 'sem histórico');

for (const e of empresas) {
  const emp = Number(e.CODEMP);
  md.push(`\n## ${emp} · ${nomes[`EMP:${emp}`]?.desc ?? ''}\n${e.N} títulos de despesa em ${MESES} meses.\n`);
  for (const [tipo, rotulo] of TIPOS) {
    const s = sugestao(emp, tipo);
    if (!s.top) {
      md.push(`### ${rotulo}\nSem histórico nesta empresa: cadastre só se ela passar a lançar este tipo.\n`);
      csv.push([emp, nomes[`EMP:${emp}`]?.desc ?? '', tipo, tipo === 'NOTA_FISCAL' ? 'NOTA' : 'FINANCEIRO', '', 'SEM HISTÓRICO', '', '', '', '', '', '', '', '', '', 0, '', '', '', '', '', '', '']);
      continue;
    }
    const v = s.val;
    md.push(`### ${rotulo}`);
    md.push(`- **TOP:** ${nome('TOP', s.top)} — ${s.porque}`);
    if (s.alternativas.length) md.push(`- Outras TOPs usadas: ${s.alternativas.map((a) => `${nome('TOP', a.CODTIPOPER)} (${a.N})`).join('; ')}`);
    md.push(`- **Natureza:** ${linha('NAT', s.nat)}`);
    if (s.nat[0] && s.nat[0].n / s.nat[0].tot < 0.5) md.push(`  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.`);
    md.push(`- **Centro de resultado:** ${linha('CEN', s.cen)}`);
    if (tipo !== 'NOTA_FISCAL') md.push(`- **Conta bancária:** ${linha('CTA', s.cta)}`);
    md.push(`- **Tipo de título:** ${linha('TIT', s.tit)}`);
    if (s.prods.length) md.push(`- **Produto padrão (candidatos):** ${s.prods.map((p) => `${p.CODPROD} ${p.DESCRPROD} (${p.N} itens)`).join('; ')}`);
    md.push(v ? `- **Valores (${v.N} ${tipo === 'NOTA_FISCAL' ? 'notas' : 'títulos'}):** mediana ${moeda(v.P50)} · P80 ${moeda(v.P80)} · P90 ${moeda(v.P90)} · P95 ${moeda(v.P95)} · maior ${moeda(v.MX)}\n` : '- **Valores:** poucos documentos para estimar\n');
    const p = (l) => l?.[0]?.cod ?? '';
    csv.push([emp, nomes[`EMP:${emp}`]?.desc ?? '', tipo, s.destino, s.top, descTop(s.top), p(s.nat), nomes[`NAT:${p(s.nat)}`]?.desc ?? '', p(s.cen), nomes[`CEN:${p(s.cen)}`]?.desc ?? '', tipo === 'NOTA_FISCAL' ? '' : p(s.cta), tipo === 'NOTA_FISCAL' ? '' : nomes[`CTA:${p(s.cta)}`]?.desc ?? '', p(s.tit), nomes[`TIT:${p(s.tit)}`]?.desc ?? '', s.prods[0]?.CODPROD ?? '', v?.N ?? 0, v ? Math.round(v.P50) : '', v ? Math.round(v.P80) : '', v ? Math.round(v.P90) : '', v ? Math.round(v.P95) : '', v ? Math.round(v.MX) : '', '', '']);
  }
}

const sem = await consulta('SELECT CODEMP, NOME FROM EMPRESAS ORDER BY CODEMP');
const fora = sem.filter((s) => !listaEmp.includes(Number(s.CODEMP)));
if (fora.length) md.push(`\n## Empresas sem movimento relevante (menos de 30 títulos em ${MESES} meses)\n${fora.map((f) => `${f.CODEMP} ${f.NOME}`).join('; ')}. Não precisam de parâmetro agora.\n`);

const raiz = path.join(DIR_BACKEND, '..');
fs.writeFileSync(path.join(raiz, 'levantamento-parametros.md'), md.join('\n'));
const esc = (x) => { const t = String(x ?? ''); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
fs.writeFileSync(path.join(raiz, 'levantamento-parametros.csv'), `﻿${csv.map((l) => l.map(esc).join(';')).join('\n')}\n`);
console.log(`Pronto: ${empresas.length} empresas, ${csv.length - 1} combinações. Arquivos levantamento-parametros.md e .csv na raiz do projeto.`);
