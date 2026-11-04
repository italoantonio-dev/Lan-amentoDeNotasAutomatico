# Levantamento para os parâmetros de lançamento

Gerado em 2026-11-04 a partir do uso real no ERP nos últimos 12 meses (somente leitura). Para atualizar: `cd backend && node levantamento-parametros.mjs`.

## Como ler
- **Sugestão** é o que a empresa mais praticou, com a contagem que a sustenta. Quem decide é o financeiro ou a contabilidade.
- **Limite de aprovação** não vem do ERP: nenhum usuário do Sankhya tem alçada cadastrada. A tabela de valores mostra quanto dos documentos lançaria sozinho em cada faixa (mediana = metade dos documentos abaixo; P80 = 80% abaixo; e assim por diante).
- **Nota de entrada usa várias TOPs** (serviço, uso e consumo, revenda...). O parâmetro guarda uma TOP padrão; quando a compra for de outro tipo, corrija a classificação no lançamento.
- Preencha a coluna `LIMITE_APROVACAO_DECIDIDO` do CSV (e o `APROVADO_POR`) e devolva: os parâmetros podem ser cadastrados em lote a partir dela.


## 200 · OLIMAQUINAS SOLUCOES PATROCINIO
13429 títulos de despesa em 12 meses.

### Nota Fiscal de Entrada
- **TOP:** 1403 COMPRA - USO/CONSUMO — TOP de compra de fornecedor mais usada (fora CT-e, transferência e devolução)
- Outras TOPs usadas: 1414 COMPRA - CT-E (1001); 1452 TRANSFERENCIA ENTRE FILIAIS - ENTRADA (613); 1405 COMPRA - SERVICOS (COM RETENCAO) (520); 1404 COMPRA - SERVICO (SEM RETENCAO) (374); 1419 COMPRA - REVENDA PECAS (342)
- **Natureza:** 1052000 MATERIAIS DE USO E CONSUMO (137 de 670, 20%); 1051800 DESPESA OFICINA A RECUPERAR (111 de 670, 17%); 1051900 MATERIAIS DE USO NA OFICINA (58 de 670, 9%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 104200 SERVIÇOS OLIMÁQUINAS SOLUÇÕES PATROCÍNIO (141 de 670, 21%); 101200 COM. MAQ. NOVAS  OLIMÁQUINAS SOLUÇÕES PATROCINIO (92 de 670, 14%); 105200 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES PATROCINIO (80 de 670, 12%)
- **Tipo de título:** 4 BOLETO (478 de 670, 71%); 34 TED (132 de 670, 20%); 2 DINHEIRO (36 de 670, 5%)
- **Produto padrão (candidatos):** 42 MATERIAL DE USO CONSUMO ST (1876 itens); 43 MATERIAL DE USO CONSUMO TRIBUTADO (780 itens); 308433 MANGUEIRA UNIVERSAL # 10 (1/2 INCH) PARKER (2 itens)
- **Valores (605 notas):** mediana R$ 459 · P80 R$ 2.276 · P90 R$ 4.335 · P95 R$ 5.994 · maior R$ 104.000

### Boleto
- **TOP:** 1112 LANCAMENTOS FINANCEIROS — TOP financeira mais usada fora de tributos e adiantamentos
- Outras TOPs usadas: 1601 DESPESAS BANCÁRIAS (258); 1607 LANCAMENTO FINANCEIRO - CT-E (230); 1600 DESPESAS DIVERSAS (97)
- **Natureza:** 1101000 CONSORCIO (118 de 740, 16%); 1070500 MULTA / INFRACOES DE TRANSITO (112 de 740, 15%); 1070200 MANUTENCAO DE VEICULOS LEVE (79 de 740, 11%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105200 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES PATROCINIO (230 de 740, 31%); 101200 COM. MAQ. NOVAS  OLIMÁQUINAS SOLUÇÕES PATROCINIO (134 de 740, 18%); 206001 DIRETORIA GERAL (69 de 740, 9%)
- **Conta bancária:** 23 BRD - OLIMAQUINAS SOLUÇÕES (643 de 740, 87%); 26 SCB - OLIMAQUINAS SOLUÇÕES (48 de 740, 6%); 10 CX. OLIMAQ. SOL. PATROC (25 de 740, 3%)
- **Tipo de título:** 4 BOLETO (489 de 740, 66%); 34 TED (177 de 740, 24%); 6 DEBITO AUTOMATICO (45 de 740, 6%)
- **Valores (740 títulos):** mediana R$ 639 · P80 R$ 4.125 · P90 R$ 9.121 · P95 R$ 30.000 · maior R$ 207.240

### Guia de Imposto
- **TOP:** 1609 DESPESAS DE TRIBUTOS — TOP financeira de tributos mais usada
- **Natureza:** 1031000 ICMS ST (117 de 214, 55%); 1030400 ISSQN (24 de 214, 11%); 1052700 IR RETIDO SERVICOS (11 de 214, 5%)
- **Centro de resultado:** 103200 PEÇAS OLIMÁQUINAS SOLUÇÕES PATROCÍNIO (140 de 214, 65%); 105200 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES PATROCINIO (42 de 214, 20%); 104200 SERVIÇOS OLIMÁQUINAS SOLUÇÕES PATROCÍNIO (24 de 214, 11%)
- **Conta bancária:** 23 BRD - OLIMAQUINAS SOLUÇÕES (179 de 214, 84%); 17 BB - OLIMAQUINAS SOLUÇÕES (35 de 214, 16%)
- **Tipo de título:** 47 GNRE - ICMS ST (91 de 214, 43%); 39 DARF C? BARRA (56 de 214, 26%); 37 DAE (42 de 214, 20%)
- **Valores (214 títulos):** mediana R$ 1.126 · P80 R$ 10.363 · P90 R$ 27.134 · P95 R$ 37.172 · maior R$ 72.554

### Folha de Pagamento
- **TOP:** 1607 LANCAMENTO FINANCEIRO - CT-E — TOP financeira em que a empresa lança naturezas de pessoal
- Outras TOPs usadas: 1603 ADIANTAMENTO DE CLIENTE - DESPESA (1)
- **Natureza:** 1060100 SALARIOS (110 de 230, 48%); 1060200 ADIANTAMENTO SALARIAL (46 de 230, 20%); 1060600 FERIAS (37 de 230, 16%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 101200 COM. MAQ. NOVAS  OLIMÁQUINAS SOLUÇÕES PATROCINIO (39 de 230, 17%); 104200 SERVIÇOS OLIMÁQUINAS SOLUÇÕES PATROCÍNIO (29 de 230, 13%); 205001 ADMINISTRATIVO / FINANCEIRO TODAS AS LOJAS (28 de 230, 12%)
- **Conta bancária:** 17 BB - OLIMAQUINAS SOLUÇÕES (216 de 230, 94%); 10 CX. OLIMAQ. SOL. PATROC (12 de 230, 5%); 1 CX. VALMÁQ. PATROC (2 de 230, 1%)
- **Tipo de título:** 35 CREDITO EM CONTA (216 de 230, 94%); 2 DINHEIRO (12 de 230, 5%); 4 BOLETO (2 de 230, 1%)
- **Valores (230 títulos):** mediana R$ 3.714 · P80 R$ 7.757 · P90 R$ 17.961 · P95 R$ 32.013 · maior R$ 49.396


## 300 · OLIMAQUINAS TRATORES FRANCA
5199 títulos de despesa em 12 meses.

### Nota Fiscal de Entrada
- **TOP:** 1404 COMPRA - SERVICO (SEM RETENCAO) — TOP de compra de fornecedor mais usada (fora CT-e, transferência e devolução)
- Outras TOPs usadas: 1414 COMPRA - CT-E (324); 1403 COMPRA - USO/CONSUMO (195); 1452 TRANSFERENCIA ENTRE FILIAIS - ENTRADA (167); 1426 COMPRA - PECAS ENTRE LOJAS/ SEM PEDIDO (144); 1401 COMPRA - REVENDA MAQUINARIO (134)
- **Natureza:** 1053100 SOFTWARE (63 de 342, 18%); 1051000 SERVICOS DE TERCEIROS (29 de 342, 8%); 1041100 FRETES SOBRE VENDAS (27 de 342, 8%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105300 ADMINISTRATIVO   OLIMAQUINAS TRATORES FRANCA (150 de 342, 44%); 101300 COM. MAQ. NOVAS   OLIMÁQUINAS TRATORES FRANCA (102 de 342, 30%); 104300 SERVIÇOS  OLIMAQUINAS TRATORES FRANCA (52 de 342, 15%)
- **Tipo de título:** 4 BOLETO (262 de 342, 77%); 34 TED (73 de 342, 21%); 2 DINHEIRO (6 de 342, 2%)
- **Produto padrão (candidatos):** 90 SERVICO DE TERCEIRO (340 itens)
- **Valores (337 notas):** mediana R$ 483 · P80 R$ 2.550 · P90 R$ 4.423 · P95 R$ 12.013 · maior R$ 19.400

### Boleto
- **TOP:** 1600 DESPESAS DIVERSAS — TOP financeira mais usada fora de tributos e adiantamentos
- Outras TOPs usadas: 1112 LANCAMENTOS FINANCEIROS (167); 1607 LANCAMENTO FINANCEIRO - CT-E (87); 1601 DESPESAS BANCÁRIAS (52)
- **Natureza:** 1100900 MENSALIDADES CARTOES (189 de 226, 84%); 1100400 TAXAS DE CARTAO (18 de 226, 8%); 1110200 DISTRIBUICAO RESULTADO (12 de 226, 5%)
- **Centro de resultado:** 205001 ADMINISTRATIVO / FINANCEIRO TODAS AS LOJAS (220 de 226, 97%); 105300 ADMINISTRATIVO   OLIMAQUINAS TRATORES FRANCA (4 de 226, 2%); 105200 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES PATROCINIO (1 de 226, 0%)
- **Conta bancária:** 24 BRD - OLIMAQUINAS TRATORES (223 de 226, 99%); 18 BB - OLIMAQUINAS TRATORES (3 de 226, 1%)
- **Tipo de título:** 6 DEBITO AUTOMATICO (209 de 226, 92%); 34 TED (12 de 226, 5%); 4 BOLETO (3 de 226, 1%)
- **Valores (226 títulos):** mediana R$ 40 · P80 R$ 138 · P90 R$ 334 · P95 R$ 10.312 · maior R$ 70.000

### Guia de Imposto
- **TOP:** 1609 DESPESAS DE TRIBUTOS — TOP financeira de tributos mais usada
- **Natureza:** 1030400 ISSQN (12 de 59, 20%); 1052800 CSRF (11 de 59, 19%); 1052700 IR RETIDO SERVICOS (11 de 59, 19%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105300 ADMINISTRATIVO   OLIMAQUINAS TRATORES FRANCA (32 de 59, 54%); 103300 PEÇAS OLIMAQUINAS TRATORES FRANCA (14 de 59, 24%); 104300 SERVIÇOS  OLIMAQUINAS TRATORES FRANCA (12 de 59, 20%)
- **Conta bancária:** 24 BRD - OLIMAQUINAS TRATORES (53 de 59, 90%); 33 BRD - OLIMAQUINAS TRAT APLICAÇÃO (6 de 59, 10%)
- **Tipo de título:** 39 DARF C? BARRA (26 de 59, 44%); 47 GNRE - ICMS ST (14 de 59, 24%); 4 BOLETO (13 de 59, 22%)
- **Valores (59 títulos):** mediana R$ 194 · P80 R$ 2.200 · P90 R$ 3.225 · P95 R$ 36.457 · maior R$ 98.362

### Folha de Pagamento
- **TOP:** 1607 LANCAMENTO FINANCEIRO - CT-E — TOP financeira em que a empresa lança naturezas de pessoal
- **Natureza:** 1060100 SALARIOS (49 de 87, 56%); 1060200 ADIANTAMENTO SALARIAL (11 de 87, 13%); 1110100 PRO-LABORE (11 de 87, 13%)
- **Centro de resultado:** 105300 ADMINISTRATIVO   OLIMAQUINAS TRATORES FRANCA (22 de 87, 25%); 101300 COM. MAQ. NOVAS   OLIMÁQUINAS TRATORES FRANCA (21 de 87, 24%); 104300 SERVIÇOS  OLIMAQUINAS TRATORES FRANCA (20 de 87, 23%)
- **Conta bancária:** 18 BB - OLIMAQUINAS TRATORES (85 de 87, 98%); 1 CX. VALMÁQ. PATROC (2 de 87, 2%)
- **Tipo de título:** 35 CREDITO EM CONTA (86 de 87, 99%); 4 BOLETO (1 de 87, 1%)
- **Valores (87 títulos):** mediana R$ 2.885 · P80 R$ 8.032 · P90 R$ 11.573 · P95 R$ 13.936 · maior R$ 15.911


## 100 · VALMAQUINAS PATROCINIO
3867 títulos de despesa em 12 meses.

### Nota Fiscal de Entrada
- **TOP:** 1403 COMPRA - USO/CONSUMO — TOP de compra de fornecedor mais usada (fora CT-e, transferência e devolução)
- Outras TOPs usadas: 1419 COMPRA - REVENDA PECAS (181); 1405 COMPRA - SERVICOS (COM RETENCAO) (167); 1404 COMPRA - SERVICO (SEM RETENCAO) (150); 1420 COMPRA C/ ST FRONT - REVENDA PECAS (83); 1414 COMPRA - CT-E (68)
- **Natureza:** 1051800 DESPESA OFICINA A RECUPERAR (99 de 330, 30%); 1051900 MATERIAIS DE USO NA OFICINA (33 de 330, 10%); 1051000 SERVICOS DE TERCEIROS (31 de 330, 9%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 104100 SERVIÇOS VALMAQUINAS PATROCINIO (247 de 330, 75%); 105100 ADMINISTRATIVO VALMAQUINAS PATROCINIO (51 de 330, 15%); 103100 PEÇAS VALMAQUINAS PATROCINIO (14 de 330, 4%)
- **Tipo de título:** 4 BOLETO (290 de 330, 88%); 2 DINHEIRO (27 de 330, 8%); 34 TED (11 de 330, 3%)
- **Produto padrão (candidatos):** 42 MATERIAL DE USO CONSUMO ST (907 itens); 43 MATERIAL DE USO CONSUMO TRIBUTADO (388 itens); 3234 RAMAL ADICIONAL PARA TELEFONE INTELBRAS TS 3111 SEM FIO E COM IDENTIFICADOR DE CHAMADAS PRETO (1 itens)
- **Valores (323 notas):** mediana R$ 198 · P80 R$ 518 · P90 R$ 950 · P95 R$ 1.610 · maior R$ 6.899

### Boleto
- **TOP:** 1112 LANCAMENTOS FINANCEIROS — TOP financeira mais usada fora de tributos e adiantamentos
- Outras TOPs usadas: 1600 DESPESAS DIVERSAS (253); 1607 LANCAMENTO FINANCEIRO - CT-E (122); 1601 DESPESAS BANCÁRIAS (88)
- **Natureza:** 1100100 TARIFAS BANCARIAS (158 de 290, 54%); 1061400 PLANO DE SAUDE/ODONTOLOGICO - FUNCIONARIOS (14 de 290, 5%); 1051100 IPTU (14 de 290, 5%)
- **Centro de resultado:** 105100 ADMINISTRATIVO VALMAQUINAS PATROCINIO (239 de 290, 82%); 104100 SERVIÇOS VALMAQUINAS PATROCINIO (18 de 290, 6%); 103100 PEÇAS VALMAQUINAS PATROCINIO (11 de 290, 4%)
- **Conta bancária:** 21 BRD - VALMAQUINAS (237 de 290, 82%); 15 BB - VALMAQUINAS (26 de 290, 9%); 1 CX. VALMÁQ. PATROC (24 de 290, 8%)
- **Tipo de título:** 6 DEBITO AUTOMATICO (161 de 290, 56%); 4 BOLETO (91 de 290, 31%); 2 DINHEIRO (25 de 290, 9%)
- **Valores (290 títulos):** mediana R$ 23 · P80 R$ 333 · P90 R$ 616 · P95 R$ 1.134 · maior R$ 18.555

### Guia de Imposto
- **TOP:** 1609 DESPESAS DE TRIBUTOS — TOP financeira de tributos mais usada
- **Natureza:** 1030400 ISSQN (24 de 101, 24%); 1031000 ICMS ST (17 de 101, 17%); 1052800 CSRF (11 de 101, 11%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 103100 PEÇAS VALMAQUINAS PATROCINIO (40 de 101, 40%); 105100 ADMINISTRATIVO VALMAQUINAS PATROCINIO (35 de 101, 35%); 104100 SERVIÇOS VALMAQUINAS PATROCINIO (24 de 101, 24%)
- **Conta bancária:** 21 BRD - VALMAQUINAS (77 de 101, 76%); 15 BB - VALMAQUINAS (24 de 101, 24%)
- **Tipo de título:** 39 DARF C? BARRA (47 de 101, 47%); 37 DAE (24 de 101, 24%); 4 BOLETO (24 de 101, 24%)
- **Valores (101 títulos):** mediana R$ 969 · P80 R$ 4.482 · P90 R$ 9.784 · P95 R$ 14.873 · maior R$ 18.027

### Folha de Pagamento
- **TOP:** 1607 LANCAMENTO FINANCEIRO - CT-E — TOP financeira em que a empresa lança naturezas de pessoal
- **Natureza:** 1060100 SALARIOS (64 de 122, 52%); 1060200 ADIANTAMENTO SALARIAL (27 de 122, 22%); 1060600 FERIAS (12 de 122, 10%)
- **Centro de resultado:** 104100 SERVIÇOS VALMAQUINAS PATROCINIO (33 de 122, 27%); 103100 PEÇAS VALMAQUINAS PATROCINIO (26 de 122, 21%); 203001 PEÇAS DE TODAS AS LOJAS (14 de 122, 11%)
- **Conta bancária:** 15 BB - VALMAQUINAS (121 de 122, 99%); 1 CX. VALMÁQ. PATROC (1 de 122, 1%)
- **Tipo de título:** 35 CREDITO EM CONTA (122 de 122, 100%)
- **Valores (122 títulos):** mediana R$ 2.885 · P80 R$ 4.485 · P90 R$ 6.003 · P95 R$ 12.518 · maior R$ 19.848


## 201 · OLIMAQUINAS SOLUCOES UBERLANDIA
3829 títulos de despesa em 12 meses.

### Nota Fiscal de Entrada
- **TOP:** 1404 COMPRA - SERVICO (SEM RETENCAO) — TOP de compra de fornecedor mais usada (fora CT-e, transferência e devolução)
- Outras TOPs usadas: 1414 COMPRA - CT-E (429); 1452 TRANSFERENCIA ENTRE FILIAIS - ENTRADA (273); 1403 COMPRA - USO/CONSUMO (264); 1419 COMPRA - REVENDA PECAS (126); 1420 COMPRA C/ ST FRONT - REVENDA PECAS (121)
- **Natureza:** 1051800 DESPESA OFICINA A RECUPERAR (82 de 393, 21%); 1051000 SERVICOS DE TERCEIROS (31 de 393, 8%); 1053500 FRETE CONSUMO INTERNO (23 de 393, 6%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 104201 SERVIÇOS OLIMÁQUINAS SOLUÇÕES UBERLÂNDIA (170 de 393, 43%); 101201 COM. MAQ. NOVAS  OLIMÁQUINAS SOL.  UBERLÂNDIA (111 de 393, 28%); 105201 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES UBERLANDIA (97 de 393, 25%)
- **Tipo de título:** 4 BOLETO (263 de 393, 67%); 34 TED (120 de 393, 31%); 9 PIX (9 de 393, 2%)
- **Produto padrão (candidatos):** 90 SERVICO DE TERCEIRO (377 itens); 1168 SERVICO DE TERCEIRO - UBERLANDIA (1 itens)
- **Valores (374 notas):** mediana R$ 1.100 · P80 R$ 3.330 · P90 R$ 7.144 · P95 R$ 13.515 · maior R$ 58.268

### Boleto
- **TOP:** 1112 LANCAMENTOS FINANCEIROS — TOP financeira mais usada fora de tributos e adiantamentos
- Outras TOPs usadas: 1607 LANCAMENTO FINANCEIRO - CT-E (102); 1600 DESPESAS DIVERSAS (2); 1650 RECEITAS DIVERSAS (2)
- **Natureza:** 1052900 DESP ALIMENTACAO / REFEICAO (28 de 206, 14%); 1071100 PEDAGIO (26 de 206, 13%); 1050200 LOCACAO MAQUINAS E EQUIPAMENTOS (20 de 206, 10%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105201 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES UBERLANDIA (165 de 206, 80%); 101201 COM. MAQ. NOVAS  OLIMÁQUINAS SOL.  UBERLÂNDIA (12 de 206, 6%); 102201 COM. MAQ.  USADOS OLIMÁQUINAS SOLUÇÕES UBERLÂNDIA (7 de 206, 3%)
- **Conta bancária:** 23 BRD - OLIMAQUINAS SOLUÇÕES (167 de 206, 81%); 11 CX. OLIMAQ. SOL. UDI (26 de 206, 13%); 17 BB - OLIMAQUINAS SOLUÇÕES (12 de 206, 6%)
- **Tipo de título:** 4 BOLETO (113 de 206, 55%); 34 TED (90 de 206, 44%); 2 DINHEIRO (3 de 206, 1%)
- **Valores (206 títulos):** mediana R$ 256 · P80 R$ 686 · P90 R$ 1.473 · P95 R$ 7.674 · maior R$ 12.222

### Guia de Imposto
- **TOP:** 1609 DESPESAS DE TRIBUTOS — TOP financeira de tributos mais usada
- **Natureza:** 1031000 ICMS ST (76 de 100, 76%); 1030400 ISSQN (12 de 100, 12%); 1052300 DIFAL SOBRE COMPRAS (9 de 100, 9%)
- **Centro de resultado:** 103201 PEÇAS OLIMÁQUINAS SOLUÇÕES UBERLÂNDIA (78 de 100, 78%); 104201 SERVIÇOS OLIMÁQUINAS SOLUÇÕES UBERLÂNDIA (12 de 100, 12%); 105201 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES UBERLANDIA (9 de 100, 9%)
- **Conta bancária:** 23 BRD - OLIMAQUINAS SOLUÇÕES (98 de 100, 98%); 17 BB - OLIMAQUINAS SOLUÇÕES (2 de 100, 2%)
- **Tipo de título:** 47 GNRE - ICMS ST (61 de 100, 61%); 37 DAE (27 de 100, 27%); 4 BOLETO (12 de 100, 12%)
- **Valores (100 títulos):** mediana R$ 147 · P80 R$ 2.708 · P90 R$ 7.259 · P95 R$ 18.842 · maior R$ 45.163

### Folha de Pagamento
- **TOP:** 1607 LANCAMENTO FINANCEIRO - CT-E — TOP financeira em que a empresa lança naturezas de pessoal
- **Natureza:** 1060100 SALARIOS (49 de 102, 48%); 1060200 ADIANTAMENTO SALARIAL (24 de 102, 24%); 1060600 FERIAS (15 de 102, 15%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 101201 COM. MAQ. NOVAS  OLIMÁQUINAS SOL.  UBERLÂNDIA (34 de 102, 33%); 104201 SERVIÇOS OLIMÁQUINAS SOLUÇÕES UBERLÂNDIA (29 de 102, 28%); 105201 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES UBERLANDIA (15 de 102, 15%)
- **Conta bancária:** 17 BB - OLIMAQUINAS SOLUÇÕES (98 de 102, 96%); 1 CX. VALMÁQ. PATROC (3 de 102, 3%); 23 BRD - OLIMAQUINAS SOLUÇÕES (1 de 102, 1%)
- **Tipo de título:** 35 CREDITO EM CONTA (102 de 102, 100%)
- **Valores (102 títulos):** mediana R$ 3.726 · P80 R$ 17.642 · P90 R$ 23.884 · P95 R$ 28.550 · maior R$ 36.116


## 301 · OLIMAQUINAS TRATORES PARAISO
3602 títulos de despesa em 12 meses.

### Nota Fiscal de Entrada
- **TOP:** 1404 COMPRA - SERVICO (SEM RETENCAO) — TOP de compra de fornecedor mais usada (fora CT-e, transferência e devolução)
- Outras TOPs usadas: 1414 COMPRA - CT-E (405); 1403 COMPRA - USO/CONSUMO (258); 1452 TRANSFERENCIA ENTRE FILIAIS - ENTRADA (244); 1426 COMPRA - PECAS ENTRE LOJAS/ SEM PEDIDO (232); 1419 COMPRA - REVENDA PECAS (142)
- **Natureza:** 1051000 SERVICOS DE TERCEIROS (83 de 324, 26%); 1061400 PLANO DE SAUDE/ODONTOLOGICO - FUNCIONARIOS (26 de 324, 8%); 1053100 SOFTWARE (22 de 324, 7%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 104301 SERVIÇOS OLIMAQUINAS TRATORES SÃO SEBASTIÃO (126 de 324, 39%); 105301 ADMINISTRATIVO  OLIMAQUINAS TRATORES SÃO SEBASTIÃO (89 de 324, 27%); 101301 COM. MAQ. NOVAS  OLIMÁQUINAS TRATORES SÃO SEBASTIÃ (82 de 324, 25%)
- **Tipo de título:** 4 BOLETO (217 de 324, 67%); 34 TED (98 de 324, 30%); 2 DINHEIRO (6 de 324, 2%)
- **Produto padrão (candidatos):** 90 SERVICO DE TERCEIRO (331 itens); 100012 TELECOMUNICACOES (1 itens)
- **Valores (319 notas):** mediana R$ 489 · P80 R$ 2.103 · P90 R$ 5.596 · P95 R$ 7.123 · maior R$ 46.825

### Boleto
- **TOP:** 1112 LANCAMENTOS FINANCEIROS — TOP financeira mais usada fora de tributos e adiantamentos
- Outras TOPs usadas: 1607 LANCAMENTO FINANCEIRO - CT-E (82); 1600 DESPESAS DIVERSAS (11); 1650 RECEITAS DIVERSAS (3)
- **Natureza:** 1050200 LOCACAO MAQUINAS E EQUIPAMENTOS (21 de 123, 17%); 1051000 SERVICOS DE TERCEIROS (15 de 123, 12%); 1061400 PLANO DE SAUDE/ODONTOLOGICO - FUNCIONARIOS (13 de 123, 11%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105301 ADMINISTRATIVO  OLIMAQUINAS TRATORES SÃO SEBASTIÃO (67 de 123, 54%); 101301 COM. MAQ. NOVAS  OLIMÁQUINAS TRATORES SÃO SEBASTIÃ (34 de 123, 28%); 104301 SERVIÇOS OLIMAQUINAS TRATORES SÃO SEBASTIÃO (11 de 123, 9%)
- **Conta bancária:** 24 BRD - OLIMAQUINAS TRATORES (99 de 123, 80%); 8 CX. OLIMAQ. TRAT. SSP (21 de 123, 17%); 18 BB - OLIMAQUINAS TRATORES (2 de 123, 2%)
- **Tipo de título:** 4 BOLETO (83 de 123, 67%); 34 TED (21 de 123, 17%); 2 DINHEIRO (18 de 123, 15%)
- **Valores (123 títulos):** mediana R$ 261 · P80 R$ 2.167 · P90 R$ 4.000 · P95 R$ 6.229 · maior R$ 13.620

### Guia de Imposto
- **TOP:** 1609 DESPESAS DE TRIBUTOS — TOP financeira de tributos mais usada
- **Natureza:** 1031000 ICMS ST (102 de 130, 78%); 1030400 ISSQN (16 de 130, 12%); 1052300 DIFAL SOBRE COMPRAS (9 de 130, 7%)
- **Centro de resultado:** 103301 PEÇAS OLIMAQUINAS TRATORES SÃO SEBASTIÃO (103 de 130, 79%); 104301 SERVIÇOS OLIMAQUINAS TRATORES SÃO SEBASTIÃO (16 de 130, 12%); 105301 ADMINISTRATIVO  OLIMAQUINAS TRATORES SÃO SEBASTIÃO (9 de 130, 7%)
- **Conta bancária:** 24 BRD - OLIMAQUINAS TRATORES (121 de 130, 93%); 18 BB - OLIMAQUINAS TRATORES (8 de 130, 6%); 81 SCB- OLIMAQUINAS TRATORES SSP (1 de 130, 1%)
- **Tipo de título:** 47 GNRE - ICMS ST (90 de 130, 69%); 37 DAE (23 de 130, 18%); 4 BOLETO (16 de 130, 12%)
- **Valores (130 títulos):** mediana R$ 119 · P80 R$ 1.027 · P90 R$ 2.610 · P95 R$ 13.835 · maior R$ 53.638

### Folha de Pagamento
- **TOP:** 1607 LANCAMENTO FINANCEIRO - CT-E — TOP financeira em que a empresa lança naturezas de pessoal
- Outras TOPs usadas: 1112 LANCAMENTOS FINANCEIROS (1)
- **Natureza:** 1060100 SALARIOS (44 de 82, 54%); 1060600 FERIAS (16 de 82, 20%); 1060200 ADIANTAMENTO SALARIAL (13 de 82, 16%)
- **Centro de resultado:** 101301 COM. MAQ. NOVAS  OLIMÁQUINAS TRATORES SÃO SEBASTIÃ (29 de 82, 35%); 104301 SERVIÇOS OLIMAQUINAS TRATORES SÃO SEBASTIÃO (23 de 82, 28%); 105301 ADMINISTRATIVO  OLIMAQUINAS TRATORES SÃO SEBASTIÃO (16 de 82, 20%)
- **Conta bancária:** 18 BB - OLIMAQUINAS TRATORES (82 de 82, 100%)
- **Tipo de título:** 35 CREDITO EM CONTA (82 de 82, 100%)
- **Valores (82 títulos):** mediana R$ 4.682 · P80 R$ 15.897 · P90 R$ 18.298 · P95 R$ 20.232 · maior R$ 31.003


## 302 · OLIMAQUINAS TRATORES CATANDUVA
2657 títulos de despesa em 12 meses.

### Nota Fiscal de Entrada
- **TOP:** 1404 COMPRA - SERVICO (SEM RETENCAO) — TOP de compra de fornecedor mais usada (fora CT-e, transferência e devolução)
- Outras TOPs usadas: 1414 COMPRA - CT-E (309); 1426 COMPRA - PECAS ENTRE LOJAS/ SEM PEDIDO (135); 1452 TRANSFERENCIA ENTRE FILIAIS - ENTRADA (132); 1403 COMPRA - USO/CONSUMO (106); 1420 COMPRA C/ ST FRONT - REVENDA PECAS (90)
- **Natureza:** 1053100 SOFTWARE (29 de 217, 13%); 1061400 PLANO DE SAUDE/ODONTOLOGICO - FUNCIONARIOS (28 de 217, 13%); 1051000 SERVICOS DE TERCEIROS (20 de 217, 9%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105302 ADMINISTRATIVO  OLIMAQUINAS TRATORES CATANDUVA (83 de 217, 38%); 101302 COM. MAQ. NOVAS   OLIMÁQUINAS TRATORES CATANDUVA (68 de 217, 31%); 104302 SERVIÇOS OLIMAQUINAS TRATORES CATANDUVA (46 de 217, 21%)
- **Tipo de título:** 4 BOLETO (120 de 217, 55%); 34 TED (89 de 217, 41%); 2 DINHEIRO (6 de 217, 3%)
- **Produto padrão (candidatos):** 90 SERVICO DE TERCEIRO (212 itens)
- **Valores (212 notas):** mediana R$ 523 · P80 R$ 3.403 · P90 R$ 6.617 · P95 R$ 9.804 · maior R$ 18.300

### Boleto
- **TOP:** 1112 LANCAMENTOS FINANCEIROS — TOP financeira mais usada fora de tributos e adiantamentos
- Outras TOPs usadas: 1607 LANCAMENTO FINANCEIRO - CT-E (87); 1600 DESPESAS DIVERSAS (3); 1605 EMPRESTIMO (1)
- **Natureza:** 1050200 LOCACAO MAQUINAS E EQUIPAMENTOS (19 de 174, 11%); 1070100 COMBUSTIVEIS (16 de 174, 9%); 1051000 SERVICOS DE TERCEIROS (15 de 174, 9%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105302 ADMINISTRATIVO  OLIMAQUINAS TRATORES CATANDUVA (102 de 174, 59%); 101302 COM. MAQ. NOVAS   OLIMÁQUINAS TRATORES CATANDUVA (39 de 174, 22%); 104302 SERVIÇOS OLIMAQUINAS TRATORES CATANDUVA (15 de 174, 9%)
- **Conta bancária:** 24 BRD - OLIMAQUINAS TRATORES (101 de 174, 58%); 9 CX. OLIMAQ. TRAT. CTD (70 de 174, 40%); 18 BB - OLIMAQUINAS TRATORES (3 de 174, 2%)
- **Tipo de título:** 4 BOLETO (92 de 174, 53%); 2 DINHEIRO (68 de 174, 39%); 34 TED (13 de 174, 7%)
- **Valores (174 títulos):** mediana R$ 224 · P80 R$ 444 · P90 R$ 4.457 · P95 R$ 17.125 · maior R$ 17.125

### Guia de Imposto
- **TOP:** 1609 DESPESAS DE TRIBUTOS — TOP financeira de tributos mais usada
- **Natureza:** 1030400 ISSQN (24 de 33, 73%); 1030700 ICMS DIFAL + FCP (6 de 33, 18%); 1031000 ICMS ST (2 de 33, 6%)
- **Centro de resultado:** 104302 SERVIÇOS OLIMAQUINAS TRATORES CATANDUVA (24 de 33, 73%); 103302 PEÇAS OLIMAQUINAS TRATORES CATANDUVA (8 de 33, 24%); 101302 COM. MAQ. NOVAS   OLIMÁQUINAS TRATORES CATANDUVA (1 de 33, 3%)
- **Conta bancária:** 24 BRD - OLIMAQUINAS TRATORES (27 de 33, 82%); 18 BB - OLIMAQUINAS TRATORES (6 de 33, 18%)
- **Tipo de título:** 47 GNRE - ICMS ST (8 de 33, 24%); 4 BOLETO (25 de 33, 76%)
- **Valores (33 títulos):** mediana R$ 294 · P80 R$ 1.118 · P90 R$ 1.326 · P95 R$ 1.445 · maior R$ 5.158

### Folha de Pagamento
- **TOP:** 1607 LANCAMENTO FINANCEIRO - CT-E — TOP financeira em que a empresa lança naturezas de pessoal
- **Natureza:** 1060100 SALARIOS (49 de 87, 56%); 1060600 FERIAS (17 de 87, 20%); 1060200 ADIANTAMENTO SALARIAL (13 de 87, 15%)
- **Centro de resultado:** 101302 COM. MAQ. NOVAS   OLIMÁQUINAS TRATORES CATANDUVA (32 de 87, 37%); 104302 SERVIÇOS OLIMAQUINAS TRATORES CATANDUVA (20 de 87, 23%); 105302 ADMINISTRATIVO  OLIMAQUINAS TRATORES CATANDUVA (16 de 87, 18%)
- **Conta bancária:** 18 BB - OLIMAQUINAS TRATORES (86 de 87, 99%); 1 CX. VALMÁQ. PATROC (1 de 87, 1%)
- **Tipo de título:** 35 CREDITO EM CONTA (87 de 87, 100%)
- **Valores (87 títulos):** mediana R$ 3.169 · P80 R$ 8.441 · P90 R$ 10.768 · P95 R$ 12.575 · maior R$ 14.254


## 400 · M.A.S MAQUINAS AGRICOLAS LTDA
2576 títulos de despesa em 12 meses.

### Nota Fiscal de Entrada
- **TOP:** 1404 COMPRA - SERVICO (SEM RETENCAO) — TOP de compra de fornecedor mais usada (fora CT-e, transferência e devolução)
- Outras TOPs usadas: 1403 COMPRA - USO/CONSUMO (118); 1419 COMPRA - REVENDA PECAS (89); 1401 COMPRA - REVENDA MAQUINARIO (82); 1426 COMPRA - PECAS ENTRE LOJAS/ SEM PEDIDO (57); 1425 COMPRA - MAQUINARIO ENTRE LOJAS/ SEM PEDIDO (37)
- **Natureza:** 1053100 SOFTWARE (34 de 264, 13%); 1051000 SERVICOS DE TERCEIROS (30 de 264, 11%); 1080100 CONTABILIDADE - HONORARIOS (26 de 264, 10%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 101400 COM. MAQ. NOVAS   MAS PATROCÍNIO (106 de 264, 40%); 105400 ADMINISTRATIVO  MAS PATROCÍNIO (101 de 264, 38%); 104400 SERVIÇOS MAS PATROCÍNIO (38 de 264, 14%)
- **Tipo de título:** 4 BOLETO (204 de 264, 77%); 34 TED (52 de 264, 20%); 2 DINHEIRO (8 de 264, 3%)
- **Produto padrão (candidatos):** 90 SERVICO DE TERCEIRO (261 itens)
- **Valores (261 notas):** mediana R$ 600 · P80 R$ 2.372 · P90 R$ 3.965 · P95 R$ 5.000 · maior R$ 13.037

### Boleto
- **TOP:** 1600 DESPESAS DIVERSAS — TOP financeira mais usada fora de tributos e adiantamentos
- Outras TOPs usadas: 1112 LANCAMENTOS FINANCEIROS (134); 1607 LANCAMENTO FINANCEIRO - CT-E (53); 1601 DESPESAS BANCÁRIAS (23)
- **Natureza:** 1100100 TARIFAS BANCARIAS (294 de 330, 89%); 1110200 DISTRIBUICAO RESULTADO (14 de 330, 4%); 1101200 IOF (8 de 330, 2%)
- **Centro de resultado:** 105400 ADMINISTRATIVO  MAS PATROCÍNIO (318 de 330, 96%); 206001 DIRETORIA GERAL (6 de 330, 2%); 103400 PEÇAS MAS PATROCÍNIO (5 de 330, 2%)
- **Conta bancária:** 16 BB - M.A.S MAQUINAS (330 de 330, 100%)
- **Tipo de título:** 6 DEBITO AUTOMATICO (301 de 330, 91%); 34 TED (14 de 330, 4%); 4 BOLETO (8 de 330, 2%)
- **Valores (330 títulos):** mediana R$ 13 · P80 R$ 42 · P90 R$ 304 · P95 R$ 2.962 · maior R$ 51.399

### Guia de Imposto
- **TOP:** 1609 DESPESAS DE TRIBUTOS — TOP financeira de tributos mais usada
- **Natureza:** 1030400 ISSQN (12 de 85, 14%); 1030300 COFINS S/FATURAMENTO (11 de 85, 13%); 1030200 PIS S/ FATURAMENTO (11 de 85, 13%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 103400 PEÇAS MAS PATROCÍNIO (37 de 85, 44%); 105400 ADMINISTRATIVO  MAS PATROCÍNIO (28 de 85, 33%); 104400 SERVIÇOS MAS PATROCÍNIO (12 de 85, 14%)
- **Conta bancária:** 16 BB - M.A.S MAQUINAS (85 de 85, 100%)
- **Tipo de título:** 39 DARF C? BARRA (45 de 85, 53%); 37 DAE (22 de 85, 26%); 4 BOLETO (12 de 85, 14%)
- **Valores (85 títulos):** mediana R$ 1.062 · P80 R$ 17.912 · P90 R$ 28.149 · P95 R$ 47.662 · maior R$ 83.643

### Folha de Pagamento
- **TOP:** 1607 LANCAMENTO FINANCEIRO - CT-E — TOP financeira em que a empresa lança naturezas de pessoal
- **Natureza:** 1060100 SALARIOS (30 de 53, 57%); 1110100 PRO-LABORE (10 de 53, 19%); 1060600 FERIAS (10 de 53, 19%)
- **Centro de resultado:** 101400 COM. MAQ. NOVAS   MAS PATROCÍNIO (16 de 53, 30%); 103400 PEÇAS MAS PATROCÍNIO (13 de 53, 25%); 105400 ADMINISTRATIVO  MAS PATROCÍNIO (12 de 53, 23%)
- **Conta bancária:** 16 BB - M.A.S MAQUINAS (53 de 53, 100%)
- **Tipo de título:** 35 CREDITO EM CONTA (53 de 53, 100%)
- **Valores (53 títulos):** mediana R$ 2.468 · P80 R$ 6.445 · P90 R$ 10.669 · P95 R$ 15.099 · maior R$ 21.934


## 500 · LIDON MAQUINAS PATROCINIO
2530 títulos de despesa em 12 meses.

### Nota Fiscal de Entrada
- **TOP:** 1404 COMPRA - SERVICO (SEM RETENCAO) — TOP de compra de fornecedor mais usada (fora CT-e, transferência e devolução)
- Outras TOPs usadas: 1403 COMPRA - USO/CONSUMO (174); 1454 ENTRADA PARA DEMONSTRACAO (99); 1425 COMPRA - MAQUINARIO ENTRE LOJAS/ SEM PEDIDO (72); 1419 COMPRA - REVENDA PECAS (41); 1452 TRANSFERENCIA ENTRE FILIAIS - ENTRADA (39)
- **Natureza:** 1053000 DESP COM  HOSPEDAGEM (41 de 345, 12%); 1062800 SERV. DE TERCEIROS - INTERNO (FUNCIONARIOS) (29 de 345, 8%); 1051000 SERVICOS DE TERCEIROS (28 de 345, 8%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105500 ADMINISTRATIVO  LIDON MAQUINAS PATROCÍNIO (106 de 345, 31%); 101500 COM. MAQ. NOVAS   LIDON MAQ. PATROCÍNIO (86 de 345, 25%); 104500 SERVIÇOS LIDON MAQUINAS PATROCÍNIO (63 de 345, 18%)
- **Tipo de título:** 4 BOLETO (182 de 345, 53%); 34 TED (159 de 345, 46%); 9 PIX (3 de 345, 1%)
- **Produto padrão (candidatos):** 90 SERVICO DE TERCEIRO (342 itens); 100019 SERVICO TORNO (1 itens)
- **Valores (341 notas):** mediana R$ 680 · P80 R$ 3.760 · P90 R$ 6.722 · P95 R$ 12.543 · maior R$ 40.000

### Boleto
- **TOP:** 1112 LANCAMENTOS FINANCEIROS — TOP financeira mais usada fora de tributos e adiantamentos
- Outras TOPs usadas: 1607 LANCAMENTO FINANCEIRO - CT-E (75); 1600 DESPESAS DIVERSAS (30); 1601 DESPESAS BANCÁRIAS (22)
- **Natureza:** 1052900 DESP ALIMENTACAO / REFEICAO (20 de 160, 13%); 1053000 DESP COM  HOSPEDAGEM (17 de 160, 11%); 1061400 PLANO DE SAUDE/ODONTOLOGICO - FUNCIONARIOS (13 de 160, 8%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105500 ADMINISTRATIVO  LIDON MAQUINAS PATROCÍNIO (57 de 160, 36%); 104500 SERVIÇOS LIDON MAQUINAS PATROCÍNIO (25 de 160, 16%); 101500 COM. MAQ. NOVAS   LIDON MAQ. PATROCÍNIO (21 de 160, 13%)
- **Conta bancária:** 19 BB - LIDON MAQUINAS (148 de 160, 93%); 6 CX. LIDON. MAQUINAS PATROC. (11 de 160, 7%); 44 CONTA AJUSTE (1 de 160, 1%)
- **Tipo de título:** 4 BOLETO (80 de 160, 50%); 34 TED (71 de 160, 44%); 2 DINHEIRO (6 de 160, 4%)
- **Valores (160 títulos):** mediana R$ 221 · P80 R$ 2.839 · P90 R$ 4.029 · P95 R$ 6.750 · maior R$ 33.394

### Guia de Imposto
- **TOP:** 1609 DESPESAS DE TRIBUTOS — TOP financeira de tributos mais usada
- **Natureza:** 1031000 ICMS ST (45 de 103, 44%); 1030400 ISSQN (13 de 103, 13%); 1052800 CSRF (11 de 103, 11%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 103500 PEÇAS LIDON MAQUINAS PATROCÍNIO (48 de 103, 47%); 105500 ADMINISTRATIVO  LIDON MAQUINAS PATROCÍNIO (28 de 103, 27%); 104500 SERVIÇOS LIDON MAQUINAS PATROCÍNIO (13 de 103, 13%)
- **Conta bancária:** 19 BB - LIDON MAQUINAS (103 de 103, 100%)
- **Tipo de título:** 47 GNRE - ICMS ST (38 de 103, 37%); 39 DARF C? BARRA (31 de 103, 30%); 37 DAE (20 de 103, 19%)
- **Valores (103 títulos):** mediana R$ 162 · P80 R$ 2.542 · P90 R$ 20.965 · P95 R$ 29.872 · maior R$ 126.361

### Folha de Pagamento
- **TOP:** 1607 LANCAMENTO FINANCEIRO - CT-E — TOP financeira em que a empresa lança naturezas de pessoal
- **Natureza:** 1060100 SALARIOS (42 de 75, 56%); 1060200 ADIANTAMENTO SALARIAL (15 de 75, 20%); 1060600 FERIAS (9 de 75, 12%)
- **Centro de resultado:** 101500 COM. MAQ. NOVAS   LIDON MAQ. PATROCÍNIO (29 de 75, 39%); 103500 PEÇAS LIDON MAQUINAS PATROCÍNIO (16 de 75, 21%); 104500 SERVIÇOS LIDON MAQUINAS PATROCÍNIO (16 de 75, 21%)
- **Conta bancária:** 19 BB - LIDON MAQUINAS (75 de 75, 100%)
- **Tipo de título:** 35 CREDITO EM CONTA (75 de 75, 100%)
- **Valores (75 títulos):** mediana R$ 2.432 · P80 R$ 8.884 · P90 R$ 11.150 · P95 R$ 14.666 · maior R$ 18.714


## 202 · OLIMAQUINAS SOLUCOES PATOS DE MINAS
2502 títulos de despesa em 12 meses.

### Nota Fiscal de Entrada
- **TOP:** 1404 COMPRA - SERVICO (SEM RETENCAO) — TOP de compra de fornecedor mais usada (fora CT-e, transferência e devolução)
- Outras TOPs usadas: 1414 COMPRA - CT-E (469); 1452 TRANSFERENCIA ENTRE FILIAIS - ENTRADA (356); 1403 COMPRA - USO/CONSUMO (175); 1419 COMPRA - REVENDA PECAS (103); 1426 COMPRA - PECAS ENTRE LOJAS/ SEM PEDIDO (95)
- **Natureza:** 1051800 DESPESA OFICINA A RECUPERAR (41 de 285, 14%); 1041100 FRETES SOBRE VENDAS (34 de 285, 12%); 1052000 MATERIAIS DE USO E CONSUMO (23 de 285, 8%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 101202 COM. MAQ. NOVAS  OLIMÁQUINAS SOL. PATOS DE MINAS (110 de 285, 39%); 105202 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES PATOS (71 de 285, 25%); 104202 SERVIÇOS OLIMÁQUINAS SOLUÇÕES PATOS DE MINAS (70 de 285, 25%)
- **Tipo de título:** 4 BOLETO (234 de 285, 82%); 34 TED (46 de 285, 16%); 2 DINHEIRO (5 de 285, 2%)
- **Produto padrão (candidatos):** 90 SERVICO DE TERCEIRO (278 itens)
- **Valores (276 notas):** mediana R$ 556 · P80 R$ 2.000 · P90 R$ 3.506 · P95 R$ 6.111 · maior R$ 28.873

### Boleto
- **TOP:** 1112 LANCAMENTOS FINANCEIROS — TOP financeira mais usada fora de tributos e adiantamentos
- Outras TOPs usadas: 1607 LANCAMENTO FINANCEIRO - CT-E (93); 1600 DESPESAS DIVERSAS (7)
- **Natureza:** 1051000 SERVICOS DE TERCEIROS (14 de 112, 13%); 1061400 PLANO DE SAUDE/ODONTOLOGICO - FUNCIONARIOS (13 de 112, 12%); 1050700 INTERNET (11 de 112, 10%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105202 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES PATOS (80 de 112, 71%); 101202 COM. MAQ. NOVAS  OLIMÁQUINAS SOL. PATOS DE MINAS (24 de 112, 21%); 103202 PEÇAS OLIMÁQUINAS SOLUÇÕES PATOS DE MINAS (6 de 112, 5%)
- **Conta bancária:** 23 BRD - OLIMAQUINAS SOLUÇÕES (99 de 112, 88%); 12 CX. OLIMAQ. SOL. PAT (8 de 112, 7%); 17 BB - OLIMAQUINAS SOLUÇÕES (3 de 112, 3%)
- **Tipo de título:** 4 BOLETO (83 de 112, 74%); 34 TED (21 de 112, 19%); 2 DINHEIRO (8 de 112, 7%)
- **Valores (112 títulos):** mediana R$ 300 · P80 R$ 4.808 · P90 R$ 18.000 · P95 R$ 18.000 · maior R$ 45.436

### Guia de Imposto
- **TOP:** 1609 DESPESAS DE TRIBUTOS — TOP financeira de tributos mais usada
- **Natureza:** 1031000 ICMS ST (53 de 73, 73%); 1030400 ISSQN (12 de 73, 16%); 1052300 DIFAL SOBRE COMPRAS (5 de 73, 7%)
- **Centro de resultado:** 103202 PEÇAS OLIMÁQUINAS SOLUÇÕES PATOS DE MINAS (51 de 73, 70%); 104202 SERVIÇOS OLIMÁQUINAS SOLUÇÕES PATOS DE MINAS (12 de 73, 16%); 105202 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES PATOS (5 de 73, 7%)
- **Conta bancária:** 23 BRD - OLIMAQUINAS SOLUÇÕES (73 de 73, 100%)
- **Tipo de título:** 47 GNRE - ICMS ST (39 de 73, 53%); 37 DAE (22 de 73, 30%); 4 BOLETO (12 de 73, 16%)
- **Valores (73 títulos):** mediana R$ 309 · P80 R$ 1.596 · P90 R$ 16.509 · P95 R$ 23.911 · maior R$ 63.351

### Folha de Pagamento
- **TOP:** 1607 LANCAMENTO FINANCEIRO - CT-E — TOP financeira em que a empresa lança naturezas de pessoal
- **Natureza:** 1060100 SALARIOS (56 de 93, 60%); 1060600 FERIAS (21 de 93, 23%); 1060700 13 SALARIO (7 de 93, 8%)
- **Centro de resultado:** 104202 SERVIÇOS OLIMÁQUINAS SOLUÇÕES PATOS DE MINAS (23 de 93, 25%); 101202 COM. MAQ. NOVAS  OLIMÁQUINAS SOL. PATOS DE MINAS (20 de 93, 22%); 105202 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES PATOS (20 de 93, 22%)
- **Conta bancária:** 17 BB - OLIMAQUINAS SOLUÇÕES (92 de 93, 99%); 1 CX. VALMÁQ. PATROC (1 de 93, 1%)
- **Tipo de título:** 35 CREDITO EM CONTA (93 de 93, 100%)
- **Valores (93 títulos):** mediana R$ 3.534 · P80 R$ 11.647 · P90 R$ 15.678 · P95 R$ 17.475 · maior R$ 19.952


## 203 · OLIMAQUINAS SOLUCOES FORMOSA
1902 títulos de despesa em 12 meses.

### Nota Fiscal de Entrada
- **TOP:** 1404 COMPRA - SERVICO (SEM RETENCAO) — TOP de compra de fornecedor mais usada (fora CT-e, transferência e devolução)
- Outras TOPs usadas: 1414 COMPRA - CT-E (247); 1452 TRANSFERENCIA ENTRE FILIAIS - ENTRADA (173); 1403 COMPRA - USO/CONSUMO (118); 1426 COMPRA - PECAS ENTRE LOJAS/ SEM PEDIDO (65); 1419 COMPRA - REVENDA PECAS (41)
- **Natureza:** 1053100 SOFTWARE (23 de 183, 13%); 1061500 VALE ALIMENTACAO - TICKET (16 de 183, 9%); 1041100 FRETES SOBRE VENDAS (14 de 183, 8%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105203 ADMINISTRATIVO  OLIMÁQUINAS SOLUÇÕES FORMOSA (90 de 183, 49%); 101203 COM. MAQ. NOVAS  OLIMÁQUINAS SOL. FORMOSA (65 de 183, 36%); 104203 SERVIÇOS OLIMÁQUINAS SOLUÇÕES FORMOSA (15 de 183, 8%)
- **Tipo de título:** 4 BOLETO (92 de 183, 50%); 34 TED (79 de 183, 43%); 9 PIX (8 de 183, 4%)
- **Produto padrão (candidatos):** 90 SERVICO DE TERCEIRO (182 itens)
- **Valores (182 notas):** mediana R$ 451 · P80 R$ 2.036 · P90 R$ 3.327 · P95 R$ 3.590 · maior R$ 8.500

### Boleto
- **TOP:** 1112 LANCAMENTOS FINANCEIROS — TOP financeira mais usada fora de tributos e adiantamentos
- Outras TOPs usadas: 1607 LANCAMENTO FINANCEIRO - CT-E (70); 1600 DESPESAS DIVERSAS (3)
- **Natureza:** 1061400 PLANO DE SAUDE/ODONTOLOGICO - FUNCIONARIOS (12 de 92, 13%); 1051000 SERVICOS DE TERCEIROS (11 de 92, 12%); 1061600 SEGURO DE VIDA FUNCIONARIOS (10 de 92, 11%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105203 ADMINISTRATIVO  OLIMÁQUINAS SOLUÇÕES FORMOSA (68 de 92, 74%); 101203 COM. MAQ. NOVAS  OLIMÁQUINAS SOL. FORMOSA (11 de 92, 12%); 104203 SERVIÇOS OLIMÁQUINAS SOLUÇÕES FORMOSA (6 de 92, 7%)
- **Conta bancária:** 23 BRD - OLIMAQUINAS SOLUÇÕES (77 de 92, 84%); 13 CX. OLIMAQ. SOL. FOR (11 de 92, 12%); 17 BB - OLIMAQUINAS SOLUÇÕES (4 de 92, 4%)
- **Tipo de título:** 4 BOLETO (60 de 92, 65%); 34 TED (20 de 92, 22%); 2 DINHEIRO (12 de 92, 13%)
- **Valores (92 títulos):** mediana R$ 200 · P80 R$ 2.226 · P90 R$ 4.789 · P95 R$ 25.000 · maior R$ 25.000

### Guia de Imposto
- **TOP:** 1609 DESPESAS DE TRIBUTOS — TOP financeira de tributos mais usada
- **Natureza:** 1030400 ISSQN (13 de 39, 33%); 1052300 DIFAL SOBRE COMPRAS (10 de 39, 26%); 1030100 ICMS S/ VENDAS (6 de 39, 15%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 104203 SERVIÇOS OLIMÁQUINAS SOLUÇÕES FORMOSA (13 de 39, 33%); 105203 ADMINISTRATIVO  OLIMÁQUINAS SOLUÇÕES FORMOSA (11 de 39, 28%); 103203 PEÇAS OLIMÁQUINAS SOLUÇÕES FORMOSA (9 de 39, 23%)
- **Conta bancária:** 23 BRD - OLIMAQUINAS SOLUÇÕES (21 de 39, 54%); 17 BB - OLIMAQUINAS SOLUÇÕES (18 de 39, 46%)
- **Tipo de título:** 37 DAE (16 de 39, 41%); 47 GNRE - ICMS ST (8 de 39, 21%); 4 BOLETO (13 de 39, 33%)
- **Valores (39 títulos):** mediana R$ 269 · P80 R$ 538 · P90 R$ 6.610 · P95 R$ 30.595 · maior R$ 51.733

### Folha de Pagamento
- **TOP:** 1607 LANCAMENTO FINANCEIRO - CT-E — TOP financeira em que a empresa lança naturezas de pessoal
- **Natureza:** 1060100 SALARIOS (48 de 69, 70%); 1060600 FERIAS (12 de 69, 17%); 1060500 RESCISOES (4 de 69, 6%)
- **Centro de resultado:** 101203 COM. MAQ. NOVAS  OLIMÁQUINAS SOL. FORMOSA (18 de 70, 26%); 104203 SERVIÇOS OLIMÁQUINAS SOLUÇÕES FORMOSA (17 de 70, 24%); 103203 PEÇAS OLIMÁQUINAS SOLUÇÕES FORMOSA (17 de 70, 24%)
- **Conta bancária:** 17 BB - OLIMAQUINAS SOLUÇÕES (69 de 70, 99%); 23 BRD - OLIMAQUINAS SOLUÇÕES (1 de 70, 1%)
- **Tipo de título:** 35 CREDITO EM CONTA (69 de 70, 99%); 2 DINHEIRO (1 de 70, 1%)
- **Valores (70 títulos):** mediana R$ 3.302 · P80 R$ 4.789 · P90 R$ 6.931 · P95 R$ 8.740 · maior R$ 11.444


## 501 · LIDON MAQUINAS RIBEIRAO PRETO
786 títulos de despesa em 12 meses.

### Nota Fiscal de Entrada
- **TOP:** 1404 COMPRA - SERVICO (SEM RETENCAO) — TOP de compra de fornecedor mais usada (fora CT-e, transferência e devolução)
- Outras TOPs usadas: 1454 ENTRADA PARA DEMONSTRACAO (106); 1452 TRANSFERENCIA ENTRE FILIAIS - ENTRADA (40); 1403 COMPRA - USO/CONSUMO (36); 1425 COMPRA - MAQUINARIO ENTRE LOJAS/ SEM PEDIDO (24); 1414 COMPRA - CT-E (19)
- **Natureza:** 1051000 SERVICOS DE TERCEIROS (24 de 131, 18%); 1061400 PLANO DE SAUDE/ODONTOLOGICO - FUNCIONARIOS (20 de 131, 15%); 1053100 SOFTWARE (12 de 131, 9%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 101501 COM. MAQ. NOVAS   LIDON MAQ. RIBEIRÃO PRETO (56 de 131, 43%); 105501 ADMINISTRATIVO  LIDON MAQUINAS RIBEIRÃO PRETO (42 de 131, 32%); 104501 SERVIÇOS LIDON MAQUINAS RIBEIRÃO PRETO (14 de 131, 11%)
- **Tipo de título:** 4 BOLETO (76 de 131, 58%); 34 TED (54 de 131, 41%); 9 PIX (1 de 131, 1%)
- **Produto padrão (candidatos):** 90 SERVICO DE TERCEIRO (129 itens)
- **Valores (129 notas):** mediana R$ 600 · P80 R$ 3.879 · P90 R$ 6.000 · P95 R$ 12.000 · maior R$ 51.000

### Boleto
- **TOP:** 1112 LANCAMENTOS FINANCEIROS — TOP financeira mais usada fora de tributos e adiantamentos
- Outras TOPs usadas: 1607 LANCAMENTO FINANCEIRO - CT-E (20); 1600 DESPESAS DIVERSAS (1)
- **Natureza:** 1052200 LOCACAO DE IMOVEL (21 de 111, 19%); 1051100 IPTU (14 de 111, 13%); 1051000 SERVICOS DE TERCEIROS (12 de 111, 11%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105501 ADMINISTRATIVO  LIDON MAQUINAS RIBEIRÃO PRETO (55 de 111, 50%); 101501 COM. MAQ. NOVAS   LIDON MAQ. RIBEIRÃO PRETO (29 de 111, 26%); 104501 SERVIÇOS LIDON MAQUINAS RIBEIRÃO PRETO (13 de 111, 12%)
- **Conta bancária:** 19 BB - LIDON MAQUINAS (111 de 111, 100%)
- **Tipo de título:** 34 TED (65 de 111, 59%); 4 BOLETO (46 de 111, 41%)
- **Valores (111 títulos):** mediana R$ 1.023 · P80 R$ 2.970 · P90 R$ 22.000 · P95 R$ 22.000 · maior R$ 22.000

### Guia de Imposto
- **TOP:** 1609 DESPESAS DE TRIBUTOS — TOP financeira de tributos mais usada
- **Natureza:** 1031000 ICMS ST (22 de 38, 58%); 1101300 OUTRAS TAXAS - FINANCEIRAS (9 de 38, 24%); 1030400 ISSQN (4 de 38, 11%)
- **Centro de resultado:** 103501 PECAS LIDON MAQUINAS RIBEIRAO PRETO (27 de 38, 71%); 101501 COM. MAQ. NOVAS   LIDON MAQ. RIBEIRÃO PRETO (11 de 38, 29%)
- **Conta bancária:** 19 BB - LIDON MAQUINAS (38 de 38, 100%)
- **Tipo de título:** 47 GNRE - ICMS ST (23 de 38, 61%); 4 BOLETO (15 de 38, 39%)
- **Valores (38 títulos):** mediana R$ 214 · P80 R$ 961 · P90 R$ 1.556 · P95 R$ 4.227 · maior R$ 11.306

### Folha de Pagamento
- **TOP:** 1607 LANCAMENTO FINANCEIRO - CT-E — TOP financeira em que a empresa lança naturezas de pessoal
- **Natureza:** 1060100 SALARIOS (15 de 20, 75%); 1060200 ADIANTAMENTO SALARIAL (3 de 20, 15%); 1060700 13 SALARIO (1 de 20, 5%)
- **Centro de resultado:** 101501 COM. MAQ. NOVAS   LIDON MAQ. RIBEIRÃO PRETO (14 de 20, 70%); 103501 PECAS LIDON MAQUINAS RIBEIRAO PRETO (6 de 20, 30%)
- **Conta bancária:** 19 BB - LIDON MAQUINAS (20 de 20, 100%)
- **Tipo de título:** 35 CREDITO EM CONTA (20 de 20, 100%)
- **Valores (20 títulos):** mediana R$ 3.654 · P80 R$ 4.784 · P90 R$ 4.785 · P95 R$ 4.804 · maior R$ 5.085


## 700 · LIDON COMERCIO
594 títulos de despesa em 12 meses.

### Nota Fiscal de Entrada
- **TOP:** 1404 COMPRA - SERVICO (SEM RETENCAO) — TOP de compra de fornecedor mais usada (fora CT-e, transferência e devolução)
- Outras TOPs usadas: 1425 COMPRA - MAQUINARIO ENTRE LOJAS/ SEM PEDIDO (44); 1414 COMPRA - CT-E (34); 1419 COMPRA - REVENDA PECAS (24); 1426 COMPRA - PECAS ENTRE LOJAS/ SEM PEDIDO (10); 1420 COMPRA C/ ST FRONT - REVENDA PECAS (2)
- **Natureza:** 1090100 DESPESAS COM LICITACOES (14 de 41, 34%); 1053100 SOFTWARE (12 de 41, 29%); 1051000 SERVICOS DE TERCEIROS (6 de 41, 15%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105700 ADMINISTRATIVO LIDON COMERCIO E REPRESENTAÇÃO (16 de 41, 39%); 201001 COM. MAQ.  NOVAS TODAS AS LOJAS (9 de 41, 22%); 101700 COM. MAQ. NOVAS LIDON COMERCIO E REPRESENTACAO (4 de 41, 10%)
- **Tipo de título:** 4 BOLETO (22 de 41, 54%); 34 TED (17 de 41, 41%); 9 PIX (1 de 41, 2%)
- **Produto padrão (candidatos):** 90 SERVICO DE TERCEIRO (41 itens)
- **Valores (41 notas):** mediana R$ 907 · P80 R$ 1.150 · P90 R$ 10.068 · P95 R$ 14.190 · maior R$ 37.500

### Boleto
- **TOP:** 1600 DESPESAS DIVERSAS — TOP financeira mais usada fora de tributos e adiantamentos
- Outras TOPs usadas: 1601 DESPESAS BANCÁRIAS (24); 1112 LANCAMENTOS FINANCEIROS (14); 1605 EMPRESTIMO (12)
- **Natureza:** 1100100 TARIFAS BANCARIAS (38 de 46, 83%); 1051200 TAXAS ESTADUAIS (5 de 46, 11%); 1053400 TAXAS MUNICIPAIS (2 de 46, 4%)
- **Centro de resultado:** 105700 ADMINISTRATIVO LIDON COMERCIO E REPRESENTAÇÃO (45 de 46, 98%); 105500 ADMINISTRATIVO  LIDON MAQUINAS PATROCÍNIO (1 de 46, 2%)
- **Conta bancária:** 22 BRD - LIDON COMERCIO (37 de 46, 80%); 76 BB - LIDON REPRESENTAÇÃO COMERCIAL (9 de 46, 20%)
- **Tipo de título:** 6 DEBITO AUTOMATICO (38 de 46, 83%); 37 DAE (5 de 46, 11%); 38 DAM (2 de 46, 4%)
- **Valores (46 títulos):** mediana R$ 14 · P80 R$ 177 · P90 R$ 184 · P95 R$ 257 · maior R$ 1.741

### Guia de Imposto
- **TOP:** 1609 DESPESAS DE TRIBUTOS — TOP financeira de tributos mais usada
- **Natureza:** 1020900 IRRF A RECUPERAR (12 de 53, 23%); 1030600 CSLL (8 de 53, 15%); 1030500 IRPJ (8 de 53, 15%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105700 ADMINISTRATIVO LIDON COMERCIO E REPRESENTAÇÃO (32 de 53, 60%); 103700 PECAS LIDON COMERCIO E REPRESENTACAO (16 de 53, 30%); 101700 COM. MAQ. NOVAS LIDON COMERCIO E REPRESENTACAO (4 de 53, 8%)
- **Conta bancária:** 22 BRD - LIDON COMERCIO (51 de 53, 96%); 17 BB - OLIMAQUINAS SOLUÇÕES (1 de 53, 2%); 82 ENTRE EMPRESAS (1 de 53, 2%)
- **Tipo de título:** 39 DARF C? BARRA (29 de 53, 55%); 37 DAE (9 de 53, 17%); 34 TED (12 de 53, 23%)
- **Valores (53 títulos):** mediana R$ 4.844 · P80 R$ 20.824 · P90 R$ 38.605 · P95 R$ 43.218 · maior R$ 72.698

### Folha de Pagamento
Sem histórico nesta empresa: cadastre só se ela passar a lançar este tipo.


## 600 · LIDON RENT A CAR
393 títulos de despesa em 12 meses.

### Nota Fiscal de Entrada
- **TOP:** 1404 COMPRA - SERVICO (SEM RETENCAO) — TOP de compra de fornecedor mais usada (fora CT-e, transferência e devolução)
- Outras TOPs usadas: 11 LANCAMENTOS FINANCEIROS (15); 1403 COMPRA - USO/CONSUMO (12); 1406 COMPRA - IMOBILIZADO (5); 1191 DESPESAS DE FOLHA (3)
- **Natureza:** 1080100 CONTABILIDADE - HONORARIOS (26 de 59, 44%); 1053100 SOFTWARE (12 de 59, 20%); 1070300 MANUTENCAO DE CAMINHOES (7 de 59, 12%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105600 ADMINISTRATIVO LIDON RENT A CAR (27 de 59, 46%); 206001 DIRETORIA GERAL (17 de 59, 29%); 212001 LOGÍSTICA E FROTA TODAS AS LOJAS (11 de 59, 19%)
- **Tipo de título:** 4 BOLETO (50 de 59, 85%); 34 TED (9 de 59, 15%)
- **Produto padrão (candidatos):** 90 SERVICO DE TERCEIRO (56 itens)
- **Valores (56 notas):** mediana R$ 650 · P80 R$ 1.909 · P90 R$ 2.039 · P95 R$ 2.039 · maior R$ 2.039

### Boleto
- **TOP:** 1112 LANCAMENTOS FINANCEIROS — TOP financeira mais usada fora de tributos e adiantamentos
- Outras TOPs usadas: 1601 DESPESAS BANCÁRIAS (24); 1600 DESPESAS DIVERSAS (19); 1607 LANCAMENTO FINANCEIRO - CT-E (9)
- **Natureza:** 1070500 MULTA / INFRACOES DE TRANSITO (72 de 114, 63%); 1070900 DESPACHANTE (20 de 114, 18%); 1101000 CONSORCIO (11 de 114, 10%)
- **Centro de resultado:** 212001 LOGÍSTICA E FROTA TODAS AS LOJAS (66 de 114, 58%); 206001 DIRETORIA GERAL (31 de 114, 27%); 105600 ADMINISTRATIVO LIDON RENT A CAR (14 de 114, 12%)
- **Conta bancária:** 55 SCB - LIDON RENT A CAR LTDA (109 de 114, 96%); 20 BB - LIDON RENT A CAR (5 de 114, 4%)
- **Tipo de título:** 4 BOLETO (111 de 114, 97%); 37 DAE (1 de 114, 1%); 6 DEBITO AUTOMATICO (1 de 114, 1%)
- **Valores (114 títulos):** mediana R$ 240 · P80 R$ 958 · P90 R$ 2.934 · P95 R$ 3.053 · maior R$ 5.728

### Guia de Imposto
- **TOP:** 1609 DESPESAS DE TRIBUTOS — TOP financeira de tributos mais usada
- **Natureza:** 1030300 COFINS S/FATURAMENTO (10 de 37, 27%); 1030200 PIS S/ FATURAMENTO (10 de 37, 27%); 1030500 IRPJ (8 de 37, 22%)
  - Natureza varia muito nesta TOP: a do parâmetro vira só o ponto de partida, e o histórico de cada fornecedor (70% em 2 lançamentos daqui ou 3 títulos do ERP) decide.
- **Centro de resultado:** 105600 ADMINISTRATIVO LIDON RENT A CAR (36 de 37, 97%); 105700 ADMINISTRATIVO LIDON COMERCIO E REPRESENTAÇÃO (1 de 37, 3%)
- **Conta bancária:** 55 SCB - LIDON RENT A CAR LTDA (35 de 37, 95%); 20 BB - LIDON RENT A CAR (2 de 37, 5%)
- **Tipo de título:** 39 DARF C? BARRA (36 de 37, 97%); 38 DAM (1 de 37, 3%)
- **Valores (37 títulos):** mediana R$ 3.019 · P80 R$ 6.053 · P90 R$ 6.713 · P95 R$ 9.213 · maior R$ 19.282

### Folha de Pagamento
- **TOP:** 1607 LANCAMENTO FINANCEIRO - CT-E — TOP financeira em que a empresa lança naturezas de pessoal
- **Natureza:** 1110100 PRO-LABORE (9 de 9, 100%)
- **Centro de resultado:** 206001 DIRETORIA GERAL (9 de 9, 100%)
- **Conta bancária:** 55 SCB - LIDON RENT A CAR LTDA (7 de 9, 78%); 20 BB - LIDON RENT A CAR (1 de 9, 11%); 1 CX. VALMÁQ. PATROC (1 de 9, 11%)
- **Tipo de título:** 35 CREDITO EM CONTA (9 de 9, 100%)
- **Valores (9 títulos):** mediana R$ 1.443 · P80 R$ 1.443 · P90 R$ 1.443 · P95 R$ 1.443 · maior R$ 1.443


## Empresas sem movimento relevante (menos de 30 títulos em 12 meses)
1 EMPRESA PADRAO; 299 OLIMAQUINAS SOLUCOES AGRICOLAS LTDA; 399 OLIMAQUINAS TRATORES E IMPLEMENTOS LTDA; 599 LIDON MAQUINAS LTDA; 800 OLIDON CARLOS; 801 JULIANO SILVA; 900 CASSIO PARTICIPACOES LTDA; 910 REGIS PARTICIPACOES LTDA; 920 JULIANO PARTICIPACOES LTDA; 930 KELLY PARTICIPACOES LTDA; 940 MARIA APARECIDA PARTICIPACOES LTDA; 950 OLIDON PARTICIPACOES LTDA; 960 CAMILA PARTICIPACOES LTDA; 970 MARIMAQUINAS. Não precisam de parâmetro agora.
