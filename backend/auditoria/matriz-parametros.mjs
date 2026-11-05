// Matriz de parametros para revisao. SOMENTE LEITURA: nao grava no ERP nem em PARAMETROS_LANCAMENTO.
//   cd backend && node auditoria/matriz-parametros.mjs
// Decisoes aplicadas (05/11/2026): 1403 so candidata; natureza e centro nao vem do mais frequente;
// folha excluida; alcada nao definida. Nada aqui marca parametro como aprovado.
import fs from 'node:fs';
import path from 'node:path';
import { DIR_BACKEND, consulta } from '../lib/base.mjs';
import { ler, registro } from './leitura.mjs';
import { CATEGORIA } from './categoria.mjs';

const SAIDA = path.join(DIR_BACKEND, '..', 'parametros');
fs.mkdirSync(SAIDA, { recursive: true });
const RAIZ = path.join(DIR_BACKEND, '..');
const EMPRESAS = [200, 300, 100, 201, 301, 302, 400, 500, 202, 203, 501, 700, 600];
const IN_EMP = EMPRESAS.join(',');
const INI = '01/11/2025'; const FIM = '31/10/2026';
const PERIODO = `${INI} a ${FIM}`;
const meta = (objetivo, origem, filtros) => ({ objetivo, origem, periodo: PERIODO, filtros });
const PER = (a) => `${a}.DTNEG >= TO_DATE('${INI}', 'DD/MM/YYYY') AND ${a}.DTNEG < TO_DATE('${FIM}', 'DD/MM/YYYY') + 1`;

function lerCsv(arq) {
  const linhas = fs.readFileSync(arq, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
  const partir = (l) => { const c = []; let a = ''; let q = false; for (const x of l) { if (x === '"') q = !q; else if (x === ';' && !q) { c.push(a); a = ''; } else a += x; } c.push(a); return c; };
  const cab = partir(linhas[0]);
  return linhas.slice(1).map((l) => { const v = partir(l); return Object.fromEntries(cab.map((k, i) => [k, v[i] ?? ''])); });
}
const lev = lerCsv(path.join(RAIZ, 'levantamento-parametros.csv'));
const forn = lerCsv(path.join(RAIZ, 'auditoria', 'matriz-fornecedores.csv'));

// Nota de compra com chave de NF-e, por empresa e TOP, e quantas vieram de pedido pelo TGFVAR.
const notas = await ler(`SELECT C.CODEMP, C.CODTIPOPER, COUNT(*) AS NOTAS,
    SUM(CASE WHEN EXISTS (SELECT 1 FROM TGFVAR V JOIN TGFCAB P ON P.NUNOTA = V.NUNOTAORIG WHERE V.NUNOTA = C.NUNOTA AND P.TIPMOV = 'O') THEN 1 ELSE 0 END) AS DE_PEDIDO
  FROM TGFCAB C WHERE C.TIPMOV = 'C' AND C.CHAVENFE IS NOT NULL AND C.CODEMP IN (${IN_EMP}) AND ${PER('C')} GROUP BY C.CODEMP, C.CODTIPOPER`,
meta('NF-e de compra por empresa e TOP, com origem em pedido', 'TGFCAB + TGFVAR', `TIPMOV = 'C', CHAVENFE preenchida, CODEMP em ${IN_EMP}`));
const topsErp = await ler(`SELECT CODTIPOPER, TIPMOV, DESCROPER, ATIVO FROM (SELECT T.CODTIPOPER, T.TIPMOV, T.DESCROPER, T.ATIVO, ROW_NUMBER() OVER (PARTITION BY T.CODTIPOPER ORDER BY T.DHALTER DESC) AS RN FROM TGFTOP T) WHERE RN = 1`,
meta('Versao vigente de cada TOP', 'TGFTOP (maior DHALTER por codigo)', 'todas'));
// Boleto e guia: mesma categoria da auditoria, contando documento e nao parcela.
const TOPV = `TOPV AS (SELECT CODTIPOPER, TIPMOV, DESCROPER, ATIVO FROM (SELECT T.CODTIPOPER, T.TIPMOV, T.DESCROPER, T.ATIVO, ROW_NUMBER() OVER (PARTITION BY T.CODTIPOPER ORDER BY T.DHALTER DESC) AS RN FROM TGFTOP T) WHERE RN = 1)`;
const fin = await ler(`WITH ${TOPV}, B AS (SELECT F.CODEMP, F.CODTIPOPER, CASE WHEN F.NUNOTA IS NOT NULL THEN 'N' || F.NUNOTA ELSE 'F' || F.NUFIN END AS DOC, ${CATEGORIA} AS CATEGORIA
    FROM TGFFIN F LEFT JOIN TOPV T ON T.CODTIPOPER = F.CODTIPOPER LEFT JOIN TGFNAT N ON N.CODNAT = F.CODNAT LEFT JOIN TGFNAT NP ON NP.CODNAT = N.CODNATPAI
    LEFT JOIN TGFTIT TT ON TT.CODTIPTIT = F.CODTIPTIT LEFT JOIN TGFCAB C ON C.NUNOTA = F.NUNOTA
    WHERE F.RECDESP = -1 AND F.PROVISAO = 'N' AND F.CODEMP IN (${IN_EMP}) AND ${PER('F')})
  SELECT CODEMP, CATEGORIA, CODTIPOPER, COUNT(DISTINCT DOC) AS DOCS FROM B WHERE CATEGORIA IN ('BOLETO', 'GUIA_IMPOSTO') GROUP BY CODEMP, CATEGORIA, CODTIPOPER`,
meta('Boleto e guia por empresa e TOP, na categoria real da auditoria', 'TGFFIN + TGFTOP + TGFNAT + TGFTIT + TGFCAB', `RECDESP = -1, PROVISAO = 'N', CODEMP em ${IN_EMP}`));

const TOP_ERP = new Map(topsErp.map((t) => [Number(t.CODTIPOPER), t]));
const [locTop, locNat, locCen, locCta, locTit] = await Promise.all([
  consulta('SELECT CODTIPOPER AS C, ATIVO FROM TOPS'), consulta('SELECT CODNAT AS C, ATIVO FROM NATUREZAS'), consulta('SELECT CODCENCUS AS C, ATIVO FROM CENTROS_RESULTADO'),
  consulta('SELECT CODCTABCO AS C, ATIVO FROM CONTAS_BANCARIAS'), consulta('SELECT CODTIPTIT AS C, ATIVO FROM TIPOS_TITULO'),
]);
const ativo = (lista, c) => (c === '' || c == null ? null : lista.some((x) => String(x.C) === String(c) && x.ATIVO));
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '0.0');
const num = (n) => Number(n || 0);

