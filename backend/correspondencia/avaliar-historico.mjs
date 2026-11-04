// Avaliacao de precisao do motor de correspondencia com dados historicos do piloto.
// Documento = NF-e REAL recebida (XML guardado no portal de XML do Sankhya). Gabarito = vinculo
// registrado pelo Sankhya (TGFVAR). Pedidos reconstruidos como estavam quando a nota entrou: so
// pedidos ja existentes e saldo descontado so das notas anteriores. Somente leitura.
//   cd backend && node correspondencia/avaliar-historico.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { carregarHistorico, PILOTO } from './historico.mjs';
import { registro } from '../auditoria/leitura.mjs';

const require = createRequire(import.meta.url);
const { conferir, identificarProduto } = require('./motor.cjs');
const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const soDig = (v) => String(v ?? '').replace(/\D/g, '');
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
const conta = (lista, f) => lista.filter(f).length;
const agrupar = (lista, chave) => lista.reduce((m, x) => { const k = chave(x); (m.get(k) ?? m.set(k, []).get(k)).push(x); return m; }, new Map());

const h = await carregarHistorico();

// Indices
const cnpjParaParceiros = agrupar(h.parceiros.filter((p) => p.ATIVO === 'S'), (p) => soDig(p.CGC_CPF));
const cnpjParaEmpresas = agrupar(h.empresas.map((e) => ({ CODEMP: num(e.CODEMP), NOME: `Empresa ${e.CODEMP}`, cnpj: soDig(e.CGC) })), (e) => e.cnpj);
const xmlPorNota = new Map();
for (const x of h.xmlCab) { const a = xmlPorNota.get(num(x.NUNOTA)); if (!a || num(x.NUARQUIVO) > num(a.NUARQUIVO)) xmlPorNota.set(num(x.NUNOTA), x); }
const itensXmlPorArquivo = agrupar(h.xmlItens, (x) => num(x.NUARQUIVO));
const itensNotaPorNota = agrupar(h.notaItens, (x) => num(x.NUNOTA));
const gabaritoPorNota = agrupar(h.notaVinculos.filter((v) => PILOTO.topPedido.includes(num(v.TOP_ORIGEM))), (v) => num(v.NUNOTA));
const pedidos = [...agrupar(h.pedidoItens, (x) => num(x.NUNOTA)).values()].map((ls) => ({
  NUNOTA: num(ls[0].NUNOTA), NUMNOTA: ls[0].NUMNOTA, CODEMP: num(ls[0].CODEMP), CODPARC: num(ls[0].CODPARC), DTNEG: ls[0].DTNEG, CODTIPOPER: PILOTO.topPedido[0], itensAtuais: ls,
}));
const pedidosPorParceiro = agrupar(pedidos, (p) => p.CODPARC);
const vinculosPorPedido = agrupar(h.pedidoVinculos, (v) => num(v.NUNOTAORIG));
const vinculosPorItem = agrupar(h.pedidoVinculos, (v) => `${num(v.NUNOTAORIG)}/${num(v.SEQUENCIAORIG)}`);
const pedidoPorNunota = new Map(pedidos.map((p) => [p.NUNOTA, p]));

// Pedido como estava antes da nota N: entregue = soma do que notas anteriores atenderam.
// cortadosComoFechados: item hoje nao pendente e nunca atendido por inteiro foi cortado em data
// desconhecida. Cenario conservador (principal): continua pendente. Otimista: ja estava fechado.
function pedidoAntesDa(p, nunotaNota, cortadosComoFechados) {
  const vinc = (vinculosPorPedido.get(p.NUNOTA) ?? []).filter((v) => num(v.NUNOTA) < nunotaNota);
  const itens = p.itensAtuais.map((it) => {
    const doItem = vinculosPorItem.get(`${p.NUNOTA}/${num(it.SEQUENCIA)}`) ?? [];
    const entregue = doItem.filter((v) => num(v.NUNOTA) < nunotaNota).reduce((s, v) => s + num(v.QTDATENDIDA), 0);
    const atendidoTotal = doItem.reduce((s, v) => s + num(v.QTDATENDIDA), 0);
    const cortado = String(it.PENDENTE) === 'N' && atendidoTotal + 1e-6 < num(it.QTDNEG);
    return { SEQUENCIA: it.SEQUENCIA, CODPROD: it.CODPROD, QTDNEG: it.QTDNEG, QTDENTREGUE: entregue, VLRUNIT: it.VLRUNIT, CODVOL: it.CODVOL, PENDENTE: cortadosComoFechados && cortado ? 'N' : 'S' };
  });
  return { ...p, itens, vinculos: vinc };
}

