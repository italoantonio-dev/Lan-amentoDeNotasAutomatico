// Validacao retrospectiva da classificacao do motor (SEGURA, AMBIGUA, INCOMPATIVEL, SEM_PEDIDO).
// Somente leitura no Sankhya, pelo cache da avaliacao. O gabarito (TGFVAR da propria nota) nunca entra
// no motor: so pedidos anteriores a nota e saldo descontado das notas anteriores.
// Separacao: desenvolvimento = notas ate 30/06/2026; validacao = de 01/07/2026 em diante. As regras de
// classificacao foram escritas antes de rodar; um ajuste foi feito depois, descrito no relatorio.
//   cd backend && node correspondencia/validar-classificacao.mjs
import fs from 'node:fs';
import { carregarHistorico, PILOTO } from './historico.mjs';
import { registro } from '../auditoria/leitura.mjs';
import { montarAvaliador, num, conta } from './reconstrucao.mjs';

const CORTE = '2026-07-01';
const h = await carregarHistorico();
const { avaliar } = montarAvaliador(h);
const cenarios = {
  principal: avaliar(),
  pessimista: avaliar({ deParaPessimista: true }),
  otimista: avaliar({ cortadosComoFechados: true }),
};
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1).replace('.', ',')}%` : '—');
const mesmo = (a, b) => a.length === b.length && [...a].sort((x, y) => x - y).every((x, i) => x === [...b].sort((p, q) => p - q)[i]);
const quantil = (v, q) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };

function medir(casos) {
  const ok = casos.filter((c) => !c.semXml);
  const com = ok.filter((c) => c.T.length);
  const sem = ok.filter((c) => !c.T.length);
  const cl = (lista, k) => lista.filter((c) => c.r.classificacao === k);
  const seguras = cl(com, 'SEGURA');
  const certas = seguras.filter((c) => mesmo(c.C, c.T));
  const motivo = (k) => conta(ok, (c) => c.r.intervencaoHumana.some((m) => m.codigo === k));
  const soPrecoUnidade = cl(com, 'INCOMPATIVEL').filter((c) => c.r.intervencaoHumana.every((m) => ['CONFERIR_PRECO', 'CONFERIR_UNIDADE'].includes(m.codigo)));
  const itensRef = ok.flatMap((c) => c.itens.filter((x) => x.it.referenciaPedido && x.origens.length));
  return {
    notas: ok.length, semXml: casos.length - ok.length, comGabarito: com.length, semGabarito: sem.length,
    classes: Object.fromEntries(['SEGURA', 'AMBIGUA', 'INCOMPATIVEL', 'SEM_PEDIDO'].map((k) => [k, cl(com, k).length])),
    seguras: seguras.length, segurasCertas: certas.length, falsas: seguras.length - certas.length,
    falsasSemGabarito: cl(sem, 'SEGURA').length,
    naoEncontrados: conta(com, (c) => !c.T.every((t) => c.C.includes(t))),
    ambiguasComGabarito: conta(cl(com, 'AMBIGUA'), (c) => c.T.every((t) => c.C.includes(t))),
    precoDivergente: motivo('CONFERIR_PRECO'), quantidadeDivergente: motivo('CONFERIR_QUANTIDADE'), unidadeDivergente: motivo('CONFERIR_UNIDADE'),
    duplicidade: motivo('CONFERIR_DUPLICIDADE'), produtoNaoIdentificado: motivo('IDENTIFICAR_PRODUTO'),
    soPrecoOuUnidade: soPrecoUnidade.length,
    referencia: { itens: itensRef.length, confereComGabarito: conta(itensRef, (x) => x.it.referenciaPedido.confereCom.some((p) => x.origens.includes(p))) },
    msMediana: quantil(ok.map((c) => c.ms), 0.5), msP95: quantil(ok.map((c) => c.ms), 0.95), msMax: quantil(ok.map((c) => c.ms), 1),
    falsasLista: seguras.filter((c) => !mesmo(c.C, c.T)).map((c) => ({ nota: c.nu, motor: c.C, vinculo: c.T, pedidoDepoisDaNota: c.T.every((t) => t > c.nu) })),
  };
}
const R = {};
for (const [k, casos] of Object.entries(cenarios)) {
  R[k] = { dev: medir(casos.filter((c) => c.dtneg < CORTE)), val: medir(casos.filter((c) => c.dtneg >= CORTE)) };
}
const v = R.principal;
const linha = (nome, f) => `| ${nome} | ${f(v.dev)} | ${f(v.val)} |`;
const md = `# Validação retrospectiva da classificação do motor

