// Avaliacao de precisao do motor de correspondencia com dados historicos do piloto.
// Documento = NF-e REAL recebida (XML guardado no portal de XML do Sankhya). Gabarito = vinculo
// registrado pelo Sankhya (TGFVAR). Pedidos reconstruidos como estavam quando a nota entrou: so
// pedidos ja existentes e saldo descontado so das notas anteriores. Somente leitura.
//   cd backend && node correspondencia/avaliar-historico.mjs
import fs from 'node:fs';
import { carregarHistorico, PILOTO } from './historico.mjs';
import { registro } from '../auditoria/leitura.mjs';
import { montarAvaliador, num, soDig, conta, agrupar } from './reconstrucao.mjs';
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1).replace('.', ',')}%` : '—');
const pct2 = (a, b) => (b ? `${((100 * a) / b).toFixed(2).replace('.', ',')}%` : '—');

const h = await carregarHistorico();
const { avaliar, notaPorNu, pedidos, refsPorForn, vinculosPorPedido, cod } = montarAvaliador(h);
const principal = avaliar();
const otimista = avaliar({ cortadosComoFechados: true });
const pessimista = avaliar({ deParaPessimista: true });
const seis = (c) => { const n = notaPorNu.get(c.nu); return n && n.DTNEG >= '2026-05-01'; };
const semDeParaCasos = avaliar({ semDePara: true });

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
const MP = metricas(pessimista.filter(seis));
const MBase6 = metricas(principal.filter(seis));
const itensPess = pessimista.filter(seis).flatMap((c) => c.itens);
const pessItens = { total: itensPess.length, naoIdentificados: conta(itensPess, (x) => x.it.identificacao.situacao === 'NAO_IDENTIFICADO'), comSugestao: conta(itensPess, (x) => x.it.identificacao.sugestoes.length > 0) };
// Sugestao por referencia do fornecedor, sem o de-para: quando ha linha pendente no pedido, a sugestao acerta?
const sugs = semDeParaCasos.flatMap((c) => c.itens).filter((x) => x.e && x.it.identificacao.sugestoes.length);
const sugComLinha = sugs.filter((x) => x.it.linhasSugeridas.length);
const sugestao = { total: sugs.length, certas: conta(sugs, (x) => x.it.identificacao.sugestoes.includes(num(x.e.CODPROD))), comLinhaNoPedido: sugComLinha.length, comLinhaCertas: conta(sugComLinha, (x) => x.it.identificacao.sugestoes.includes(num(x.e.CODPROD))) };

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
// Forca das fontes alternativas, sem o de-para. E esta medida que tirou REFERENCIA e GTIN do motor
// e deixou REFFORN so como sugestao.
const refsPorReferencia = agrupar(h.referencias.filter((x) => x.REFERENCIA), (x) => cod(x.REFERENCIA));
const fontesAlternativas = { REFFORN: { total: 0, certo: 0, errado: 0, varios: 0 }, REFERENCIA: { total: 0, certo: 0, errado: 0, varios: 0 }, GTIN: { total: 0, certo: 0, errado: 0, varios: 0 }, nenhuma: 0, itens: 0 };
for (const c of principal.filter((x) => !x.semXml)) {
  for (const x of c.itens.filter((y) => y.e)) {
    const codigo = cod(x.it.cProd);
    const gtin = cod(x.it.cEAN);
    const achar = [['REFFORN', codigo ? refsPorForn.get(codigo) : null], ['REFERENCIA', codigo ? refsPorReferencia.get(codigo) : null], ['GTIN', /^\d{8,14}$/.test(gtin) ? refsPorReferencia.get(gtin) : null]].find(([, l]) => l && l.length);
    fontesAlternativas.itens++;
    if (!achar) { fontesAlternativas.nenhuma++; continue; }
    const k = fontesAlternativas[achar[0]];
    const prods = [...new Set(achar[1].map((y) => num(y.CODPROD)))];
    k.total++;
    if (prods.length > 1) k.varios++;
    else if (prods[0] === num(x.e.CODPROD)) k.certo++;
    else k.errado++;
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
const v05Total = v05.length;

const porTop = Object.fromEntries(PILOTO.topNota.map((t) => [t, metricas(principal.filter((c) => c.top === t))]));
const saida = { geradoEm: new Date().toISOString(), consultas: registro.length, M, MO, porTop, porFonte: Object.fromEntries(porFonte), totalItensXml, itensAlinhados: itensAlinhados.length, notasMesmoNItens, itensUnicos: itensUnicos.length, itensUnicosCertos, linhasCertas: linhasCertas.length, faixasPreco, primeiraVez, MP, MBase6, pessItens, sugestao, fontesAlternativas, unidDifQtdIgual, unidDifPrecoIgual, unidadeDiferente, paresUnidade, qtdIgualMesmaUnidade, itensParciais, qtdAcima, parcialAntes, v05: { itens: v05.length, igual: v05Igual, pendSemSaldo: v05PendSemSaldo, naoPendComSaldo: v05NaoPendComSaldo }, pedidos: pedidos.length };
fs.writeFileSync(new URL('../auditoria/.cache/avaliacao-correspondencia.json', import.meta.url), JSON.stringify(saida, null, 2));
console.log(JSON.stringify({ ...saida, M: { ...M, decididosErrados: M.decididosErrados.slice(0, 5), candidatosPorAmbiguo: undefined }, MO: { ...MO, decididosErrados: MO.decididosErrados.length, candidatosPorAmbiguo: undefined }, porTop: Object.fromEntries(Object.entries(porTop).map(([k, v]) => [k, { comGabarito: v.comGabarito, situacoes: v.situacoes, decididos: v.decididos, decididosCertos: v.decididosCertos, cobertura: v.coberturaCandidatos }])) }, null, 1));
const linhasReg = registro.map((x) => `| ${x.id} | ${x.objetivo} | ${x.origem} | ${x.periodo} | ${x.filtros} | ${x.linhas} | ${x.lidoEm ?? ''} |`);
fs.writeFileSync(new URL('../../modulo-documental/registro-consultas-correspondencia.md', import.meta.url), `# Registro de consultas: avaliação do motor de correspondência