function avaliar(cortadosComoFechados) {
  const casos = [];
  for (const n of h.notas) {
    const nu = num(n.NUNOTA);
    const cab = xmlPorNota.get(nu);
    if (!cab) { casos.push({ nu, top: num(n.CODTIPOPER), semXml: true }); continue; }
    const itensXml = itensXmlPorArquivo.get(num(cab.NUARQUIVO)) ?? [];
    const documento = {
      chave: cab.CHAVEACESSO, numero: String(cab.NUMNOTA ?? n.NUMNOTA), cnpjEmitente: soDig(cab.CNPJPARC), cnpjDestinatario: soDig(cab.CNPJDEST),
      itens: itensXml.map((x) => ({ nItem: num(x.NITEM), cProd: x.CPROD ?? '', cEAN: x.CEAN ?? '', xProd: x.XPROD ?? '', quantidade: num(x.QCOM), unidade: x.UCOM ?? '', valorUnitario: num(x.VUNCOM), valorTotal: num(x.VPROD) })),
    };
    const parceiros = (cnpjParaParceiros.get(documento.cnpjEmitente) ?? []).map((p) => ({ CODPARC: num(p.CODPARC) }));
    const codparcs = parceiros.map((p) => p.CODPARC);
    const candidatos = codparcs.flatMap((c) => pedidosPorParceiro.get(c) ?? []).filter((p) => p.NUNOTA < nu).map((p) => pedidoAntesDa(p, nu, cortadosComoFechados));
    const empresasDoc = cnpjParaEmpresas.get(documento.cnpjDestinatario) ?? [];
    const r = conferir({ documento, empresas: empresasDoc, parceiros, dePara: h.dePara, referencias: h.referencias, pedidos: candidatos, existentes: [] });
    const gab = gabaritoPorNota.get(nu) ?? [];
    const T = [...new Set(gab.map((v) => num(v.NUNOTAORIG)))].sort((a, b) => a - b);
    const C = r.pedidos.map((p) => p.NUNOTA);
    // Alinhamento item do XML -> item da nota no ERP (gabarito por item): mesmo numero de item.
    const erp = itensNotaPorNota.get(nu) ?? [];
    const itens = r.itens.map((it) => {
      const e = erp.find((x) => num(x.SEQUENCIA) === num(it.nItem));
      const origens = e ? [...new Set(gab.filter((v) => num(v.SEQUENCIA) === num(e.SEQUENCIA)).map((v) => num(v.NUNOTAORIG)))] : [];
      const linhaCerta = e ? it.linhas.find((l) => gab.some((v) => num(v.SEQUENCIA) === num(e.SEQUENCIA) && num(v.NUNOTAORIG) === l.pedido && num(v.SEQUENCIAORIG) === l.sequencia)) : null;
      return { it, e, origens, linhaCerta };
    });
    // Por que o pedido verdadeiro nao esta entre os candidatos (quando nao esta)
    let motivoFora = '';
    if (T.length && !T.every((t) => C.includes(t))) {
      const tp = T.map((t) => pedidoPorNunota.get(t)).filter(Boolean);
      const codprodsDoc = new Set(r.itens.flatMap((i) => i.identificacao.codprods));
      if (tp.length < T.length) motivoFora = 'pedido fora do periodo lido';
      else if (tp.every((p) => p.NUNOTA > nu)) motivoFora = 'pedido criado depois da nota';
      else if (!empresasDoc.length) motivoFora = 'destinatario sem empresa';
      else if (tp.every((p) => !empresasDoc.some((e) => e.CODEMP === p.CODEMP))) motivoFora = 'pedido de outra empresa';
      else if (tp.every((p) => !codparcs.includes(p.CODPARC))) motivoFora = 'pedido de outro parceiro (CNPJ diferente ou parceiro inativo)';
      else if (tp.every((p) => !p.itensAtuais.some((it) => codprodsDoc.has(num(it.CODPROD))))) motivoFora = 'produto do XML nao identificado como o do pedido';
      else motivoFora = 'pedido sem saldo para o produto antes da nota';
    }
    casos.push({ nu, top: num(n.CODTIPOPER), codemp: num(n.CODEMP), r, T, C, itens, nItensXml: itensXml.length, nItensErp: erp.length, motivoFora });
  }
  return casos;
}

