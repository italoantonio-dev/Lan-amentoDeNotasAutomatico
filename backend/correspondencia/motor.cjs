// Motor de correspondencia entre NF-e e pedidos de compra (Fases 1 e 2: somente leitura).
// Puro: nao acessa rede, banco nem relogio. O mesmo codigo roda na SF, nos testes e na avaliacao
// historica. Compara, classifica e explica. NAO aplica tolerancia comercial nem regra fiscal
// (aprovacoes A-04 e A-07 pendentes): toda diferenca aparece como diferenca, e quando mais de um
// pedido serve o motor diz que e ambiguo e mostra os candidatos, sem escolher.
'use strict';

// Arredondamento tecnico de ponto flutuante. Nao e tolerancia: 0,01 de diferenca ja e divergencia.
const ARRED = 1e-6;

const num = (v) => {
  const n = Number(String(v == null ? '' : v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const igual = (a, b) => Math.abs(num(a) - num(b)) <= ARRED;
// Codigo do fornecedor comparado sem espacos nas pontas e sem diferenca de caixa. Zeros a esquerda
// e outros caracteres ficam como vieram: tratar "0123" como "123" seria uma regra inventada.
const codigo = (v) => String(v == null ? '' : v).trim().toUpperCase();
const unicos = (lista) => [...new Set(lista)];
const arred = (v, casas) => Math.round(num(v) * 10 ** casas) / 10 ** casas;

// Identificacao do produto do ERP a partir do item da NF-e. So identificam o produto informado por
// uma pessoa e o de-para do proprio Sankhya (TGFPAP): no historico do piloto ele nao errou nenhum
// item. A referencia do fornecedor (TGFPRO.REFFORN) errou 22% das vezes, entao e so SUGESTAO: aparece
// para a pessoa conferir e nao entra na decisao. REFERENCIA (62% de erro) e GTIN (100%) nao sao usados.
function identificarProduto(item, codparcs, dePara, referencias) {
  if (num(item.codprod) > 0) return { situacao: 'IDENTIFICADO', fonte: 'INFORMADO', codprods: [num(item.codprod)], sugestoes: [] };
  const c = codigo(item.cProd);
  if (!c) return { situacao: 'NAO_IDENTIFICADO', fonte: '', codprods: [], sugestoes: [] };
  const achados = unicos(dePara.filter((d) => codparcs.includes(num(d.CODPARC)) && codigo(d.CODPROPARC) === c).map((x) => num(x.CODPROD)).filter((x) => x > 0));
  if (achados.length) return { situacao: achados.length === 1 ? 'IDENTIFICADO' : 'AMBIGUO', fonte: 'TGFPAP', codprods: achados, sugestoes: [] };
  const sugestoes = unicos(referencias.filter((r) => codigo(r.REFFORN) === c).map((x) => num(x.CODPROD)).filter((x) => x > 0));
  return { situacao: 'NAO_IDENTIFICADO', fonte: '', codprods: [], sugestoes };
}

// Saldo do item do pedido. Saldo oficial ainda a confirmar (V-05): aqui e QTDNEG - QTDENTREGUE,
// zerado quando o Sankhya marca o item como nao pendente.
function saldo(it) {
  const negociada = num(it.QTDNEG);
  const entregue = num(it.QTDENTREGUE);
  const pendente = String(it.PENDENTE || 'S').toUpperCase() === 'N' ? 0 : Math.max(0, negociada - entregue);
  return { negociada, entregue, pendente };
}

function compararLinha(itemDoc, pedido, it) {
  const s = saldo(it);
  const qtdDocumento = num(itemDoc.quantidade);
  const precoDocumento = num(itemDoc.valorUnitario);
  const precoPedido = num(it.VLRUNIT);
  const unidadeDocumento = codigo(itemDoc.unidade);
  const unidadePedido = codigo(it.CODVOL);
  const divergencias = [];
  const mesmaUnidade = !unidadeDocumento || !unidadePedido || unidadeDocumento === unidadePedido;
  if (!mesmaUnidade) divergencias.push('UNIDADE_DIFERENTE');
  if (mesmaUnidade && qtdDocumento > s.pendente + ARRED) divergencias.push('QUANTIDADE_ACIMA_DO_PENDENTE');
  if (!igual(precoDocumento, precoPedido)) divergencias.push('PRECO_DIFERENTE');
  return {
    pedido: num(pedido.NUNOTA), numeroPedido: pedido.NUMNOTA ?? null, sequencia: num(it.SEQUENCIA), codprod: num(it.CODPROD), descricao: it.DESCRPROD || '',
    negociada: s.negociada, entregue: s.entregue, pendente: s.pendente, quantidadeDocumento: qtdDocumento,
    saldoAposDocumento: mesmaUnidade ? arred(s.pendente - qtdDocumento, 6) : null,
    unidadePedido, unidadeDocumento, precoPedido, precoDocumento,
    diferencaPreco: arred(precoDocumento - precoPedido, 6),
    diferencaPrecoPct: precoPedido ? arred(((precoDocumento - precoPedido) / precoPedido) * 100, 4) : null,
    divergencias,
  };
}

// entrada: { documento, empresas, parceiros, dePara, referencias, pedidos, existentes }
//   empresas: um mesmo CNPJ pode pertencer a mais de um codigo de empresa no Sankhya: vale o conjunto.
//   documento.itens: [{ nItem, cProd, cEAN, xProd, quantidade, unidade, valorUnitario, valorTotal, codprod? }]
//   pedidos: [{ NUNOTA, NUMNOTA, CODEMP, CODPARC, DTNEG, CODTIPOPER, itens: [...TGFITE], vinculos: [...TGFVAR] }]
//   existentes: notas no ERP com a mesma chave ou o mesmo numero/serie/parceiro
function conferir(entrada) {
  const doc = entrada.documento || {};
  const empresas = entrada.empresas || [];
  const codemps = empresas.map((e) => num(e.CODEMP));
  const parceiros = entrada.parceiros || [];
  const codparcs = parceiros.map((p) => num(p.CODPARC));
  const pedidos = entrada.pedidos || [];
  const alertas = [];
  const resultado = {
    versao: 1, somenteLeitura: true, situacao: '', resumo: '',
    documento: { chave: doc.chave || '', numero: doc.numero || '', serie: doc.serie || '', dataEmissao: doc.dataEmissao || '', cnpjEmitente: doc.cnpjEmitente || '', cnpjDestinatario: doc.cnpjDestinatario || '', valorTotal: num(doc.valorTotal), itens: (doc.itens || []).length },
    empresas: empresas.map((e) => ({ CODEMP: num(e.CODEMP), NOME: e.NOME || '' })),
    parceiros: parceiros.map((p) => ({ CODPARC: num(p.CODPARC), NOME: p.RAZAOSOCIAL || p.NOMEPARC || '', FORNECEDOR: p.FORNECEDOR || '' })),
    duplicidade: (entrada.existentes || []).map((n) => ({ NUNOTA: num(n.NUNOTA) || null, NUMNOTA: n.NUMNOTA ?? null, SERIENOTA: n.SERIENOTA ?? null, CODTIPOPER: num(n.CODTIPOPER) || null, STATUSNOTA: n.STATUSNOTA || '', motivo: String(n.MOTIVO || '') })),
    itens: [], pedidos: [], alertas,
  };
  if (resultado.duplicidade.length) {
    const textos = { CHAVE: 'nota com a mesma chave de acesso', NUMERO: 'compra com o mesmo número do mesmo fornecedor', PORTAL: 'o XML já importado no portal de XML' };
    const partes = resultado.duplicidade.map((d) => (textos[d.motivo] || d.motivo) + (d.NUNOTA ? ' (NUNOTA ' + d.NUNOTA + ')' : ' (ainda sem nota gerada)'));
    alertas.push({ tipo: 'JA_EXISTE_NO_ERP', mensagem: 'Esta NF-e já aparece no ERP: ' + unicos(partes).join('; ') + '.' });
  }
  if (!empresas.length) {
    resultado.situacao = 'SEM_EMPRESA';
    resultado.resumo = 'O CNPJ do destinatário não corresponde a nenhuma empresa cadastrada.';
    return resultado;
  }
  if (!parceiros.length) {
    resultado.situacao = 'SEM_FORNECEDOR';
    resultado.resumo = 'Nenhum parceiro ativo no ERP com o CNPJ do emitente.';
    return resultado;
  }

  const daEmpresa = pedidos.filter((p) => codemps.includes(num(p.CODEMP)) && codparcs.includes(num(p.CODPARC)));
  const outrasEmpresas = pedidos.filter((p) => !codemps.includes(num(p.CODEMP)) && codparcs.includes(num(p.CODPARC)));

  for (const itemDoc of doc.itens || []) {
    const ident = identificarProduto(itemDoc, codparcs, entrada.dePara || [], entrada.referencias || []);
    const linhas = [];
    for (const p of daEmpresa) {
      for (const it of p.itens || []) {
        if (!ident.codprods.includes(num(it.CODPROD))) continue;
        if (saldo(it).pendente <= ARRED) continue;
        linhas.push(compararLinha(itemDoc, p, it));
      }
    }
    // Sugestao nao decide: as linhas aparecem so para a pessoa conferir.
    const linhasSugeridas = [];
    for (const p of daEmpresa) {
      for (const it of p.itens || []) {
        if (ident.sugestoes.includes(num(it.CODPROD)) && saldo(it).pendente > ARRED) linhasSugeridas.push(compararLinha(itemDoc, p, it));
      }
    }
    const pedidosDoItem = unicos(linhas.map((l) => l.pedido));
    let situacao;
    if (ident.situacao === 'NAO_IDENTIFICADO') situacao = 'PRODUTO_NAO_IDENTIFICADO';
    else if (!linhas.length) situacao = 'SEM_PEDIDO';
    else if (pedidosDoItem.length === 1) situacao = 'PEDIDO_UNICO';
    else situacao = 'AMBIGUO';
    const emOutraEmpresa = ident.codprods.length ? unicos(outrasEmpresas.filter((p) => (p.itens || []).some((it) => ident.codprods.includes(num(it.CODPROD)) && saldo(it).pendente > ARRED)).map((p) => num(p.CODEMP))) : [];
    const pendenteNoPedido = pedidosDoItem.map((nu) => linhas.filter((l) => l.pedido === nu).reduce((s, l) => s + l.pendente, 0));
    resultado.itens.push({
      nItem: itemDoc.nItem ?? null, cProd: itemDoc.cProd || '', cEAN: itemDoc.cEAN || '', xProd: itemDoc.xProd || itemDoc.descricao || '',
      quantidade: num(itemDoc.quantidade), unidade: codigo(itemDoc.unidade), valorUnitario: num(itemDoc.valorUnitario), valorTotal: num(itemDoc.valorTotal),
      identificacao: ident, situacao, pedidos: pedidosDoItem, linhas, linhasSugeridas,
      saldoSuficienteEm: pedidosDoItem.filter((_, i) => pendenteNoPedido[i] + ARRED >= num(itemDoc.quantidade)),
      pendenteEmOutraEmpresa: emOutraEmpresa,
    });
    if (situacao === 'SEM_PEDIDO' && emOutraEmpresa.length) alertas.push({ tipo: 'PEDIDO_EM_OUTRA_EMPRESA', mensagem: 'Item ' + (itemDoc.nItem ?? '') + ': há saldo deste produto em pedido do fornecedor para outra empresa (' + emOutraEmpresa.join(', ') + ').' });
    // Codigo ligado a varios produtos: so vira alerta quando o pedido nao desfaz a duvida.
    if (ident.situacao === 'AMBIGUO' && unicos(linhas.map((l) => l.codprod)).length !== 1) alertas.push({ tipo: 'PRODUTO_AMBIGUO', mensagem: 'Item ' + (itemDoc.nItem ?? '') + ': o código ' + (itemDoc.cProd || '') + ' corresponde a mais de um produto (' + ident.codprods.join(', ') + ').' });
  }

  // Pedidos candidatos, com as contagens que sustentam a ordem de apresentacao. A ordem e so
  // apresentacao: com mais de um candidato a situacao continua AMBIGUO ate uma pessoa decidir.
  // No empate vem o pedido mais recente, por evidencia historica (relatorio de precisao), nao por regra.
  const identificados = resultado.itens.filter((i) => i.identificacao.situacao !== 'NAO_IDENTIFICADO').length;
  const candidatos = unicos(resultado.itens.flatMap((i) => i.pedidos));
  resultado.pedidos = candidatos.map((nu) => {
    const p = daEmpresa.find((x) => num(x.NUNOTA) === nu);
    const doPedido = resultado.itens.map((i) => i.linhas.filter((l) => l.pedido === nu)).filter((ls) => ls.length);
    const itensCobertos = doPedido.length;
    const conta = (f) => doPedido.filter((ls) => ls.some(f)).length;
    const codprodsDoc = unicos(resultado.itens.flatMap((i) => i.identificacao.codprods));
    const foraDoDocumento = (p.itens || []).filter((it) => saldo(it).pendente > ARRED && !codprodsDoc.includes(num(it.CODPROD)));
    const vinculos = p.vinculos || [];
    return {
      NUNOTA: nu, NUMNOTA: p.NUMNOTA ?? null, DTNEG: p.DTNEG || '', CODEMP: num(p.CODEMP), CODPARC: num(p.CODPARC), CODTIPOPER: num(p.CODTIPOPER), STATUSNOTA: p.STATUSNOTA || '',
      itensCobertos, cobreTodosOsItens: identificados > 0 && itensCobertos === identificados,
      itensComSaldoSuficiente: conta((l) => l.saldoAposDocumento !== null && l.saldoAposDocumento >= -ARRED),
      itensComPrecoIgual: conta((l) => !l.divergencias.includes('PRECO_DIFERENTE')),
      itensComQuantidadeIgualAoPendente: conta((l) => !l.divergencias.includes('UNIDADE_DIFERENTE') && igual(l.pendente, l.quantidadeDocumento)),
      jaFaturadoParcialmente: vinculos.length > 0 || (p.itens || []).some((it) => num(it.QTDENTREGUE) > ARRED),
      vinculos: vinculos.map((v) => ({ NUNOTA: num(v.NUNOTA), NUMNOTA: v.NUMNOTA ?? null, CODTIPOPER: num(v.CODTIPOPER), STATUSNOTA: v.STATUSNOTA || '', SEQUENCIAORIG: num(v.SEQUENCIAORIG), QTDATENDIDA: num(v.QTDATENDIDA) })),
      itensPendentesForaDoDocumento: foraDoDocumento.length,
    };
  }).sort((a, b) => (b.cobreTodosOsItens - a.cobreTodosOsItens) || (b.itensCobertos - a.itensCobertos) || (b.itensComSaldoSuficiente - a.itensComSaldoSuficiente)
    || (b.itensComPrecoIgual - a.itensComPrecoIgual) || (b.itensComQuantidadeIgualAoPendente - a.itensComQuantidadeIgualAoPendente) || (b.NUNOTA - a.NUNOTA));

  const sit = resultado.itens.map((i) => i.situacao);
  const nTotal = sit.length;
  const conta = (s) => sit.filter((x) => x === s).length;
  const comPedido = conta('PEDIDO_UNICO') + conta('AMBIGUO');
  const pedidosUnicos = unicos(resultado.itens.filter((i) => i.situacao === 'PEDIDO_UNICO').flatMap((i) => i.pedidos));
  if (!nTotal) resultado.situacao = 'SEM_ITENS';
  else if (!comPedido) resultado.situacao = conta('PRODUTO_NAO_IDENTIFICADO') === nTotal ? 'PRODUTOS_NAO_IDENTIFICADOS' : 'SEM_PEDIDO';
  else if (conta('AMBIGUO')) resultado.situacao = 'AMBIGUO';
  else if (comPedido < nTotal) resultado.situacao = 'PARCIAL';
  else resultado.situacao = pedidosUnicos.length === 1 ? 'PEDIDO_UNICO' : 'MULTIPLOS_PEDIDOS';

  const divergentes = resultado.itens.filter((i) => i.situacao === 'PEDIDO_UNICO' && i.linhas.every((l) => l.divergencias.length)).length;
  const textos = {
    SEM_ITENS: 'O documento não tem itens para comparar.',
    PRODUTOS_NAO_IDENTIFICADOS: 'Nenhum item da nota foi associado a um produto do ERP.',
    SEM_PEDIDO: 'Nenhum item tem saldo em pedido deste fornecedor para esta empresa.',
    AMBIGUO: conta('AMBIGUO') + ' de ' + nTotal + ' item(ns) cabem em mais de um pedido: uma pessoa precisa escolher.',
    PARCIAL: comPedido + ' de ' + nTotal + ' item(ns) têm pedido; os demais não.',
    PEDIDO_UNICO: 'Todos os itens correspondem ao mesmo pedido.',
    MULTIPLOS_PEDIDOS: 'Cada item corresponde a um único pedido, em ' + pedidosUnicos.length + ' pedidos.',
  };
  resultado.resumo = textos[resultado.situacao] + (divergentes ? ' ' + divergentes + ' item(ns) com divergência.' : '');
  return resultado;
}

module.exports = { conferir, identificarProduto, saldo, codigo, ARRED };