Somente leitura no Oracle do Sankhya (trava de SELECT/WITH). ${registro.length} consultas, ${registro.filter((x) => x.erro).length} com erro.

| Consulta | Objetivo | Origem | Período | Filtros | Linhas | Lida em |
|---|---|---|---|---|---:|---|
${linhasReg.join('\n')}
`);
const f = (m) => {
  const c = m.candidatosPorAmbiguo; const q = (p) => (c.length ? c[Math.floor(p * (c.length - 1))] : 0);
  return { ...m, mediana: q(0.5), p90: q(0.9), maximo: c.length ? c[c.length - 1] : 0, sit: (k) => m.situacoes[k] ?? 0 };
};
const P = f(M); const O = f(MO); const B6 = f(MBase6); const P6 = f(MP);
const qtdLinhasSemUnid = linhasCertas.length - unidadeDiferente;
const fa = faixasPreco;
const linhaCenario = (n, m) => `| ${n} | ${m.total} | ${m.comGabarito} | ${pct(m.coberturaCandidatos, m.comGabarito)} | ${m.decididos} (${pct(m.decididos, m.comGabarito)}) | ${m.decididosCertos} de ${m.decididos} (${pct(m.decididosCertos, m.decididos)}) | ${m.ambiguos} (${pct(m.ambiguos, m.comGabarito)}) | ${pct(m.ambiguosComGabaritoNosCandidatos, m.ambiguos)} | ${pct(m.ambiguosPrimeiroCerto, m.ambiguos)} |`;
const ROTULO = { PEDIDO_UNICO: 'Todos os itens em um único pedido', MULTIPLOS_PEDIDOS: 'Cada item com um pedido, em mais de um pedido', AMBIGUO: 'Algum item cabe em mais de um pedido', PARCIAL: 'Parte dos itens sem pedido', SEM_PEDIDO: 'Nenhum item com saldo em pedido', PRODUTOS_NAO_IDENTIFICADOS: 'Nenhum item identificado' };
const af = fontesAlternativas;
const relatorio = `# Relatório de precisão: motor de correspondência NF-e × pedido