const principal = avaliar(false);
const otimista = avaliar(true);

function metricas(casos) {
  const ok = casos.filter((c) => !c.semXml);
  const comGab = ok.filter((c) => c.T.length);
  const igual = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const sit = (s) => comGab.filter((c) => c.r.situacao === s);
  const decididos = comGab.filter((c) => ['PEDIDO_UNICO', 'MULTIPLOS_PEDIDOS'].includes(c.r.situacao));
  const decididosCertos = decididos.filter((c) => igual([...c.C].sort((a, b) => a - b), c.T));
  const amb = sit('AMBIGUO');
  return {
    total: casos.length, semXml: casos.length - ok.length, comGabarito: comGab.length, semGabarito: ok.length - comGab.length,
    situacoes: Object.fromEntries([...agrupar(comGab, (c) => c.r.situacao)].map(([k, v]) => [k, v.length])),
    situacoesSemGabarito: Object.fromEntries([...agrupar(ok.filter((c) => !c.T.length), (c) => c.r.situacao)].map(([k, v]) => [k, v.length])),
    coberturaCandidatos: conta(comGab, (c) => c.T.every((t) => c.C.includes(t))),
    decididos: decididos.length, decididosCertos: decididosCertos.length,
    decididosErrados: decididos.filter((c) => !decididosCertos.includes(c)).map((c) => ({ nu: c.nu, situacao: c.r.situacao, T: c.T, C: c.C })),
    ambiguos: amb.length, ambiguosComGabaritoNosCandidatos: conta(amb, (c) => c.T.every((t) => c.C.includes(t))), ambiguosPrimeiroCerto: conta(amb, (c) => c.T.includes(c.C[0])),
    candidatosPorAmbiguo: amb.map((c) => c.C.length).sort((a, b) => a - b),
    // Evidencia para Compras (A-07). O motor NAO aplica nada disto: com mais de um candidato, continua ambiguo.
    ambUnicoCobreTudo: conta(amb, (c) => c.r.pedidos.filter((p) => p.cobreTodosOsItens).length === 1),
    ambUnicoCobreTudoCerto: conta(amb, (c) => { const u = c.r.pedidos.filter((p) => p.cobreTodosOsItens); return u.length === 1 && c.T.includes(u[0].NUNOTA) && c.T.length === 1; }),
    ambMaisAntigoCerto: conta(amb, (c) => c.T.includes(Math.min(...c.C))),
    ambMaisRecenteCerto: conta(amb, (c) => c.T.includes(Math.max(...c.C))),
    motivosFora: Object.fromEntries([...agrupar(comGab.filter((c) => c.motivoFora), (c) => c.motivoFora)].map(([k, v]) => [k, v.length])),
    decididosErradosMotivo: Object.fromEntries([...agrupar(decididos.filter((c) => !decididosCertos.includes(c)), (c) => (c.T.every((t) => t > c.nu) ? 'pedido verdadeiro criado depois da nota' : 'outro'))].map(([k, v]) => [k, v.length])),
  };
}
const M = metricas(principal);
const MO = metricas(otimista);

