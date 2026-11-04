/*__MOTOR__*/
/*__MOTOR_CORRESPONDENCIA__*/

// Leitura no ERP para a conferencia de NF-e com pedidos de compra (Fases 1 e 2). So consultas,
// pela porta unica. Piloto aprovado: pedido TOP 1314 para notas TOP 1419/1420; ampliar exige
// aprovacao (A-01). Nenhuma tolerancia e aplicada aqui: o motor compara e explica.
const PILOTO_CORRESPONDENCIA = { topPedido: [1314], topNota: [1419, 1420] };
const LIMITE_LINHAS_ERP = 5000;

// Codigo vindo do XML entra no SQL do ERP: so letras, numeros, espaco e . _ / -. Aspas nunca.
const sqlCodigo = (v) => correspondencia.codigo(v).replace(/[^A-Z0-9 ._/-]/g, '').replace(/-{2,}/g, '-').slice(0, 60);
const sqlTextos = (lista) => [...new Set(lista.map(sqlCodigo).filter(Boolean))].slice(0, 900).map((v) => "'" + v + "'").join(',');
const sqlInteiros = (lista) => [...new Set(lista.map((v) => inteiro(v)).filter((v) => v > 0))].slice(0, 900).join(',');

function agruparPedidos(linhas) {
  const mapa = new Map();
  for (const l of linhas) {
    const nu = Number(l.NUNOTA);
    if (!mapa.has(nu)) mapa.set(nu, { NUNOTA: nu, NUMNOTA: l.NUMNOTA, CODEMP: l.CODEMP, CODPARC: l.CODPARC, DTNEG: l.DTNEG, CODTIPOPER: l.CODTIPOPER, STATUSNOTA: l.STATUSNOTA, itens: [], vinculos: [] });
    mapa.get(nu).itens.push({ SEQUENCIA: l.SEQUENCIA, CODPROD: l.CODPROD, DESCRPROD: l.DESCRPROD, QTDNEG: l.QTDNEG, QTDENTREGUE: l.QTDENTREGUE, VLRUNIT: l.VLRUNIT, CODVOL: l.CODVOL, PENDENTE: l.PENDENTE });
  }
  return mapa;
}

async function dadosDaCorrespondencia(documento) {
  const alertasLeitura = [];
  const vazio = { parceiros: [], dePara: [], referencias: [], pedidos: [], existentes: [], alertasLeitura };
  const parceiros = await parceirosPorCnpj(documento.cnpjEmitente);
  if (!parceiros.length) return vazio;
  const codparcs = sqlInteiros(parceiros.map((p) => p.CODPARC));
  const codigos = sqlTextos(documento.itens.map((i) => i.cProd));
  const dePara = codigos ? await erpConsulta('SELECT CODPARC, CODPROPARC, CODPROD FROM TGFPAP WHERE CODPARC IN (' + codparcs + ') AND UPPER(TRIM(CODPROPARC)) IN (' + codigos + ')') : [];
  const referencias = codigos ? await erpConsulta('SELECT CODPROD, REFFORN FROM TGFPRO WHERE UPPER(TRIM(REFFORN)) IN (' + codigos + ')') : [];

  const codparcsNum = parceiros.map((p) => Number(p.CODPARC));
  const codprods = sqlInteiros(documento.itens.flatMap((i) => {
    const id = correspondencia.identificarProduto(i, codparcsNum, dePara, referencias);
    return [...id.codprods, ...id.sugestoes];
  }));
  let pedidos = [];
  if (codprods) {
    const linhas = await erpConsulta(
      "SELECT C.NUNOTA, C.NUMNOTA, C.CODEMP, C.CODPARC, TO_CHAR(C.DTNEG, 'YYYY-MM-DD') AS DTNEG, C.CODTIPOPER, C.STATUSNOTA, I.SEQUENCIA, I.CODPROD, P.DESCRPROD, I.QTDNEG, I.QTDENTREGUE, I.VLRUNIT, I.CODVOL, I.PENDENTE"
      + ' FROM TGFCAB C JOIN TGFITE I ON I.NUNOTA = C.NUNOTA JOIN TGFPRO P ON P.CODPROD = I.CODPROD'
      + ' WHERE C.CODTIPOPER IN (' + PILOTO_CORRESPONDENCIA.topPedido.join(',') + ') AND C.CODPARC IN (' + codparcs + ')'
      + " AND C.NUNOTA IN (SELECT I2.NUNOTA FROM TGFITE I2 WHERE I2.CODPROD IN (" + codprods + ") AND I2.PENDENTE = 'S')"
      + ' ORDER BY C.NUNOTA, I.SEQUENCIA',
    );
    if (linhas.length >= LIMITE_LINHAS_ERP) alertasLeitura.push({ tipo: 'LEITURA_CORTADA', mensagem: 'O ERP devolveu o limite de ' + LIMITE_LINHAS_ERP + ' linhas de pedido: a lista de candidatos pode estar incompleta.' });
    const mapa = agruparPedidos(linhas);
    const nus = sqlInteiros([...mapa.keys()]);
    if (nus) {
      const vinculos = await erpConsulta(
        "SELECT V.NUNOTAORIG, V.SEQUENCIAORIG, V.NUNOTA, V.SEQUENCIA, V.QTDATENDIDA, D.NUMNOTA, D.CODTIPOPER, D.STATUSNOTA, TO_CHAR(D.DTNEG, 'YYYY-MM-DD') AS DTNEG"
        + ' FROM TGFVAR V JOIN TGFCAB D ON D.NUNOTA = V.NUNOTA WHERE V.NUNOTAORIG IN (' + nus + ')',
      );
      vinculos.forEach((v) => { const p = mapa.get(Number(v.NUNOTAORIG)); if (p) p.vinculos.push(v); });
    }
    pedidos = [...mapa.values()];
  }

  // Duplicidade: a mesma chave no ERP, o mesmo numero do mesmo fornecedor numa compra, ou o XML
  // ja importado no portal de XML do Sankhya.
  const chave = /^\d{44}$/.test(String(documento.chave || '')) ? documento.chave : '';
  const numero = inteiro(soDigitos(documento.numero).slice(0, 15));
  const partes = [];
  if (chave) partes.push("SELECT C.NUNOTA, C.NUMNOTA, C.SERIENOTA, C.CODTIPOPER, C.STATUSNOTA, 'CHAVE' AS MOTIVO FROM TGFCAB C WHERE C.CHAVENFE = '" + chave + "'");
  if (numero) partes.push("SELECT C.NUNOTA, C.NUMNOTA, C.SERIENOTA, C.CODTIPOPER, C.STATUSNOTA, 'NUMERO' AS MOTIVO FROM TGFCAB C WHERE C.CODPARC IN (" + codparcs + ') AND C.NUMNOTA = ' + numero + " AND C.TIPMOV = 'C'" + (chave ? " AND (C.CHAVENFE IS NULL OR C.CHAVENFE <> '" + chave + "')" : ''));
  if (chave) partes.push("SELECT X.NUNOTA, X.NUMNOTA, NULL AS SERIENOTA, X.CODTIPOPER, NULL AS STATUSNOTA, 'PORTAL' AS MOTIVO FROM TGFIXN X WHERE X.CHAVEACESSO = '" + chave + "'");
  const existentes = partes.length ? await erpConsulta(partes.join(' UNION ALL ')) : [];
  return { parceiros, dePara, referencias, pedidos, existentes, alertasLeitura };
}