const CAT_TIPO = { NOTA_FISCAL: 'NF-e de compra', BOLETO: 'Boleto', GUIA_IMPOSTO: 'Guia tributária' };
const RESP = { NOTA_FISCAL: 'Fiscal', BOLETO: 'Financeiro + Contabilidade', GUIA_IMPOSTO: 'Fiscal' };
const RESP_CLASS = 'Contabilidade + Controladoria';
const linhas = [];
const invalidos = [];
for (const l of lev) {
  const codemp = Number(l.CODEMP);
  if (!EMPRESAS.includes(codemp)) continue;
  const base = { CODEMP: codemp, EMPRESA: l.EMPRESA, TIPO: l.TIPO_DOCUMENTO };
  const fora = { CONTA_REFERENCIA: l.CODCTABCO, TIPO_TITULO_REFERENCIA: l.CODTIPTIT, PRODUTO_REFERENCIA: l.CODPROD_PADRAO };
  if (l.TIPO_DOCUMENTO === 'FOLHA_PAGAMENTO') {
    linhas.push({ ...base, TOP: '', TOP_DESCRICAO: '', TOP_REGRA: 'Não se aplica', NATUREZA: 'NÃO CADASTRAR', CENTRO: 'NÃO CADASTRAR', ALCADA: 'NÃO SE APLICA', ORIGEM_REGRA: 'Decisão do responsável em 05/11/2026: folha já integrada ao Sankhya', EVIDENCIA: '1.103 títulos de folha com origem P na auditoria (grupo inteiro)', CONFIANCA: 'ALTA', RISCO: 'Lançar pelo módulo duplicaria salários', RESPONSAVEL: 'RH + Contabilidade + TI', SITUACAO_APROVACAO: 'EXCLUÍDO POR DECISÃO; validação pendente', CARREGAVEL: 'NÃO', VALIDACAO_CODIGOS: 'n/a', FORNECEDORES_COM_SUGESTAO: '', CONTA_REFERENCIA: '', TIPO_TITULO_REFERENCIA: '', PRODUTO_REFERENCIA: '' });
    continue;
  }
  let top; let regra; let evid; let conf; let risco;
  if (l.TIPO_DOCUMENTO === 'NOTA_FISCAL') {
    const daEmp = notas.filter((n) => Number(n.CODEMP) === codemp);
    const total = daEmp.reduce((a, n) => a + num(n.NOTAS), 0);
    const totalPed = daEmp.reduce((a, n) => a + num(n.DE_PEDIDO), 0);
    const n1403 = daEmp.find((n) => Number(n.CODTIPOPER) === 1403);
    const q = num(n1403?.NOTAS); const semPed = q - num(n1403?.DE_PEDIDO);
    const maiores = [...daEmp].sort((a, b) => num(b.NOTAS) - num(a.NOTAS)).slice(0, 3).map((n) => `${n.CODTIPOPER}: ${n.NOTAS}`).join(', ');
    const candidata = semPed > 0;
    top = candidata ? '1403' : '';
    regra = candidata ? 'Candidata só para NF-e de mercadoria compatível, sem pedido. Com pedido, vale a TOP de destino da operação' : 'Sem candidata: a empresa não usou 1403 em NF-e sem pedido. Com pedido, vale a TOP de destino da operação';
    evid = `${total} NF-e; ${totalPed} (${pct(totalPed, total)}%) vieram de pedido; 1403: ${q} (${pct(q, total)}%), ${semPed} sem pedido; maiores TOPs ${maiores}`;
    conf = !candidata ? 'INSUFICIENTE' : total >= 30 && Number(pct(q, total)) >= 50 ? 'MEDIA' : 'BAIXA';
    risco = 'TOP errada afeta estoque, livro fiscal e custo';
  } else {
    top = l.CODTIPOPER;
    const cat = l.TIPO_DOCUMENTO === 'BOLETO' ? 'BOLETO' : 'GUIA_IMPOSTO';
    const daEmp = fin.filter((f) => Number(f.CODEMP) === codemp && f.CATEGORIA === cat);
    const total = daEmp.reduce((a, f) => a + num(f.DOCS), 0);
    const q = num(daEmp.find((f) => String(f.CODTIPOPER) === String(top))?.DOCS);
    const cob = Number(pct(q, total));
    const maiores = [...daEmp].sort((a, b) => num(b.DOCS) - num(a.DOCS)).slice(0, 3).map((f) => `${f.CODTIPOPER}: ${f.DOCS}`).join(', ');
    regra = 'Sugestão; depende de validação por operação';
    evid = `${total} documentos na categoria; TOP ${top}: ${q} (${cob}%); maiores TOPs ${maiores}`;
    conf = total < 30 ? 'BAIXA' : cob >= 80 ? 'ALTA' : cob >= 50 ? 'MEDIA' : 'BAIXA';
    risco = l.TIPO_DOCUMENTO === 'BOLETO' ? 'TOP genérica: natureza e centro passam a depender do fornecedor' : 'Guia pode já ter sido gerada pelo ERP e duplicar';
  }
  const f = forn.filter((x) => Number(x.CODEMP) === codemp && x.CATEGORIA_DOMINANTE === CAT_TIPO[l.TIPO_DOCUMENTO]);
  const sug = f.filter((x) => x.NATUREZA_CONFIANCA === 'ALTA' && x.CENTRO_CONFIANCA === 'ALTA').length;
  const v = TOP_ERP.get(Number(top));
  const problemas = [];
  if (top) {
    if (!v) problemas.push(`TOP ${top} não existe no ERP`);
    else if (v.ATIVO !== 'S') problemas.push(`TOP ${top} inativa no ERP`);
    if (ativo(locTop, top) === false) problemas.push(`TOP ${top} fora do cadastro ativo do módulo`);
    const esperado = l.TIPO_DOCUMENTO === 'NOTA_FISCAL' ? 'C' : 'I';
    if (v && v.TIPMOV !== esperado) problemas.push(`TOP ${top} de movimento ${v.TIPMOV}, esperado ${esperado}`);
  }
  if (ativo(locCta, l.CODCTABCO) === false) problemas.push(`conta ${l.CODCTABCO} fora do cadastro ativo`);
  if (ativo(locTit, l.CODTIPTIT) === false) problemas.push(`tipo de título ${l.CODTIPTIT} fora do cadastro ativo`);
  if (problemas.length) invalidos.push(`${codemp} ${l.TIPO_DOCUMENTO}: ${problemas.join('; ')}`);
  linhas.push({
    ...base, TOP: top, TOP_DESCRICAO: v?.DESCROPER ?? '', TOP_REGRA: regra,
    NATUREZA: 'PENDENTE DE REVISÃO', CENTRO: 'PENDENTE DE REVISÃO', ALCADA: 'NÃO DEFINIDA (aprovação humana)',
    ORIGEM_REGRA: 'Histórico do ERP 12 meses + decisão do responsável em 05/11/2026', EVIDENCIA: evid, CONFIANCA: conf, RISCO: risco,
    RESPONSAVEL: `TOP: ${RESP[l.TIPO_DOCUMENTO]}; natureza e centro: ${RESP_CLASS}; alçada: Diretoria Financeira`,
    SITUACAO_APROVACAO: 'PROPOSTO, NÃO APROVADO', CARREGAVEL: 'NÃO', VALIDACAO_CODIGOS: problemas.length ? problemas.join('; ') : top ? 'OK' : 'Sem TOP candidata',
    FORNECEDORES_COM_SUGESTAO: `${sug} de ${f.length}`, ...fora,
  });
}
const ordemTipo = { NOTA_FISCAL: 1, BOLETO: 2, GUIA_IMPOSTO: 3, FOLHA_PAGAMENTO: 4 };
linhas.sort((a, b) => EMPRESAS.indexOf(a.CODEMP) - EMPRESAS.indexOf(b.CODEMP) || ordemTipo[a.TIPO] - ordemTipo[b.TIPO]);
const cols = ['CODEMP', 'EMPRESA', 'TIPO', 'TOP', 'TOP_DESCRICAO', 'TOP_REGRA', 'NATUREZA', 'CENTRO', 'ALCADA', 'ORIGEM_REGRA', 'EVIDENCIA', 'CONFIANCA', 'RISCO', 'RESPONSAVEL', 'SITUACAO_APROVACAO', 'CARREGAVEL', 'VALIDACAO_CODIGOS', 'FORNECEDORES_COM_SUGESTAO', 'CONTA_REFERENCIA', 'TIPO_TITULO_REFERENCIA', 'PRODUTO_REFERENCIA', 'TOP_APROVADA', 'NATUREZA_APROVADA', 'CENTRO_APROVADO', 'ALCADA_APROVADA', 'APROVADO_POR', 'DATA_APROVACAO'];
const q = (x) => { const s = String(x ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
fs.writeFileSync(path.join(SAIDA, 'matriz-parametros.csv'), `﻿${[cols.join(';'), ...linhas.map((l) => cols.map((c) => q(l[c])).join(';'))].join('\r\n')}\r\n`);
const param = (await consulta('SELECT COUNT(*) AS N FROM PARAMETROS_LANCAMENTO'))[0].N;
const cont = (fn) => linhas.filter(fn).length;
const resumo = { linhas: linhas.length, propostas: cont((l) => l.SITUACAO_APROVACAO.startsWith('PROPOSTO')), excluidas: cont((l) => l.TIPO === 'FOLHA_PAGAMENTO'), aprovadas: 0, parametrosNoModulo: param, invalidos, conf: {}, sem1403: linhas.filter((l) => l.TIPO === 'NOTA_FISCAL' && !l.TOP).map((l) => l.CODEMP), nf: linhas.filter((l) => l.TIPO === 'NOTA_FISCAL').map((l) => `${l.CODEMP} ${l.CONFIANCA} ${l.EVIDENCIA}`), bol: linhas.filter((l) => l.TIPO !== 'NOTA_FISCAL' && l.TIPO !== 'FOLHA_PAGAMENTO').map((l) => `${l.CODEMP} ${l.TIPO} ${l.TOP} ${l.CONFIANCA} ${l.VALIDACAO_CODIGOS} ${l.FORNECEDORES_COM_SUGESTAO} | ${l.EVIDENCIA}`) };
for (const l of linhas) { const k = `${l.TIPO}:${l.CONFIANCA}`; resumo.conf[k] = (resumo.conf[k] ?? 0) + 1; }
fs.writeFileSync(path.join(SAIDA, 'registro-consultas-matriz.md'), `# Registro das consultas da matriz (somente leitura)\n\n| ID | Objetivo | Origem | Período | Filtros | Linhas | Erro |\n|---|---|---|---|---|---:|---|\n${registro.map((r) => `| ${r.id} | ${r.objetivo} | ${r.origem} | ${r.periodo} | ${r.filtros} | ${r.linhas} | ${r.erro || ''} |`).join('\n')}\n`);
resumo.nomes = [1403, 1452, 1426, 1454, 1425, 1419, 1420, 1401, 1112, 1600, 1609, 1406].map((c) => `${c} ${TOP_ERP.get(c)?.DESCROPER}`);
console.log(JSON.stringify(resumo, null, 1));
