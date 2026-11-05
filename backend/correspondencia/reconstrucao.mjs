// Reconstrucao do historico para avaliar o motor: documento = XML real, gabarito = TGFVAR (nunca
// entregue ao motor), pedidos como estavam antes da nota. Usado pela avaliacao e pela validacao.
import { createRequire } from 'node:module';
import { PILOTO } from './historico.mjs';

const require = createRequire(import.meta.url);
const { conferir } = require('./motor.cjs');
export const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
export const soDig = (v) => String(v ?? '').replace(/\D/g, '');
export const conta = (lista, f) => lista.filter(f).length;
export const agrupar = (lista, chave) => lista.reduce((m, x) => { const k = chave(x); (m.get(k) ?? m.set(k, []).get(k)).push(x); return m; }, new Map());

export function montarAvaliador(h) {
  const notaPorNu = new Map(h.notas.map((n) => [num(n.NUNOTA), n]));

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

  const cod = (v) => String(v ?? '').trim().toUpperCase();
  const deParaPorCodigo = agrupar(h.dePara, (d) => cod(d.CODPROPARC));
  const refsPorForn = agrupar(h.referencias.filter((x) => x.REFFORN), (x) => cod(x.REFFORN));

  // opcoes.cortadosComoFechados: ver pedidoAntesDa. opcoes.deParaPessimista: o de-para so conhece o par
  // (fornecedor, codigo) que ja apareceu em nota anterior do periodo; opcoes.semDePara: de-para vazio.
  function avaliar(opcoes = {}) {
    const { cortadosComoFechados = false, deParaPessimista = false, semDePara = false } = opcoes;
    const casos = [];
    const vistos = new Set();
    for (const n of [...h.notas].sort((a, b) => num(a.NUNOTA) - num(b.NUNOTA))) {
      const nu = num(n.NUNOTA);
      const cab = xmlPorNota.get(nu);
      if (!cab) { casos.push({ nu, top: num(n.CODTIPOPER), semXml: true }); continue; }
      const itensXml = itensXmlPorArquivo.get(num(cab.NUARQUIVO)) ?? [];
      const documento = {
        chave: cab.CHAVEACESSO, numero: String(cab.NUMNOTA ?? n.NUMNOTA), cnpjEmitente: soDig(cab.CNPJPARC), cnpjDestinatario: soDig(cab.CNPJDEST),
        itens: itensXml.map((x) => ({ nItem: num(x.NITEM), cProd: x.CPROD ?? '', cEAN: x.CEAN ?? '', xProd: x.XPROD ?? '', quantidade: num(x.QCOM), unidade: x.UCOM ?? '', valorUnitario: num(x.VUNCOM), valorTotal: num(x.VPROD), xPed: x.XPED ?? '', nItemPed: x.NITEMPED ?? '', valorDesconto: num(x.VDESC) })),
      };
      const parceiros = (cnpjParaParceiros.get(documento.cnpjEmitente) ?? []).map((p) => ({ CODPARC: num(p.CODPARC) }));
      const codparcs = parceiros.map((p) => p.CODPARC);
      const candidatos = codparcs.flatMap((c) => pedidosPorParceiro.get(c) ?? []).filter((p) => p.NUNOTA < nu).map((p) => pedidoAntesDa(p, nu, cortadosComoFechados));
      const empresasDoc = cnpjParaEmpresas.get(documento.cnpjDestinatario) ?? [];
      const codigosDoc = [...new Set(documento.itens.map((i) => cod(i.cProd)))];
      let deParaNota = codigosDoc.flatMap((c) => deParaPorCodigo.get(c) ?? []);
      if (semDePara) deParaNota = [];
      if (deParaPessimista) deParaNota = deParaNota.filter((d) => vistos.has(`${documento.cnpjEmitente}|${cod(d.CODPROPARC)}`));
      const t0 = performance.now();
    const r = conferir({ documento, empresas: empresasDoc, parceiros, dePara: deParaNota, referencias: codigosDoc.flatMap((c) => refsPorForn.get(c) ?? []), pedidos: candidatos, existentes: [] });
      const ms = performance.now() - t0;
    codigosDoc.forEach((c) => vistos.add(`${documento.cnpjEmitente}|${c}`));
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
        if (tp.length < T.length) motivoFora = 'pedido fora do período lido';
        else if (tp.every((p) => p.NUNOTA > nu)) motivoFora = 'pedido criado depois da nota';
        else if (!empresasDoc.length) motivoFora = 'destinatário sem empresa';
        else if (tp.every((p) => !empresasDoc.some((e) => e.CODEMP === p.CODEMP))) motivoFora = 'pedido de outra empresa';
        else if (tp.every((p) => !codparcs.includes(p.CODPARC))) motivoFora = 'pedido de outro parceiro (CNPJ diferente ou parceiro inativo)';
        else if (tp.every((p) => !p.itensAtuais.some((it) => codprodsDoc.has(num(it.CODPROD))))) motivoFora = 'produto do XML não identificado como o do pedido';
        else motivoFora = 'pedido sem saldo para o produto antes da nota';
      }
      casos.push({ nu, top: num(n.CODTIPOPER), codemp: num(n.CODEMP), dtneg: n.DTNEG, ms, r, T, C, itens, nItensXml: itensXml.length, nItensErp: erp.length, motivoFora });
    }
    return casos;
  }

  return { avaliar, notaPorNu, pedidos, refsPorForn, vinculosPorPedido, cod };
}