// Identificacao do produto por item (itens alinhados com o item da nota no ERP)
const itensAlinhados = principal.filter((c) => !c.semXml).flatMap((c) => c.itens.filter((x) => x.e));
const porFonte = new Map();
for (const x of itensAlinhados) {
  const id = x.it.identificacao;
  const f = id.fonte || 'NENHUMA';
  const k = porFonte.get(f) ?? { total: 0, certo: 0, errado: 0, ambiguoComCerto: 0, ambiguoSemCerto: 0 };
  k.total++;
  const verdade = num(x.e.CODPROD);
  if (id.situacao === 'IDENTIFICADO') { if (id.codprods[0] === verdade) k.certo++; else k.errado++; }
  else if (id.situacao === 'AMBIGUO') { if (id.codprods.includes(verdade)) k.ambiguoComCerto++; else k.ambiguoSemCerto++; }
  porFonte.set(f, k);
}
// Limite da medida de identificacao: a TGFPAP de hoje nao tem data e pode conter pares criados por
// estas notas. Item cujo par (fornecedor, codigo) aparece pela 1a vez no periodo e o teto do que
// poderia nao estar cadastrado quando a nota chegou.
const paresVistos = new Set();
let primeiraVez = 0;
for (const c of [...principal].filter((x) => !x.semXml).sort((a, b) => a.nu - b.nu)) {
  for (const x of c.itens) {
    const par = `${c.r.documento.cnpjEmitente}|${String(x.it.cProd).trim().toUpperCase()}`;
    if (!paresVistos.has(par)) { paresVistos.add(par); primeiraVez++; }
  }
}
// Identificacao SEM o de-para: mede a forca das referencias do produto (fonte alternativa).
const semDePara = { total: 0, certo: 0, errado: 0, ambiguoComCerto: 0, ambiguoSemCerto: 0, nenhum: 0, porFonte: {} };
for (const c of principal.filter((x) => !x.semXml)) {
  const codparcs = (cnpjParaParceiros.get(c.r.documento.cnpjEmitente) ?? []).map((p) => num(p.CODPARC));
  for (const x of c.itens.filter((y) => y.e)) {
    const id = identificarProduto({ cProd: x.it.cProd, cEAN: x.it.cEAN }, codparcs, [], h.referencias);
    const verdade = num(x.e.CODPROD);
    semDePara.total++;
    const f = (semDePara.porFonte[id.fonte || 'NENHUMA'] ??= { total: 0, certo: 0, errado: 0, ambiguoComCerto: 0, ambiguoSemCerto: 0 });
    f.total++;
    if (id.situacao === 'NAO_IDENTIFICADO') semDePara.nenhum++;
    else if (id.situacao === 'IDENTIFICADO') { if (id.codprods[0] === verdade) { semDePara.certo++; f.certo++; } else { semDePara.errado++; f.errado++; } } else if (id.codprods.includes(verdade)) { semDePara.ambiguoComCerto++; f.ambiguoComCerto++; } else { semDePara.ambiguoSemCerto++; f.ambiguoSemCerto++; }
  }
}
const totalItensXml = principal.reduce((s, c) => s + (c.nItensXml ?? 0), 0);
const notasMesmoNItens = conta(principal.filter((c) => !c.semXml), (c) => c.nItensXml === c.nItensErp);

// Item -> pedido (itens com um so pedido e com gabarito)
const itensUnicos = itensAlinhados.filter((x) => x.it.situacao === 'PEDIDO_UNICO' && x.origens.length);
const itensUnicosCertos = conta(itensUnicos, (x) => x.origens.length === 1 && x.origens[0] === x.it.pedidos[0]);

// Divergencias observadas na linha certa (descritivo, sem tolerancia)
const linhasCertas = itensAlinhados.map((x) => x.linhaCerta).filter(Boolean);
const faixa = (l) => {
  const d = Math.abs(l.diferencaPreco);
  if (d <= 1e-6) return 'igual';
  if (d <= 0.01) return 'ate R$ 0,01';
  const p = Math.abs(l.diferencaPrecoPct ?? 100);
  if (p <= 1) return 'ate 1%';
  if (p <= 5) return 'de 1% a 5%';
  return 'acima de 5%';
};
const faixasPreco = Object.fromEntries([...agrupar(linhasCertas.filter((l) => !l.divergencias.includes('UNIDADE_DIFERENTE')), faixa)].map(([k, v]) => [k, v.length]));
const unidadeDiferente = conta(linhasCertas, (l) => l.divergencias.includes('UNIDADE_DIFERENTE'));
const paresUnidade = [...agrupar(linhasCertas.filter((l) => l.divergencias.includes('UNIDADE_DIFERENTE')), (l) => `${l.unidadeDocumento} -> ${l.unidadePedido}`)].map(([k, v]) => [k, v.length]).sort((a, b) => b[1] - a[1]).slice(0, 12);
const unidDif = linhasCertas.filter((l) => l.divergencias.includes('UNIDADE_DIFERENTE'));
const unidDifQtdIgual = conta(unidDif, (l) => Math.abs(l.quantidadeDocumento - l.pendente) <= 1e-6);
const unidDifPrecoIgual = conta(unidDif, (l) => !l.divergencias.includes('PRECO_DIFERENTE'));
const qtdIgualMesmaUnidade = conta(linhasCertas.filter((l) => !l.divergencias.includes('UNIDADE_DIFERENTE')), (l) => Math.abs(l.quantidadeDocumento - l.pendente) <= 1e-6);
const itensParciais = conta(linhasCertas, (l) => l.saldoAposDocumento !== null && l.saldoAposDocumento > 1e-6);
const qtdAcima = conta(linhasCertas, (l) => l.divergencias.includes('QUANTIDADE_ACIMA_DO_PENDENTE'));
const parcialAntes = conta(principal.filter((c) => c.T.length), (c) => c.r.pedidos.some((p) => c.T.includes(p.NUNOTA) && p.jaFaturadoParcialmente));

