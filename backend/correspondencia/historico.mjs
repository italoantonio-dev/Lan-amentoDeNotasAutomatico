// Leitura do historico para avaliar o motor de correspondencia. Somente leitura (trava de
// SELECT/WITH de auditoria/leitura.mjs), com cache local fora do git e registro de cada consulta.
import { ler } from '../auditoria/leitura.mjs';

export const PILOTO = { topPedido: [1314], topNota: [1419, 1420] };
const TOPS_NOTA = PILOTO.topNota.join(',');
const TOP_PEDIDO = PILOTO.topPedido.join(',');

const dia = (d) => d.toISOString().slice(0, 10);
const entre = (col, de, ate) => `${col} >= TO_DATE('${de}','YYYY-MM-DD') AND ${col} < TO_DATE('${ate}','YYYY-MM-DD')`;

// Divide o periodo ao meio enquanto o gateway recusar a resposta (grande demais ou cortada).
async function porPeriodo(de, ate, montar, meta) {
  try {
    return await ler(montar(de, ate), { ...meta, periodo: `${de} a ${ate} (exclusivo)` });
  } catch (e) {
    const a = new Date(de); const b = new Date(ate);
    const dias = (b - a) / 86400000;
    if (dias <= 1 || !/403|cortado/.test(e.message)) throw e;
    const meio = dia(new Date(a.getTime() + Math.floor(dias / 2) * 86400000));
    return [...(await porPeriodo(de, meio, montar, meta)), ...(await porPeriodo(meio, ate, montar, meta))];
  }
}
async function mensal(de, ate, montar, meta) {
  const saida = [];
  let a = new Date(`${de}T00:00:00Z`);
  const fim = new Date(`${ate}T00:00:00Z`);
  while (a < fim) {
    const b = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 1));
    saida.push(...(await porPeriodo(dia(a), dia(b < fim ? b : fim), montar, meta)));
    a = b;
  }
  return saida;
}
async function paginado(sqlOrdenado, meta, pagina = 5000) {
  const saida = [];
  for (let k = 0; ; k++) {
    const l = await ler(`SELECT * FROM (SELECT Q.*, ROWNUM AS RN FROM (${sqlOrdenado}) Q WHERE ROWNUM <= ${pagina * (k + 1)}) WHERE RN > ${pagina * k}`, { ...meta, filtros: `${meta.filtros}; pagina ${k + 1}` });
    saida.push(...l);
    if (l.length < pagina) return saida;
  }
}

