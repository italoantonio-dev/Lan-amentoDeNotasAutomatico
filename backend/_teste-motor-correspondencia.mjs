// Casos de teste do motor de correspondencia NF-e x pedido. Offline: nao acessa ERP nem banco.
//   node _teste-motor-correspondencia.mjs
import { createRequire } from 'node:module';
import { conf, encerrar } from './lib/smoke.mjs';

const require = createRequire(import.meta.url);
const { conferir, identificarProduto } = require('./correspondencia/motor.cjs');

const EMPRESA = { CODEMP: 200, NOME: 'Empresa 200' };
const PARCEIROS = [{ CODPARC: 10, RAZAOSOCIAL: 'Fornecedor' }, { CODPARC: 11, RAZAOSOCIAL: 'Fornecedor filial' }];
const DEPARA = [
  { CODPARC: 10, CODPROPARC: 'ABC-1', CODPROD: 500 },
  { CODPARC: 10, CODPROPARC: 'XYZ-9', CODPROD: 600 },
  { CODPARC: 11, CODPROPARC: 'F11', CODPROD: 700 },
  { CODPARC: 10, CODPROPARC: 'DUP', CODPROD: 801 },
  { CODPARC: 10, CODPROPARC: 'DUP', CODPROD: 802 },
  { CODPARC: 99, CODPROPARC: 'OUTRO', CODPROD: 900 },
];
const REFS = [{ CODPROD: 650, REFFORN: 'RF-650', REFERENCIA: '7890000000017' }, { CODPROD: 501, REFFORN: 'ABC-1', REFERENCIA: '' }];
const item = (o) => ({ nItem: 1, cProd: 'ABC-1', quantidade: 10, unidade: 'UN', valorUnitario: 5, ...o });
const linha = (o) => ({ SEQUENCIA: 1, CODPROD: 500, QTDNEG: 10, QTDENTREGUE: 0, VLRUNIT: 5, CODVOL: 'UN', PENDENTE: 'S', ...o });
const pedido = (nu, itens, o = {}) => ({ NUNOTA: nu, NUMNOTA: nu - 1000, CODEMP: 200, CODPARC: 10, DTNEG: '2026-01-10', CODTIPOPER: 1314, itens, vinculos: [], ...o });
const rodar = (itens, pedidos, extra = {}) => conferir({ documento: { chave: '3'.repeat(44), numero: '123', cnpjEmitente: '11222333000181', cnpjDestinatario: '11444777000161', valorTotal: 50, itens }, empresa: EMPRESA, parceiros: PARCEIROS, dePara: DEPARA, referencias: REFS, pedidos, existentes: [], ...extra });

// 1. Pedido unico, tudo igual
let r = rodar([item()], [pedido(1001, [linha()])]);
conf('1 pedido unico sem divergencia', r.situacao === 'PEDIDO_UNICO' && r.itens[0].linhas[0].divergencias.length === 0 && r.pedidos[0].NUNOTA === 1001, r.situacao);
conf('1 mostra negociada, entregue e pendente', r.itens[0].linhas[0].negociada === 10 && r.itens[0].linhas[0].entregue === 0 && r.itens[0].linhas[0].pendente === 10 && r.itens[0].linhas[0].saldoAposDocumento === 0);
conf('1 resultado declara somente leitura', r.somenteLeitura === true);

// 2. Faturamento parcial ja ocorrido e saldo apos a nota
r = rodar([item({ quantidade: 3 })], [pedido(1002, [linha({ QTDENTREGUE: 4 })], { vinculos: [{ NUNOTA: 5000, NUMNOTA: 77, CODTIPOPER: 1419, STATUSNOTA: 'L', SEQUENCIAORIG: 1, QTDATENDIDA: 4 }] })]);
const l2 = r.itens[0].linhas[0];
conf('2 faturamento parcial: pendente = negociada - entregue', l2.pendente === 6 && l2.saldoAposDocumento === 3, `${l2.pendente} / ${l2.saldoAposDocumento}`);
conf('2 pedido marcado como ja faturado parcialmente, com o vinculo', r.pedidos[0].jaFaturadoParcialmente && r.pedidos[0].vinculos[0].NUNOTA === 5000 && r.pedidos[0].vinculos[0].QTDATENDIDA === 4);

