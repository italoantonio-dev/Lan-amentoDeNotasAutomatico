# Evidências técnicas — módulo de entrada de documentos

Somente leitura no Oracle do Sankhya (trava de SELECT/WITH). Período: DTNEG de 2025-11-01 a 2026-10-31. Empresas: 200,300,100,201,301,302,400,500,202,203,501,700,600. Cada número entre colchetes é uma consulta em `registro-consultas.md`.

## 1. Estruturas confirmadas no dicionário do Oracle

- **TGFVAR** (vínculo entre item de origem e item gerado): CUSATEND, FIXACAO, NROATOCONCDRAW, NROMEMORANDO, NROREGEXPORT, NUNOTA, NUNOTAORIG, ORDEMPROD, QTDATENDIDA, SEQUENCIA, SEQUENCIAORIG, STATUSNOTA.
- **TGFITE**, colunas de atendimento: QTDNEG, QTDENTREGUE, QTDFAT, PENDENTE, FATURAR, NUMPEDIDO, SEQPEDIDO, STATUSNOTA.
- **TGFCAB**, colunas de situação: STATUSNOTA, PENDENTE, APROVADO, CONFIRMNOTAFAT, DTFATUR, SEQCONFIRMA, CODUSUINC, CODUSUCOMPRADOR.
- **TGFTOP**, colunas que parecem tratar pedido, tolerância e confirmação (o significado exato precisa ser confirmado com a TI/Sankhya): TIPMOV, ATIVO, EXIGECONF, EXIGELIB, EXIGECOTACAO, PERCTOLVARQTD, PERCTOLVARVLRUNIT, VALVARIACVLRUNIT, DESCONSIDPEDXML, PENDENTE, TEMFINORIGEM, ATUALFIN, ATUALEST.

## 2. Pedidos de compra [A006]

| Empresa | Pedidos no período | Valor | Ainda pendentes |
|---|---:|---:|---:|
| 100 | 997 | R$ 4.224.109 | 293 |
| 200 | 3440 | R$ 95.365.716 | 968 |
| 201 | 1116 | R$ 3.874.601 | 373 |
| 202 | 708 | R$ 2.560.709 | 207 |
| 203 | 514 | R$ 1.132.841 | 197 |
| 300 | 1101 | R$ 25.967.991 | 280 |
| 301 | 1126 | R$ 2.767.291 | 402 |
| 302 | 691 | R$ 9.951.015 | 183 |
| 400 | 695 | R$ 10.750.707 | 200 |
| 500 | 704 | R$ 4.107.016 | 230 |
| 501 | 237 | R$ 1.512.184 | 89 |
| 600 | 65 | R$ 446.179 | 18 |
| 700 | 84 | R$ 408.793 | 10 |

Pedidos pendentes hoje, qualquer data [A013]: 200: 1409; 201: 501; 301: 489; 300: 409; 100: 386; 500: 324; 202: 306; 400: 259; 203: 252; 302: 226; 501: 123; 700: 31; 600: 22.

## 3. Notas de compra que vieram de pedido [A007]