// notas: [de, ate) por DTNEG; pedidos: desde o primeiro pedido 1314.
export async function carregarHistorico({ deNotas = '2025-11-01', ateNotas = '2026-11-01', dePedidos = '2025-01-01' } = {}) {
  const fNota = `CODTIPOPER IN (${TOPS_NOTA})`;
  const notas = await mensal(deNotas, ateNotas, (de, ate) => `SELECT C.NUNOTA, C.CODTIPOPER, C.CODEMP, C.CODPARC, C.NUMNOTA, C.SERIENOTA, TO_CHAR(C.DTNEG,'YYYY-MM-DD') AS DTNEG, C.STATUSNOTA, C.CHAVENFE, C.VLRNOTA
    FROM TGFCAB C WHERE C.${fNota} AND ${entre('C.DTNEG', de, ate)}`, { objetivo: 'Notas do piloto (cabecalho)', origem: 'TGFCAB', filtros: `CODTIPOPER IN (${TOPS_NOTA})` });

  const xmlCab = await mensal(deNotas, ateNotas, (de, ate) => `SELECT I.NUARQUIVO, I.NUNOTA, I.CNPJPARC, I.CNPJDEST, I.CHAVEACESSO, I.NUMNOTA, I.STATUS
    FROM TGFIXN I JOIN TGFCAB C ON C.NUNOTA = I.NUNOTA WHERE C.${fNota} AND ${entre('C.DTNEG', de, ate)}`, { objetivo: 'XML recebido das notas do piloto (cabecalho)', origem: 'TGFIXN', filtros: `nota com CODTIPOPER IN (${TOPS_NOTA})` });

  const xmlItens = await mensal(deNotas, ateNotas, (de, ate) => `SELECT I.NUARQUIVO, I.NUNOTA, X.NITEM, X.CPROD, X.CEAN, SUBSTR(X.XPROD, 1, 60) AS XPROD, X.QCOM, X.UCOM, X.VUNCOM, X.VPROD, X.XPED, X.NITEMPED, X.VDESC
    FROM TGFIXN I JOIN TGFCAB C ON C.NUNOTA = I.NUNOTA,
    XMLTABLE('/nfeProc/NFe/infNFe/det' PASSING XMLTYPE(I.XML) COLUMNS NITEM VARCHAR2(5) PATH '@nItem', CPROD VARCHAR2(60) PATH 'prod/cProd', CEAN VARCHAR2(20) PATH 'prod/cEAN',
      XPROD VARCHAR2(200) PATH 'prod/xProd', QCOM VARCHAR2(30) PATH 'prod/qCom', UCOM VARCHAR2(10) PATH 'prod/uCom', VUNCOM VARCHAR2(30) PATH 'prod/vUnCom', VPROD VARCHAR2(30) PATH 'prod/vProd',
      XPED VARCHAR2(30) PATH 'prod/xPed', NITEMPED VARCHAR2(10) PATH 'prod/nItemPed', VDESC VARCHAR2(30) PATH 'prod/vDesc') X
    WHERE C.${fNota} AND ${entre('C.DTNEG', de, ate)}`, { objetivo: 'Itens do XML recebido (NF-e real)', origem: 'TGFIXN.XML via XMLTABLE', filtros: `nota com CODTIPOPER IN (${TOPS_NOTA})` });

  const notaItens = await mensal(deNotas, ateNotas, (de, ate) => `SELECT I.NUNOTA, I.SEQUENCIA, I.CODPROD, I.QTDNEG, I.VLRUNIT, I.CODVOL
    FROM TGFITE I JOIN TGFCAB C ON C.NUNOTA = I.NUNOTA WHERE C.${fNota} AND ${entre('C.DTNEG', de, ate)}`, { objetivo: 'Itens das notas do piloto no ERP', origem: 'TGFITE', filtros: `CODTIPOPER IN (${TOPS_NOTA})` });

  const notaVinculos = await mensal(deNotas, ateNotas, (de, ate) => `SELECT V.NUNOTA, V.SEQUENCIA, V.NUNOTAORIG, V.SEQUENCIAORIG, V.QTDATENDIDA, O.CODTIPOPER AS TOP_ORIGEM
    FROM TGFVAR V JOIN TGFCAB C ON C.NUNOTA = V.NUNOTA JOIN TGFCAB O ON O.NUNOTA = V.NUNOTAORIG WHERE C.${fNota} AND ${entre('C.DTNEG', de, ate)}`, { objetivo: 'Gabarito: vinculos da nota com a origem', origem: 'TGFVAR', filtros: `nota com CODTIPOPER IN (${TOPS_NOTA})` });

  const pedidoItens = await mensal(dePedidos, ateNotas, (de, ate) => `SELECT C.NUNOTA, C.NUMNOTA, C.CODEMP, C.CODPARC, TO_CHAR(C.DTNEG,'YYYY-MM-DD') AS DTNEG, C.STATUSNOTA, I.SEQUENCIA, I.CODPROD, I.QTDNEG, I.QTDENTREGUE, I.VLRUNIT, I.CODVOL, I.PENDENTE
    FROM TGFCAB C JOIN TGFITE I ON I.NUNOTA = C.NUNOTA WHERE C.CODTIPOPER IN (${TOP_PEDIDO}) AND ${entre('C.DTNEG', de, ate)}`, { objetivo: 'Pedidos do piloto e itens', origem: 'TGFCAB + TGFITE', filtros: `CODTIPOPER IN (${TOP_PEDIDO})` });

  const pedidoVinculos = await mensal(dePedidos, ateNotas, (de, ate) => `SELECT V.NUNOTAORIG, V.SEQUENCIAORIG, V.NUNOTA, V.SEQUENCIA, V.QTDATENDIDA, D.CODTIPOPER, D.STATUSNOTA, D.NUMNOTA
    FROM TGFVAR V JOIN TGFCAB P ON P.NUNOTA = V.NUNOTAORIG JOIN TGFCAB D ON D.NUNOTA = V.NUNOTA WHERE P.CODTIPOPER IN (${TOP_PEDIDO}) AND ${entre('P.DTNEG', de, ate)}`, { objetivo: 'Tudo o que ja foi atendido de cada pedido', origem: 'TGFVAR', filtros: `pedido com CODTIPOPER IN (${TOP_PEDIDO})` });

  const dePara = await paginado('SELECT CODPARC, CODPROPARC, CODPROD, UNIDADEPARC, CODEMP FROM TGFPAP ORDER BY CODPARC, CODPROD, CODPROPARC', { objetivo: 'De-para produto do fornecedor', origem: 'TGFPAP', periodo: '—', filtros: 'tabela inteira' });
  const referencias = await paginado("SELECT CODPROD, REFFORN, REFERENCIA, CODVOL FROM TGFPRO WHERE REFFORN IS NOT NULL OR REFERENCIA IS NOT NULL ORDER BY CODPROD", { objetivo: 'Referencias do produto', origem: 'TGFPRO', periodo: '—', filtros: 'REFFORN ou REFERENCIA preenchida' });
  const parceiros = await paginado(`SELECT P.CODPARC, P.CGC_CPF, P.ATIVO, P.FORNECEDOR FROM TGFPAR P WHERE P.CGC_CPF IN (SELECT P2.CGC_CPF FROM TGFPAR P2 WHERE P2.CODPARC IN (SELECT DISTINCT CODPARC FROM TGFCAB WHERE CODTIPOPER IN (${TOP_PEDIDO},${TOPS_NOTA}))) ORDER BY P.CODPARC`, { objetivo: 'CNPJ dos parceiros do piloto e de quem divide o CNPJ', origem: 'TGFPAR', periodo: '—', filtros: `parceiros com movimento ${TOP_PEDIDO},${TOPS_NOTA}` });
  const empresas = await ler('SELECT CODEMP, CGC FROM TSIEMP', { objetivo: 'CNPJ das empresas', origem: 'TSIEMP', periodo: '—', filtros: '—' });
  return { notas, xmlCab, xmlItens, notaItens, notaVinculos, pedidoItens, pedidoVinculos, dePara, referencias, parceiros, empresas };
}