// 3. Preco: qualquer diferenca e divergencia, com o valor
r = rodar([item({ valorUnitario: 5.01 })], [pedido(1003, [linha()])]);
const l3 = r.itens[0].linhas[0];
conf('3 R$ 0,01 de diferenca ja e divergencia (sem tolerancia)', l3.divergencias.includes('PRECO_DIFERENTE') && l3.diferencaPreco === 0.01 && l3.diferencaPrecoPct === 0.2, JSON.stringify([l3.diferencaPreco, l3.diferencaPrecoPct]));
conf('3 situacao continua PEDIDO_UNICO; divergencia nao muda o pedido', r.situacao === 'PEDIDO_UNICO' && /divergência/.test(r.resumo));
r = rodar([item({ valorUnitario: 5.0000000001 })], [pedido(1003, [linha()])]);
conf('3 resto de ponto flutuante nao vira divergencia', r.itens[0].linhas[0].divergencias.length === 0);

// 4. Quantidade acima do pendente
r = rodar([item({ quantidade: 12 })], [pedido(1004, [linha()])]);
conf('4 quantidade acima do pendente', r.itens[0].linhas[0].divergencias.includes('QUANTIDADE_ACIMA_DO_PENDENTE') && r.itens[0].saldoSuficienteEm.length === 0);

// 5. Unidade diferente: nao converte e nao compara quantidade
r = rodar([item({ unidade: 'CX', quantidade: 1 })], [pedido(1005, [linha()])]);
const l5 = r.itens[0].linhas[0];
conf('5 unidade diferente sinalizada, sem conversao inventada', l5.divergencias.includes('UNIDADE_DIFERENTE') && !l5.divergencias.includes('QUANTIDADE_ACIMA_DO_PENDENTE') && l5.saldoAposDocumento === null);

// 6. Dois pedidos com o mesmo produto: ambiguo, o motor nao escolhe
r = rodar([item({ quantidade: 4 })], [pedido(1010, [linha({ QTDNEG: 4 })]), pedido(1011, [linha({ QTDNEG: 20 })])]);
conf('6 dois pedidos servem: AMBIGUO com os dois candidatos', r.situacao === 'AMBIGUO' && r.itens[0].pedidos.length === 2 && r.pedidos.length === 2, r.situacao);
conf('6 ordem de apresentacao explicada por contagens', r.pedidos[0].itensComQuantidadeIgualAoPendente === 1 && r.pedidos[0].NUNOTA === 1010);

// 7. Itens em pedidos diferentes, cada um com um so pedido
r = rodar([item(), item({ nItem: 2, cProd: 'XYZ-9', quantidade: 1 })], [pedido(1020, [linha()]), pedido(1021, [linha({ CODPROD: 600, QTDNEG: 1 })])]);
conf('7 cada item com um pedido diferente: MULTIPLOS_PEDIDOS', r.situacao === 'MULTIPLOS_PEDIDOS' && r.pedidos.length === 2, r.situacao);

// 8. Produto nao identificado
r = rodar([item({ cProd: 'NAO-EXISTE' })], [pedido(1030, [linha()])]);
conf('8 sem de-para: PRODUTOS_NAO_IDENTIFICADOS, sem palpite por descricao', r.situacao === 'PRODUTOS_NAO_IDENTIFICADOS' && r.itens[0].situacao === 'PRODUTO_NAO_IDENTIFICADO' && r.pedidos.length === 0);

// 9. Parte dos itens com pedido
r = rodar([item(), item({ nItem: 2, cProd: 'XYZ-9' })], [pedido(1040, [linha()])]);
conf('9 um item com pedido e outro sem: PARCIAL', r.situacao === 'PARCIAL' && r.itens[1].situacao === 'SEM_PEDIDO', r.situacao);

// 10. Saldo so em outra empresa
r = rodar([item()], [pedido(1050, [linha()], { CODEMP: 300 })]);
conf('10 pedido de outra empresa nao e candidato, mas vira alerta', r.situacao === 'SEM_PEDIDO' && r.alertas.some((a) => a.tipo === 'PEDIDO_EM_OUTRA_EMPRESA'), r.situacao);

// 11. Pedido de outro fornecedor e ignorado
r = rodar([item()], [pedido(1060, [linha()], { CODPARC: 55 })]);
conf('11 pedido de outro fornecedor e ignorado', r.situacao === 'SEM_PEDIDO');

// 12. Item cortado (PENDENTE = N) ou ja atendido nao e candidato
r = rodar([item()], [pedido(1070, [linha({ PENDENTE: 'N', QTDENTREGUE: 2 })]), pedido(1071, [linha({ QTDENTREGUE: 10 })])]);
conf('12 item nao pendente ou sem saldo nao e candidato', r.situacao === 'SEM_PEDIDO');