| TOP da nota | Notas | Vieram de pedido | % | Com chave NF-e |
|---|---:|---:|---:|---:|
| 1414 COMPRA - CT-E | 3369 | 28 | 0.8% | 0 |
| 1404 COMPRA - SERVICO (SEM RETENCAO) | 3105 | 1414 | 45.5% | 1 |
| 1403 COMPRA - USO/CONSUMO | 2403 | 458 | 19.1% | 2395 |
| 1452 TRANSFERENCIA ENTRE FILIAIS - ENTRADA | 2040 | 0 | 0% | 2038 |
| 1419 COMPRA - REVENDA PECAS | 1280 | 1276 | 99.7% | 1280 |
| 1426 COMPRA - PECAS ENTRE LOJAS/ SEM PEDIDO | 1102 | 0 | 0% | 1102 |
| 1420 COMPRA C/ ST FRONT - REVENDA PECAS | 967 | 966 | 99.9% | 967 |
| 1405 COMPRA - SERVICOS (COM RETENCAO) | 941 | 517 | 54.9% | 0 |
| 1401 COMPRA - REVENDA MAQUINARIO | 705 | 694 | 98.4% | 696 |
| 1454 ENTRADA PARA DEMONSTRACAO | 567 | 0 | 0% | 566 |
| 1160 RETORNO PARA DEMONSTRACAO- NF TERCEIROS | 535 | 0 | 0% | 535 |
| 1412 COMPRA - CT-E ( COM  PEDIDO ) | 478 | 478 | 100% | 0 |
| 1425 COMPRA - MAQUINARIO ENTRE LOJAS/ SEM PEDIDO | 337 | 0 | 0% | 337 |
| 11 LANCAMENTOS FINANCEIROS | 269 | 265 | 98.5% | 0 |
| 1409 COMPRA - ENERGIA ELETRICA | 160 | 109 | 68.1% | 0 |
| 1410 COMPRA - TELECOMUNICACOES | 143 | 92 | 64.3% | 0 |
| 1424 COMPRA - MAQUINARIO USADO/ SEM PEDIDO | 100 | 0 | 0% | 100 |
| 1191 DESPESAS DE FOLHA | 71 | 51 | 71.8% | 0 |
| 1458 SIMPLES REMESSA (OUTRAS) - ENTRADA | 64 | 0 | 0% | 64 |
| 1451 ENTRADA  DE BONIFICACAO PARA REVENDA C/ESTOQUE | 55 | 0 | 0% | 55 |

## 4. TOP do pedido → TOP da nota [A008]

| TOP do pedido | TOP da nota | Notas |
|---|---|---:|
| 1314 | 1419 | 1274 |
| 1304 | 1404 | 1197 |
| 1314 | 1420 | 964 |
| 1301 | 1401 | 694 |
| 1304 | 1412 | 478 |
| 1302 | 1403 | 457 |
| 1304 | 1405 | 412 |
| 1304 | 11 | 265 |
| 1302 | 1404 | 174 |
| 1309 | 1409 | 95 |
| 1302 | 1405 | 93 |
| 1304 | 1410 | 79 |
| 1304 | 1191 | 51 |
| 1300 | 1404 | 42 |
| 1304 | 1414 | 28 |
| 1301 | 1413 | 21 |
| 1301 | 1956 | 19 |
| 1302 | 1410 | 13 |
| 1300 | 1405 | 12 |
| 1304 | 1409 | 9 |
| 1302 | 1409 | 5 |
| 2001 | 1419 | 2 |
| 2001 | 1420 | 2 |
| 1304 | 1403 | 1 |
| 1302 | 1406 | 1 |

## 5. Divergência entre pedido e nota faturada [A009]

18307 itens em 6389 notas faturadas a partir de pedido: preço unitário diferente em mais de 1% em 1631 (8.9%); unidade diferente em 45; produto diferente em 0; atendimento parcial (quantidade atendida menor que a pedida) em 308 (1.7%).

## 6. Situação da nota e provisão financeira [A010] [A011]

| STATUSNOTA | Notas (compras e pedidos) | Com título | Títulos de provisão | Títulos reais |
|---|---:|---:|---:|---:|
| A | 270 | 215 | 224 | 0 |
| L | 30173 | 26352 | 12311 | 19765 |
| P | 12 | 3 | 3 | 0 |

Por movimento: C/L: 18931; C/A: 34; C/P: 12; O/L: 11242; O/A: 236.

> Leitura, não teste: os dados mostram como o ambiente está hoje. Que salvar sem confirmar gera provisão e que a confirmação gera o título real é **hipótese consistente com os números**, a validar por TOP em homologação.

## 7. Configuração das TOPs de pedido e de compra [A012]

Valores brutos, sem interpretação.