Gerado por \`backend/correspondencia/avaliar-historico.mjs\`. Somente leitura no Sankhya: ${registro.length} consultas (\`registro-consultas-correspondencia.md\`).

**Piloto:** pedidos TOP ${PILOTO.topPedido.join(', ')} e notas TOP ${PILOTO.topNota.join(' e ')}. **Período das notas:** 01/11/2025 a 31/10/2026.

## Resumo

| Medida (cenário principal) | Resultado |
|---|---|
| Notas avaliadas, todas com o XML real | ${P.total} |
| Quando o motor afirma o pedido sem dúvida, ele acerta | **${P.decididosCertos} de ${P.decididos} (${pct(P.decididosCertos, P.decididos)})** |
| O pedido verdadeiro está entre os candidatos | **${P.coberturaCandidatos} de ${P.comGabarito} (${pct(P.coberturaCandidatos, P.comGabarito)})** |
| Notas que ficam para uma pessoa escolher (ambíguas) | ${P.ambiguos} (${pct(P.ambiguos, P.comGabarito)}) |
| Notas sem vínculo que receberam candidato falso | ${conta(principal.filter((c) => !c.semXml && !c.T.length), (c) => c.C.length > 0)} de ${P.semGabarito} |

O motor é preciso quando afirma, mas **um terço das notas depende de escolha humana**, porque o mesmo produto tem saldo em mais de um pedido. E a cobertura medida depende do de-para atual: veja o cenário pessimista e as limitações, que são a parte mais importante deste relatório.

## Método

- **Documento:** o XML real de cada NF-e recebida, guardado no portal de XML do Sankhya (\`TGFIXN\`). Cobertura de ${P.total - P.semXml} de ${P.total} notas.
- **Gabarito:** o vínculo que o Sankhya registrou entre a nota e o pedido (\`TGFVAR\`).
- **Pedidos como estavam quando a nota entrou:** só pedidos já existentes (\`NUNOTA\` menor que o da nota), com o saldo descontado apenas das notas anteriores.
- **Mesma base para ajustar e medir:** os ajustes feitos no motor durante a avaliação estão na seção 10. O motor não tem pesos nem limiares ajustados, mas a ordem de apresentação foi escolhida com estes mesmos dados, então o índice "1º da lista" é otimista. Não foi separado um período só para teste.

## 1. Resultado por nota (cenário principal)

| Situação | Notas com gabarito | % | Significado |
|---|---:|---:|---|
${Object.keys(ROTULO).map((k) => `| ${k} | ${P.sit(k)} | ${pct(P.sit(k), P.comGabarito)} | ${ROTULO[k]} |`).join('\n')}

Notas sem vínculo com pedido TOP ${PILOTO.topPedido[0]} (${P.semGabarito}): ${Object.entries(P.situacoesSemGabarito).map(([k, v]) => `${k}: ${v}`).join('; ')}.

**Afirmações erradas (${P.decididosErrados.length}):** ${P.decididosErrados.map((e) => `nota ${e.nu}: o motor apontou ${e.C.join(', ')}; o vínculo final é ${e.T.join(', ')}`).join('; ')}. Em todas, o pedido do vínculo final foi criado **depois** da nota, e o motor apontou um pedido anterior com saldo do mesmo produto.

**Pedido verdadeiro fora dos candidatos (${P.comGabarito - P.coberturaCandidatos}):** ${Object.entries(P.motivosFora).map(([k, v]) => `${k}: ${v}`).join('; ')}. Pedido criado depois da nota não existe no momento da conferência: é um fato do processo, não um erro de comparação.

## 2. Cenários

| Cenário | Notas | Com gabarito | Gabarito entre os candidatos | Afirmou sem dúvida | Acertos ao afirmar | Ambíguas | Ambíguas: gabarito entre os candidatos | Ambíguas: gabarito é o 1º da lista |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${linhaCenario('Principal: de-para de hoje; item cortado segue pendente', P)}
${linhaCenario('Otimista: item cortado já estava fechado', O)}
${linhaCenario('Últimos 6 meses, de-para de hoje (base de comparação)', B6)}
${linhaCenario('Últimos 6 meses, **de-para pessimista**', P6)}

- **Item cortado:** ${v05NaoPendComSaldo} itens de pedido estão hoje não pendentes com saldo (corte de resíduo), sem data conhecida. Os dois primeiros cenários são os limites: a operação real fica entre eles.
- **De-para pessimista:** só vale o par fornecedor-código já visto em nota anterior do período. É um piso: conta como desconhecido até par que já existia antes de 11/2025. Nele, ${pct(pessItens.naoIdentificados, pessItens.total)} dos itens ficam sem identificação e a cobertura cai para ${pct(P6.coberturaCandidatos, P6.comGabarito)}, mas **a precisão ao afirmar se mantém (${pct(P6.decididosCertos, P6.decididos)})**: sem de-para, o motor diz "não identificado" em vez de errar.

## 3. Por TOP da nota (cenário principal)

| TOP | Com gabarito | Candidatos | Afirmou sem dúvida | Acertos | Ambíguas | 1º da lista |
|---|---:|---:|---:|---:|---:|---:|
${PILOTO.topNota.map((t) => { const v = porTop[t]; return `| ${t} | ${v.comGabarito} | ${pct(v.coberturaCandidatos, v.comGabarito)} | ${v.decididos} | ${v.decididosCertos} (${pct(v.decididosCertos, v.decididos)}) | ${v.ambiguos} | ${pct(v.ambiguosPrimeiroCerto, v.ambiguos)} |`; }).join('\n')}

## 4. Identificação do produto

Itens do XML: ${totalItensXml}; alinhados ao item da nota pelo número do item: ${itensAlinhados.length} (${notasMesmoNItens} de ${P.total} notas têm o mesmo número de itens no XML e no ERP).

| Fonte | Itens | Produto certo | Produto errado | Vários produtos, com o certo | Vários produtos, sem o certo |
|---|---:|---:|---:|---:|---:|
${[...porFonte.entries()].map(([k, v]) => `| De-para do Sankhya (${k}) | ${v.total} | ${v.certo} | ${v.errado} | ${v.ambiguoComCerto} | ${v.ambiguoSemCerto} |`).join('\n')}

Medido **sem o de-para**, para saber se dá para confiar nas outras fontes:

| Fonte alternativa | Itens | Produto certo | Produto errado | Código com vários produtos | Uso no motor |
|---|---:|---:|---:|---:|---|
| Referência do fornecedor (\`REFFORN\`) | ${af.REFFORN.total} | ${af.REFFORN.certo} | ${af.REFFORN.errado} (${pct(af.REFFORN.errado, af.REFFORN.total)}) | ${af.REFFORN.varios} | Só sugestão visível; não decide |
| Referência do produto (\`REFERENCIA\`) | ${af.REFERENCIA.total} | ${af.REFERENCIA.certo} | ${af.REFERENCIA.errado} (${pct(af.REFERENCIA.errado, af.REFERENCIA.total)}) | ${af.REFERENCIA.varios} | Não usada |
| GTIN contra a referência | ${af.GTIN.total} | ${af.GTIN.certo} | ${af.GTIN.errado} (${pct(af.GTIN.errado, af.GTIN.total)}) | ${af.GTIN.varios} | Não usada |

**Evidência para aprovação (A-08):** a sugestão por referência do fornecedor acerta ${sugestao.certas} de ${sugestao.total} (${pct(sugestao.certas, sugestao.total)}) sozinha, e ${sugestao.comLinhaCertas} de ${sugestao.comLinhaNoPedido} (${pct(sugestao.comLinhaCertas, sugestao.comLinhaNoPedido)}) quando também existe linha pendente daquele produto em pedido do fornecedor. O motor não usa isso para decidir; é uma regra que Compras pode avaliar.

## 5. Item → pedido

Itens com um único pedido candidato e com gabarito: ${itensUnicos.length}; pedido certo em ${itensUnicosCertos} (${pct2(itensUnicosCertos, itensUnicos.length)}).

## 6. Divergências observadas no histórico (evidência para A-04, sem tolerância aplicada)

Comparação da NF-e com a linha verdadeira do pedido, em ${linhasCertas.length} linhas.

**Preço unitário** (${qtdLinhasSemUnid} linhas de mesma unidade):

| Diferença | Linhas | % |
|---|---:|---:|
${['igual', 'ate R$ 0,01', 'ate 1%', 'de 1% a 5%', 'acima de 5%'].map((k) => `| ${k.replace('ate', 'até')} | ${fa[k] ?? 0} | ${pct(fa[k] ?? 0, qtdLinhasSemUnid)} |`).join('\n')}

Toda diferença é mostrada como divergência. Decidir a partir de quanto ela importa é de Compras e Fiscal; a faixa "até R$ 0,01" sozinha é ${pct(fa['ate R$ 0,01'] ?? 0, qtdLinhasSemUnid)} das linhas, então essa decisão muda muito o volume de alertas.

**Unidade:** a unidade da NF-e difere da do pedido em ${unidadeDiferente} linhas (${pct(unidadeDiferente, linhasCertas.length)}). Nessas linhas, a quantidade coincide com o saldo em ${unidDifQtdIgual} (${pct(unidDifQtdIgual, unidadeDiferente)}), o que sugere nomes diferentes para a mesma unidade, sem que isso esteja comprovado. Pares mais comuns (NF-e → pedido): ${paresUnidade.map(([k, v]) => `${k} (${v})`).join('; ')}. **O motor não converte nem trata como iguais:** sinaliza e não compara a quantidade (pendência A-16).

**Quantidade:** acima do saldo em ${qtdAcima} linhas; atendimento parcial (sobra saldo depois da nota) em ${itensParciais} linhas; ${parcialAntes} notas atenderam pedido que já tinha faturamento anterior.

## 7. Notas ambíguas: evidência para A-07, sem regra aplicada

Em ${P.ambiguos} notas ambíguas (mediana de ${P.mediana} candidatos, 90% com até ${P.p90}, máximo ${P.maximo}):

| Critério, se fosse adotado | Acerta |
|---|---:|
| Pedido mais recente | ${P.ambMaisRecenteCerto} (${pct(P.ambMaisRecenteCerto, P.ambiguos)}) |
| Pedido mais antigo | ${P.ambMaisAntigoCerto} (${pct(P.ambMaisAntigoCerto, P.ambiguos)}) |
| Único pedido que cobre todos os itens (existe em ${P.ambUnicoCobreTudo} notas) | ${P.ambUnicoCobreTudoCerto} (${pct(P.ambUnicoCobreTudoCerto, P.ambUnicoCobreTudo)}) |
| Primeiro da lista de apresentação | ${P.ambiguosPrimeiroCerto} (${pct(P.ambiguosPrimeiroCerto, P.ambiguos)}) |

Mesmo o melhor critério erraria. Por isso a nota continua ambígua até Compras aprovar uma regra (A-07).

## 8. Saldo oficial do pedido (evidência para V-05)

Em ${v05Total} itens de pedido: \`QTDENTREGUE\` é igual à soma de \`TGFVAR.QTDATENDIDA\` em ${v05Igual} (${pct2(v05Igual, v05Total)}); \`PENDENTE = 'S'\` sem saldo em ${v05PendSemSaldo}; \`PENDENTE = 'N'\` com saldo em ${v05NaoPendComSaldo} (corte de resíduo). A leitura usada pelo motor (\`QTDNEG - QTDENTREGUE\`, zerada quando \`PENDENTE = 'N'\`) é consistente com os dados, mas ainda precisa da confirmação de Compras e TI.

## 9. Limitações, sem as quais os números enganam

1. **O de-para de hoje pode ter sido criado por estas mesmas notas.** A \`TGFPAP\` não tem data. ${primeiraVez} de ${itensAlinhados.length} itens (${pct(primeiraVez, itensAlinhados.length)}) são a primeira ocorrência do par fornecedor-código no período, e esse é o teto do que poderia não estar cadastrado quando a nota chegou. O resultado real na chegada da nota fica entre o cenário principal e o pessimista, e **só a operação assistida vai medir isso** (V-20).
2. **O gabarito é o que a equipe fez**, que pode conter erro; não é uma verdade independente.
3. **O saldo foi reconstruído pela ordem de \`NUNOTA\`.** A data de corte de resíduo é desconhecida.
4. **Precisão não autoriza automação.** "Afirmou sem dúvida" significa que há um único pedido com saldo, não que a nota esteja certa: preço, unidade e quantidade continuam a ser divergências a conferir.
5. **Só o piloto foi medido.** Nada aqui vale para outras TOPs.

## 10. Ajustes feitos no motor durante a avaliação

| O que a avaliação mostrou | Ajuste |
|---|---|
| Três CNPJs pertencem a dois códigos de empresa (299+200, 300+399, 500+599); o mapeamento simples perdia 251 notas | O motor passou a usar o conjunto de empresas do CNPJ. Erro do mapeamento, não prática do grupo |
| \`REFERENCIA\` e GTIN erram muito (seção 4) | Retiradas |
| \`REFFORN\` erra ${pct(af.REFFORN.errado, af.REFFORN.total)} sozinha | Virou só sugestão, que não decide |
| Empate pelo pedido mais antigo acerta só ${pct(P.ambMaisAntigoCerto, P.ambiguos)} | A apresentação passou a mostrar primeiro o mais recente. Muda só a ordem de exibição |
`;
fs.writeFileSync(new URL('../../modulo-documental/relatorio-precisao-correspondencia.md', import.meta.url), relatorio);
console.log('relatorio gravado');