// 13. Duplicidade nao esconde a analise
r = rodar([item()], [pedido(1080, [linha()])], { existentes: [{ NUNOTA: 9001, NUMNOTA: 123, CODTIPOPER: 1419, STATUSNOTA: 'L', MOTIVO: 'CHAVE' }, { NUNOTA: null, MOTIVO: 'PORTAL' }] });
conf('13 duplicidade vira alerta e a analise continua', r.duplicidade.length === 2 && r.alertas.some((a) => a.tipo === 'JA_EXISTE_NO_ERP' && /9001/.test(a.mensagem) && /sem nota gerada/.test(a.mensagem)) && r.situacao === 'PEDIDO_UNICO');

// 14. Mesmo CNPJ em dois parceiros
r = rodar([item({ cProd: 'F11' })], [pedido(1090, [linha({ CODPROD: 700 })], { CODPARC: 11 })]);
conf('14 parceiro com o mesmo CNPJ e considerado', r.situacao === 'PEDIDO_UNICO' && r.itens[0].identificacao.fonte === 'TGFPAP');

// 15. Fontes de identificacao
const id = (i) => identificarProduto(i, [10, 11], DEPARA, REFS);
conf('15 de-para do Sankhya vem antes da referencia', id({ cProd: 'ABC-1' }).codprods.join() === '500' && id({ cProd: 'ABC-1' }).fonte === 'TGFPAP');
conf('15 referencia do fornecedor quando nao ha de-para', id({ cProd: 'RF-650' }).fonte === 'REFFORN' && id({ cProd: 'RF-650' }).codprods.join() === '650');
conf('15 GTIN contra a referencia do produto', id({ cProd: '', cEAN: '7890000000017' }).fonte === 'GTIN');
conf('15 GTIN "SEM GTIN" nao identifica', id({ cProd: '', cEAN: 'SEM GTIN' }).situacao === 'NAO_IDENTIFICADO');
conf('15 de-para de outro parceiro nao vale', id({ cProd: 'OUTRO' }).situacao === 'NAO_IDENTIFICADO');
conf('15 codigo com dois produtos: AMBIGUO', id({ cProd: 'DUP' }).situacao === 'AMBIGUO' && id({ cProd: 'DUP' }).codprods.length === 2);
conf('15 caixa e espacos nas pontas nao atrapalham', id({ cProd: '  abc-1 ' }).codprods.join() === '500');
conf('15 zero a esquerda nao e removido (regra nao inventada)', id({ cProd: '0ABC-1' }).situacao === 'NAO_IDENTIFICADO');
conf('15 produto informado por uma pessoa vale', id({ codprod: 42 }).fonte === 'INFORMADO');

// 16. Sem empresa / sem fornecedor
r = conferir({ documento: { itens: [item()] }, empresa: null, parceiros: PARCEIROS, pedidos: [] });
conf('16 sem empresa para antes de comparar', r.situacao === 'SEM_EMPRESA');
r = conferir({ documento: { itens: [item()] }, empresa: EMPRESA, parceiros: [], pedidos: [] });
conf('16 sem fornecedor para antes de comparar', r.situacao === 'SEM_FORNECEDOR');

// 17. Duas linhas do mesmo produto no mesmo pedido
r = rodar([item({ quantidade: 15 })], [pedido(1100, [linha(), linha({ SEQUENCIA: 2, QTDNEG: 8 })])]);
conf('17 duas linhas no mesmo pedido: PEDIDO_UNICO com as duas linhas e saldo somado', r.situacao === 'PEDIDO_UNICO' && r.itens[0].linhas.length === 2 && r.itens[0].saldoSuficienteEm.join() === '1100');

// 18. Pedido com outros itens ainda pendentes
r = rodar([item()], [pedido(1110, [linha(), linha({ SEQUENCIA: 2, CODPROD: 999 })])]);
conf('18 itens do pedido fora da nota ficam contados', r.pedidos[0].itensPendentesForaDoDocumento === 1);

// 19. Deterministico e sem efeito na entrada
const entrada = { documento: { itens: [item()] }, empresa: EMPRESA, parceiros: PARCEIROS, dePara: DEPARA, referencias: REFS, pedidos: [pedido(1120, [linha()])], existentes: [] };
const copia = JSON.stringify(entrada);
const a1 = JSON.stringify(conferir(entrada));
conf('19 mesma entrada, mesma saida; entrada intacta', a1 === JSON.stringify(conferir(entrada)) && copia === JSON.stringify(entrada));

encerrar('Motor de correspondencia');