| TOP | TIPMOV | ATIVO | EXIGECONF | EXIGELIB | EXIGECOTACAO | PERCTOLVARQTD | PERCTOLVARVLRUNIT | VALVARIACVLRUNIT | DESCONSIDPEDXML | PENDENTE | TEMFINORIGEM | ATUALFIN | ATUALEST |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11 LANCAMENTOS FINANCEIROS | C | S | N | N | N | — | — | N | — | N | N | -1 | N |
| 1160 RETORNO PARA DEMONSTRACAO- NF TERCEIROS | C | S | N | N | N | — | — | N | — | N | N | 0 | E |
| 1191 DESPESAS DE FOLHA | C | S | N | N | N | — | — | N | — | N | N | -1 | N |
| 1401 COMPRA - REVENDA MAQUINARIO | C | S | N | N | S | — | — | N | — | N | N | -1 | E |
| 1403 COMPRA - USO/CONSUMO | C | S | N | N | S | — | — | N | — | N | N | -1 | N |
| 1404 COMPRA - SERVICO (SEM RETENCAO) | C | S | N | N | N | — | — | N | — | N | N | -1 | N |
| 1405 COMPRA - SERVICOS (COM RETENCAO) | C | S | N | N | N | — | — | N | — | N | N | -1 | N |
| 1409 COMPRA - ENERGIA ELETRICA | C | S | N | N | N | — | — | N | — | N | N | -1 | N |
| 1410 COMPRA - TELECOMUNICACOES | C | S | N | N | N | — | — | N | — | N | N | -1 | N |
| 1412 COMPRA - CT-E ( COM  PEDIDO ) | C | S | N | N | S | — | — | N | — | N | N | -1 | N |
| 1414 COMPRA - CT-E | C | S | N | N | N | — | — | N | — | N | N | -1 | N |
| 1419 COMPRA - REVENDA PECAS | C | S | N | N | S | — | — | N | — | N | N | -1 | E |
| 1420 COMPRA C/ ST FRONT - REVENDA PECAS | C | S | N | N | S | — | — | N | — | N | N | -1 | E |
| 1424 COMPRA - MAQUINARIO USADO/ SEM PEDIDO | C | S | N | N | N | — | — | N | — | N | N | -1 | E |
| 1425 COMPRA - MAQUINARIO ENTRE LOJAS/ SEM PEDIDO | C | S | N | N | N | — | — | N | — | N | N | -1 | E |
| 1426 COMPRA - PECAS ENTRE LOJAS/ SEM PEDIDO | C | S | N | N | N | — | — | N | — | N | N | -1 | E |
| 1451 ENTRADA  DE BONIFICACAO PARA REVENDA C/ESTOQUE | C | S | N | N | N | — | — | N | — | N | N | 0 | E |
| 1452 TRANSFERENCIA ENTRE FILIAIS - ENTRADA | C | S | N | N | N | — | — | N | — | N | N | 0 | E |
| 1454 ENTRADA PARA DEMONSTRACAO | C | S | N | N | N | — | — | N | — | S | N | 0 | N |
| 1458 SIMPLES REMESSA (OUTRAS) - ENTRADA | C | S | N | N | N | — | — | N | — | N | N | 0 | N |
| 1300 SOLICITAÇÃO DE COMPRA | O | S | N | N | N | — | — | N | — | S | N | 0 | N |
| 1301 PEDIDO DE COMPRA - REVENDA MAQUINAS/ IMPLEMENTOS | O | S | N | N | N | — | — | N | — | S | N | -1 | N |
| 1302 PEDIDO DE COMPRA - USO/CONSUMO | O | S | N | N | N | — | — | N | — | S | N | -1 | N |
| 1304 PEDIDO DE COMPRA - SERVICO DIVERSOS | O | S | N | N | N | — | — | N | — | S | N | -1 | N |
| 1309 PEDIDO DE COMPRA - ENERGIA ELÉTRICA | O | S | N | N | N | — | — | N | — | S | N | -1 | N |
| 1314 PEDIDO DE COMPRA - REVENDA PECAS | O | S | N | N | N | — | — | N | — | S | N | -1 | N |
| 2001 PEDIDO DE COMPRA - PECAS | O | S | N | N | N | — | — | N | — | S | N | -1 | N |