// V-05: QTDENTREGUE do pedido x soma do que a TGFVAR registra como atendido
const itensPedido = h.pedidoItens;
const v05 = itensPedido.map((it) => {
  const atendido = (vinculosPorPedido.get(num(it.NUNOTA)) ?? []).filter((v) => num(v.SEQUENCIAORIG) === num(it.SEQUENCIA)).reduce((s, v) => s + num(v.QTDATENDIDA), 0);
  return { igual: Math.abs(num(it.QTDENTREGUE) - atendido) <= 1e-6, pendenteS: String(it.PENDENTE) === 'S', saldo: num(it.QTDNEG) - num(it.QTDENTREGUE) };
});
const v05Igual = conta(v05, (x) => x.igual);
const v05PendSemSaldo = conta(v05, (x) => x.pendenteS && x.saldo <= 1e-6);
const v05NaoPendComSaldo = conta(v05, (x) => !x.pendenteS && x.saldo > 1e-6);

const porTop = Object.fromEntries(PILOTO.topNota.map((t) => [t, metricas(principal.filter((c) => c.top === t))]));
const saida = { geradoEm: new Date().toISOString(), consultas: registro.length, M, MO, porTop, porFonte: Object.fromEntries(porFonte), totalItensXml, itensAlinhados: itensAlinhados.length, notasMesmoNItens, itensUnicos: itensUnicos.length, itensUnicosCertos, linhasCertas: linhasCertas.length, faixasPreco, primeiraVez, semDePara, unidDifQtdIgual, unidDifPrecoIgual, unidadeDiferente, paresUnidade, qtdIgualMesmaUnidade, itensParciais, qtdAcima, parcialAntes, v05: { itens: v05.length, igual: v05Igual, pendSemSaldo: v05PendSemSaldo, naoPendComSaldo: v05NaoPendComSaldo }, pedidos: pedidos.length };
fs.writeFileSync(new URL('../auditoria/.cache/avaliacao-correspondencia.json', import.meta.url), JSON.stringify(saida, null, 2));
console.log(JSON.stringify({ ...saida, M: { ...M, decididosErrados: M.decididosErrados.slice(0, 5), candidatosPorAmbiguo: undefined }, MO: { ...MO, decididosErrados: MO.decididosErrados.length, candidatosPorAmbiguo: undefined }, porTop: Object.fromEntries(Object.entries(porTop).map(([k, v]) => [k, { comGabarito: v.comGabarito, situacoes: v.situacoes, decididos: v.decididos, decididosCertos: v.decididosCertos, cobertura: v.coberturaCandidatos }])) }, null, 1));
const linhasReg = registro.map((x) => `| ${x.id} | ${x.objetivo} | ${x.origem} | ${x.periodo} | ${x.filtros} | ${x.linhas} | ${x.lidoEm ?? ''} |`);
fs.writeFileSync(new URL('../../modulo-documental/registro-consultas-correspondencia.md', import.meta.url), `# Registro de consultas: avaliação do motor de correspondência

Somente leitura no Oracle do Sankhya (trava de SELECT/WITH). ${registro.length} consultas, ${registro.filter((x) => x.erro).length} com erro.

| Consulta | Objetivo | Origem | Período | Filtros | Linhas | Lida em |
|---|---|---|---|---|---:|---|
${linhasReg.join('\n')}
`);
console.log('pct exemplo', pct(M.decididosCertos, M.decididos));