Gerado por \`backend/correspondencia/validar-classificacao.mjs\` em ${new Date().toISOString().slice(0, 10)}. Somente leitura no Sankhya (${registro.length} consultas registradas, a partir do cache). Piloto: pedido TOP ${PILOTO.topPedido.join(', ')} → notas TOP ${PILOTO.topNota.join('/')}.

**Desenvolvimento:** notas de 01/11/2025 a 30/06/2026. **Validação:** notas de 01/07/2026 a 31/10/2026. As regras foram escritas antes de rodar. Houve **um ajuste depois da primeira rodada**: a referência de pedido do XML deixou de rebaixar a nota, porque quase nunca coincide com o pedido do vínculo (1 de 7.076 itens em desenvolvimento). Os números de validação daquela rodada estavam visíveis no mesmo momento, então a validação não é totalmente cega a esse ajuste; ele só retira uma regra. O vínculo da própria nota (TGFVAR) nunca entra no motor; ele só é usado depois, como gabarito.

## Resultado (cenário principal: de-para de hoje, item cortado segue pendente)

| Medida | Desenvolvimento | Validação |
|---|---:|---:|
${linha('Notas avaliadas (com XML)', (m) => m.notas)}
${linha('Com vínculo conhecido (gabarito)', (m) => m.comGabarito)}
${linha('**Correspondência segura** (cobertura da automação)', (m) => `${m.seguras} (${pct(m.seguras, m.comGabarito)})`)}
${linha('**Precisão das seguras**', (m) => `${m.segurasCertas} de ${m.seguras} (${pct(m.segurasCertas, m.seguras)})`)}
${linha('**Falsas correspondências** (segura com pedido errado)', (m) => m.falsas)}
${linha('Segura em nota sem vínculo com pedido', (m) => `${m.falsasSemGabarito} de ${m.semGabarito}`)}
${linha('Ambíguas', (m) => `${m.classes.AMBIGUA} (${pct(m.classes.AMBIGUA, m.comGabarito)})`)}
${linha('Ambíguas com o pedido certo entre os candidatos', (m) => pct(m.ambiguasComGabarito, m.classes.AMBIGUA))}
${linha('Incompatíveis', (m) => `${m.classes.INCOMPATIVEL} (${pct(m.classes.INCOMPATIVEL, m.comGabarito)})`)}
${linha('… só por preço ou unidade (sem tolerância aprovada)', (m) => m.soPrecoOuUnidade)}
${linha('Sem pedido', (m) => m.classes.SEM_PEDIDO)}
${linha('Pedido verdadeiro não encontrado entre os candidatos', (m) => `${m.naoEncontrados} (${pct(m.naoEncontrados, m.comGabarito)})`)}
${linha('Notas com divergência de preço', (m) => m.precoDivergente)}
${linha('Notas com quantidade acima do saldo', (m) => m.quantidadeDivergente)}
${linha('Notas com unidade diferente', (m) => m.unidadeDivergente)}
${linha('Notas com produto não identificado', (m) => m.produtoNaoIdentificado)}
${linha('Itens com referência de pedido no XML; confere com o vínculo', (m) => `${m.referencia.itens}; ${m.referencia.confereComGabarito} (${pct(m.referencia.confereComGabarito, m.referencia.itens)})`)}
${linha('Tempo do motor por nota: mediana / p95 / máximo (ms)', (m) => `${m.msMediana.toFixed(2)} / ${m.msP95.toFixed(2)} / ${m.msMax.toFixed(1)}`)}

Falsas correspondências: ${[...v.dev.falsasLista, ...v.val.falsasLista].map((f) => `nota ${f.nota}: motor ${f.motor.join(',')}, vínculo ${f.vinculo.join(',')}${f.pedidoDepoisDaNota ? ' (pedido do vínculo criado depois da nota)' : ''}`).join('; ') || 'nenhuma'}.

## Cenários de sensibilidade (validação)

| Cenário | Seguras | Precisão | Falsas | Ambíguas | Não encontrados |
|---|---:|---:|---:|---:|---:|
${Object.entries(R).map(([k, x]) => `| ${({ principal: 'Principal', pessimista: 'De-para pessimista (só par já visto antes da nota)', otimista: 'Item cortado já fechado' })[k]} | ${x.val.seguras} (${pct(x.val.seguras, x.val.comGabarito)}) | ${pct(x.val.segurasCertas, x.val.seguras)} | ${x.val.falsas} | ${x.val.classes.AMBIGUA} | ${x.val.naoEncontrados} |`).join('\n')}

## Vazamento de informação: o que foi reconstruído e o que não foi

| Informação | Na data da nota? | Como |
|---|---|---|
| Vínculo da própria nota | Não entra no motor | Só gabarito |
| Pedidos existentes | Sim | Só pedidos com NUNOTA menor que o da nota |
| Quantidade entregue | Sim | Soma das notas anteriores na TGFVAR |
| De-para (TGFPAP) | **Não** | A tabela não tem data. O cenário pessimista é o piso |
| Corte de resíduo do item | **Não** | Data desconhecida. Os cenários principal e otimista são os limites |
| Preço e unidade do item do pedido | **Não** | Valor de hoje (TGFITE); pode ter sido editado depois da nota |
| Cadastro do parceiro (ativo, CNPJ) | **Não** | Situação de hoje |
| Duplicidade | Não avaliada | A própria nota já existe no ERP hoje |

**Por isso esta avaliação não é uma simulação fiel do passado.** Ela mede o motor sobre os documentos reais com o melhor estado reconstruível; o resultado na chegada real das notas fica entre o cenário pessimista e o principal, e só a operação assistida (conferir as notas novas na chegada) mede o valor real.
`;
fs.writeFileSync(new URL('../../modulo-documental/validacao-classificacao.md', import.meta.url), md);
console.log(JSON.stringify(Object.fromEntries(Object.entries(R).map(([k, x]) => [k, { dev: { ...x.dev, falsasLista: x.dev.falsasLista.length }, val: { ...x.val, falsasLista: x.val.falsasLista.length } }])), null, 0).slice(0, 4000));
