# Auditoria das TOPs e dos parâmetros de lançamento — Grupo Lidon

**Somente leitura.** Nenhum dado foi gravado no ERP nem no sistema. Nenhum parâmetro foi cadastrado.

| Item | Valor |
|---|---|
| Origem | Oracle do Sankhya, via consulta (DbExplorer), tabelas validadas no dicionário (`USER_TAB_COLUMNS`) antes do uso |
| Período | DTNEG de 2025-11-01 a 2026-10-31 (12 meses completos) |
| Empresas | 200 OLIMAQUINAS SOLUCOES PATROCINIO; 300 OLIMAQUINAS TRATORES FRANCA; 100 VALMAQUINAS PATROCINIO; 201 OLIMAQUINAS SOLUCOES UBERLANDIA; 301 OLIMAQUINAS TRATORES PARAISO; 302 OLIMAQUINAS TRATORES CATANDUVA; 400 M.A.S MAQUINAS AGRICOLAS LTDA; 500 LIDON MAQUINAS PATROCINIO; 202 OLIMAQUINAS SOLUCOES PATOS DE MINAS; 203 OLIMAQUINAS SOLUCOES FORMOSA; 501 LIDON MAQUINAS RIBEIRAO PRETO; 700 LIDON COMERCIO; 600 LIDON RENT A CAR |
| Filtro base | TGFFIN.RECDESP = -1 (despesa), PROVISAO = 'N' (sem provisao de pedido), CODEMP em 200,300,100,201,301,302,400,500,202,203,501,700,600 |
| Unidade | documento = NUNOTA (título vindo de nota) ou NUFIN (título financeiro avulso); parcelas da mesma nota contam uma vez |
| Rastreio | cada número entre colchetes, como [A012], é uma consulta registrada em `registro-analises.md` |

> O padrão mais frequente é **evidência**, não verdade. Onde a frequência e o significado da operação discordam, a recomendação diz isso e pede a decisão de quem responde pela área.

## 1. Escopo por empresa [A017]

| Empresa | Títulos reais | Provisões (fora da análise) | Valor dos títulos | Fornecedores | TOPs |
|---|---:|---:|---:|---:|---:|
| 200 OLIMAQUINAS SOLUCOES PATROCINIO | 9475 | 3968 | R$ 149.985.463 | 792 | 38 |
| 300 OLIMAQUINAS TRATORES FRANCA | 3837 | 1293 | R$ 37.659.342 | 281 | 36 |
| 100 VALMAQUINAS PATROCINIO | 2743 | 1148 | R$ 21.705.046 | 328 | 31 |
| 201 OLIMAQUINAS SOLUCOES UBERLANDIA | 2649 | 1194 | R$ 14.052.010 | 393 | 31 |
| 301 OLIMAQUINAS TRATORES PARAISO | 2373 | 1231 | R$ 8.499.064 | 306 | 31 |
| 202 OLIMAQUINAS SOLUCOES PATOS DE MINAS | 1975 | 535 | R$ 7.591.050 | 259 | 29 |
| 302 OLIMAQUINAS TRATORES CATANDUVA | 1912 | 748 | R$ 16.082.362 | 237 | 34 |
| 400 M.A.S MAQUINAS AGRICOLAS LTDA | 1818 | 756 | R$ 24.956.633 | 234 | 28 |
| 500 LIDON MAQUINAS PATROCINIO | 1813 | 714 | R$ 16.891.500 | 304 | 32 |
| 203 OLIMAQUINAS SOLUCOES FORMOSA | 1281 | 636 | R$ 3.267.635 | 170 | 31 |
| 501 LIDON MAQUINAS RIBEIRAO PRETO | 547 | 232 | R$ 5.756.972 | 129 | 28 |
| 700 LIDON COMERCIO | 510 | 84 | R$ 27.559.481 | 87 | 21 |
| 600 LIDON RENT A CAR | 319 | 70 | R$ 1.870.728 | 37 | 13 |

Origem dos títulos [A018]: ORIGEM E / PROVISAO N: 20954; ORIGEM E / PROVISAO S: 12609; ORIGEM F / PROVISAO N: 9195; ORIGEM P / PROVISAO N: 1103. Provisões são títulos de pedido de compra, sem documento fiscal: ficam fora dos padrões e das alçadas.

## 2. Operação real dos documentos [A019]

Cada título foi classificado pela operação, não pelo nome da TOP (regras na seção 1 de `regras-automacao.md`).

| Categoria | Documentos | % |
|---|---:|---:|
| Nota fiscal de compra | 11693 | 43.6% |
| Débito automático / tarifa | 3922 | 14.6% |
| CT-e / frete | 3493 | 13% |
| Boleto | 1719 | 6.4% |
| Guia tributária | 1707 | 6.4% |
| Outro financeiro | 1415 | 5.3% |
| Folha de pagamento | 1239 | 4.6% |
| Adiantamento | 883 | 3.3% |
| Nota de outra operação | 461 | 1.7% |
| Guia de encargo de folha | 299 | 1.1% |

## 3. TOPs analisadas

Foco pedido: 1607, 1600, 1112, 1403, 1404, 1609. Incluídas também as mais usadas no período: 1414, 0, 1419, 1426, 1420, 1405, 1401, 1601.

Configuração vigente [A021], uso [A022], provisões [A023], notas de compra [A029], composição por categoria [A020].


### 1607 — LANCAMENTO FINANCEIRO - CT-E (foco)

- **Configuração:** TIPMOV I · ativa S · atualiza financeiro 0 (I) · estoque N · livro fiscal E · contabilidade N · NF-e — · financeiro de origem N · 6 versões (1998-01-01 a 2025-07-07)
- **Uso:** 1104 documentos, 1104 títulos, 12 empresas, 13 parceiros, R$ 5.944.741; mediana do título R$ 3.100; origem nota 1 · financeiro 0 · outra 1103
- **Operação real:** Folha de pagamento 95.3% · Outro financeiro 4.6% · CT-e / frete 0.1%
- **Natureza:** 1060100 SALARIOS 50.6% · 1060200 ADIANTAMENTO SALARIAL 15.7% · 1060600 FERIAS 14% · 1060700 13 SALARIO 9.9% [A025]
- **Centro:** 206001 DIRETORIA GERAL 4.5% · 101200 COM. MAQ. NOVAS  OLIMÁQUINAS SOLUÇÕES PATROCINIO 3.8% · 205001 ADMINISTRATIVO / FINANCEIRO TODAS AS LOJAS 3.5% · 212001 LOGÍSTICA E FROTA TODAS AS LOJAS 3.5% [A026]
- **Conta:** 17 BB - OLIMAQUINAS SOLUÇÕES 46.8% · 18 BB - OLIMAQUINAS TRATORES 24.8% · 15 BB - VALMAQUINAS 11.8% · 19 BB - LIDON MAQUINAS 9.3% [A027]
- **Titulo:** 35 CREDITO EM CONTA 98.5% · 2 DINHEIRO 1.2% · 4 BOLETO 0.4% [A028]
- **Por empresa** [A024]: 200: 249 · 100: 130 · 201: 110 · 202: 98 · 302: 93 · 300: 92 · 301: 89 · 500: 81 · 203: 75 · 400: 56 · 501: 22 · 600: 9
- **Leitura:** O nome diz CT-e, mas 95.3% dos documentos são Folha de pagamento.

### 1600 — DESPESAS DIVERSAS (foco)

- **Configuração:** TIPMOV I · ativa S · atualiza financeiro 0 (I) · estoque N · livro fiscal N · contabilidade S · NF-e M · financeiro de origem N · 6 versões (1998-01-01 a 2025-07-31)
- **Uso:** 1034 documentos, 1034 títulos, 13 empresas, 34 parceiros, R$ 2.721.536; mediana do título R$ 26; origem nota 0 · financeiro 1034 · outra 0
- **Operação real:** Débito automático / tarifa 83% · Outro financeiro 9.1% · Boleto 4.8% · Guia tributária 2.4% · Adiantamento 0.7%
- **Natureza:** 1100100 TARIFAS BANCARIAS 40.1% · 1100400 TAXAS DE CARTAO 19.2% · 1100900 MENSALIDADES CARTOES 18.6% · 1110200 DISTRIBUICAO RESULTADO 6.2% [A025]
- **Centro:** 105400 ADMINISTRATIVO  MAS PATROCÍNIO 30.9% · 205001 ADMINISTRATIVO / FINANCEIRO TODAS AS LOJAS 28.8% · 105100 ADMINISTRATIVO VALMAQUINAS PATROCINIO 18.2% · 105700 ADMINISTRATIVO LIDON COMERCIO E REPRESENTAÇÃO 8.1% [A026]
- **Conta:** 16 BB - M.A.S MAQUINAS 32.2% · 24 BRD - OLIMAQUINAS TRATORES 22.7% · 21 BRD - VALMAQUINAS 18.8% · 23 BRD - OLIMAQUINAS SOLUÇÕES 6.6% [A027]
- **Titulo:** 6 DEBITO AUTOMATICO 83% · 34 TED 6.7% · 4 BOLETO 2.8% · 37 DAE 2.4% [A028]
- **Por empresa** [A024]: 400: 333 · 100: 254 · 300: 226 · 200: 97 · 700: 48 · 500: 30 · 600: 19 · 301: 11 · 202: 7 · 302: 3 · 203: 3 · 201: 2 · 501: 1

### 1112 — LANCAMENTOS FINANCEIROS (foco)

- **Configuração:** TIPMOV I · ativa S · atualiza financeiro 0 (I) · estoque N · livro fiscal N · contabilidade S · NF-e M · financeiro de origem N · 1 versões (2025-07-07 a 2025-07-07)
- **Uso:** 2457 documentos, 2457 títulos, 13 empresas, 353 parceiros, R$ 7.713.428; mediana do título R$ 270; origem nota 0 · financeiro 2457 · outra 0
- **Operação real:** Boleto 60% · Outro financeiro 29.5% · Débito automático / tarifa 10% · Guia tributária 0.4% · Folha de pagamento 0%
- **Natureza:** 1070500 MULTA / INFRACOES DE TRANSITO 7.9% · 1101000 CONSORCIO 6.8% · 1100100 TARIFAS BANCARIAS 6.7% · 1050200 LOCACAO MAQUINAS E EQUIPAMENTOS 6% [A025]
- **Centro:** 105100 ADMINISTRATIVO VALMAQUINAS PATROCINIO 9.7% · 105200 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES PATROCINIO 9.4% · 105201 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES UBERLANDIA 7.1% · 101200 COM. MAQ. NOVAS  OLIMÁQUINAS SOLUÇÕES PATROCINIO 5.7% [A026]
- **Conta:** 23 BRD - OLIMAQUINAS SOLUÇÕES 41.1% · 24 BRD - OLIMAQUINAS TRATORES 13.8% · 19 BB - LIDON MAQUINAS 10.5% · 21 BRD - VALMAQUINAS 9.6% [A027]
- **Titulo:** 4 BOLETO 59.1% · 34 TED 21.4% · 6 DEBITO AUTOMATICO 10.1% · 2 DINHEIRO 9% [A028]
- **Por empresa** [A024]: 200: 759 · 100: 288 · 201: 211 · 302: 173 · 300: 166 · 500: 161 · 400: 133 · 301: 124 · 202: 112 · 600: 112 · 501: 111 · 203: 93 · 700: 14
- **Leitura:** Uso misto: a operação dominante tem 60% — um parâmetro único por tipo de documento não cobre esta TOP inteira.

### 1403 — COMPRA - USO/CONSUMO (foco)

- **Configuração:** TIPMOV C · ativa S · atualiza financeiro -1 (I) · estoque N · livro fiscal E · contabilidade S · NF-e T · financeiro de origem N · 26 versões (1998-01-01 a 2026-09-11)
- **Uso:** 2395 documentos, 2607 títulos, 13 empresas, 476 parceiros, R$ 2.287.407; mediana do título R$ 287; origem nota 2603 · financeiro 4 · outra 0; mais 6 provisões
- **Notas de compra (cabeçalho):** 2403 notas, 2395 com chave NF-e, 0 com chave CT-e, 2395 liberadas; mediana R$ 261
- **Operação real:** Nota fiscal de compra 99.8% · Outro financeiro 0.2%
- **Natureza:** 1051800 DESPESA OFICINA A RECUPERAR 15.9% · 1052000 MATERIAIS DE USO E CONSUMO 13.3% · 1051900 MATERIAIS DE USO NA OFICINA 12.9% · 1053200 MATERIAL DE ESCRITORIO 6.7% [A025]
- **Centro:** 104100 SERVIÇOS VALMAQUINAS PATROCINIO 10.2% · 104301 SERVIÇOS OLIMAQUINAS TRATORES SÃO SEBASTIÃO 7.3% · 104201 SERVIÇOS OLIMÁQUINAS SOLUÇÕES UBERLÂNDIA 7.1% · 104200 SERVIÇOS OLIMÁQUINAS SOLUÇÕES PATROCÍNIO 5.3% [A026]
- **Conta:** 23 BRD - OLIMAQUINAS SOLUÇÕES 41.2% · 24 BRD - OLIMAQUINAS TRATORES 18.4% · 21 BRD - VALMAQUINAS 11.7% · 19 BB - LIDON MAQUINAS 8.4% [A027]
- **Titulo:** 4 BOLETO 75.3% · 34 TED 13.6% · 2 DINHEIRO 9.4% · 9 PIX 1.1% [A028]
- **Por empresa** [A024]: 200: 608 · 100: 329 · 201: 262 · 301: 258 · 300: 194 · 202: 176 · 500: 175 · 203: 120 · 400: 119 · 302: 106 · 501: 35 · 600: 12 · 700: 1

### 1404 — COMPRA - SERVICO (SEM RETENCAO) (foco)

- **Configuração:** TIPMOV C · ativa S · atualiza financeiro -1 (I) · estoque N · livro fiscal N · contabilidade S · NF-e M · financeiro de origem N · 20 versões (1998-01-01 a 2025-10-24)
- **Uso:** 3098 documentos, 3187 títulos, 13 empresas, 474 parceiros, R$ 7.463.802; mediana do título R$ 633; origem nota 3187 · financeiro 0 · outra 0; mais 7 provisões
- **Notas de compra (cabeçalho):** 3105 notas, 1 com chave NF-e, 0 com chave CT-e, 3098 liberadas; mediana R$ 614
- **Operação real:** Nota fiscal de compra 95.3% · Folha de pagamento 4.7%
- **Natureza:** 1053100 SOFTWARE 13.1% · 1051000 SERVICOS DE TERCEIROS 10% · 1061400 PLANO DE SAUDE/ODONTOLOGICO - FUNCIONARIOS 8.1% · 1051800 DESPESA OFICINA A RECUPERAR 7% [A025]
- **Centro:** 104201 SERVIÇOS OLIMÁQUINAS SOLUÇÕES UBERLÂNDIA 5.3% · 105200 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES PATROCINIO 4.8% · 105300 ADMINISTRATIVO   OLIMAQUINAS TRATORES FRANCA 4.7% · 104301 SERVIÇOS OLIMAQUINAS TRATORES SÃO SEBASTIÃO 4.1% [A026]
- **Conta:** 23 BRD - OLIMAQUINAS SOLUÇÕES 37.4% · 24 BRD - OLIMAQUINAS TRATORES 27% · 19 BB - LIDON MAQUINAS 15.4% · 16 BB - M.A.S MAQUINAS 8.3% [A027]
- **Titulo:** 4 BOLETO 66.9% · 34 TED 30.5% · 2 DINHEIRO 1.5% · 9 PIX 1% [A028]
- **Por empresa** [A024]: 200: 382 · 201: 376 · 500: 347 · 300: 343 · 301: 323 · 202: 280 · 400: 264 · 302: 216 · 203: 182 · 100: 155 · 501: 133 · 600: 56 · 700: 41

### 1609 — DESPESAS DE TRIBUTOS (foco)

- **Configuração:** TIPMOV I · ativa S · atualiza financeiro 0 (I) · estoque N · livro fiscal N · contabilidade S · NF-e M · financeiro de origem N · 5 versões (1998-01-01 a 2025-09-16)
- **Uso:** 1069 documentos, 1069 títulos, 13 empresas, 44 parceiros, R$ 5.373.316; mediana do título R$ 436; origem nota 0 · financeiro 1069 · outra 0
- **Operação real:** Guia tributária 96.5% · Boleto 1.7% · Outro financeiro 1.7% · Débito automático / tarifa 0.1%
- **Natureza:** 1031000 ICMS ST 43.6% · 1030400 ISSQN 15.5% · 1052300 DIFAL SOBRE COMPRAS 5.8% · 1030200 PIS S/ FATURAMENTO 5% [A025]
- **Centro:** 103200 PEÇAS OLIMÁQUINAS SOLUÇÕES PATROCÍNIO 13.4% · 103301 PEÇAS OLIMAQUINAS TRATORES SÃO SEBASTIÃO 9.7% · 103201 PEÇAS OLIMÁQUINAS SOLUÇÕES UBERLÂNDIA 7.7% · 103202 PEÇAS OLIMÁQUINAS SOLUÇÕES PATOS DE MINAS 4.8% [A026]
- **Conta:** 23 BRD - OLIMAQUINAS SOLUÇÕES 34.9% · 24 BRD - OLIMAQUINAS TRATORES 18.9% · 19 BB - LIDON MAQUINAS 13.3% · 16 BB - M.A.S MAQUINAS 8% [A027]
- **Titulo:** 47 GNRE - ICMS ST 36.1% · 39 DARF C? BARRA 25.3% · 37 DAE 19.2% · 4 BOLETO 16.8% [A028]
- **Por empresa** [A024]: 200: 215 · 301: 131 · 500: 105 · 201: 101 · 100: 101 · 400: 85 · 202: 73 · 300: 59 · 700: 53 · 203: 39 · 600: 37 · 501: 37 · 302: 33

### 1414 — COMPRA - CT-E

- **Configuração:** TIPMOV C · ativa S · atualiza financeiro -1 (I) · estoque N · livro fiscal E · contabilidade S · NF-e M · financeiro de origem N · 19 versões (1998-01-01 a 2025-10-24)
- **Uso:** 3368 documentos, 3369 títulos, 12 empresas, 37 parceiros, R$ 630.148; mediana do título R$ 73; origem nota 3369 · financeiro 0 · outra 0
- **Notas de compra (cabeçalho):** 3368 notas, 0 com chave NF-e, 3368 com chave CT-e, 3368 liberadas; mediana R$ 73
- **Operação real:** CT-e / frete 89.5% · Nota fiscal de compra 10.5%
- **Natureza:** 1041900 FRETES SOBRE COMPRA PECAS ORIGINAIS 64.5% · 1040500 COMPRA PECAS ORIGINAIS 22.6% · 1053500 FRETE CONSUMO INTERNO 6.3% · 1042000 FRETES SOBRE COMPRA PECAS PARALELAS 4.2% [A025]
- **Centro:** 103200 PEÇAS OLIMÁQUINAS SOLUÇÕES PATROCÍNIO 29.5% · 103202 PEÇAS OLIMÁQUINAS SOLUÇÕES PATOS DE MINAS 13.8% · 103201 PEÇAS OLIMÁQUINAS SOLUÇÕES UBERLÂNDIA 12.5% · 103301 PEÇAS OLIMAQUINAS TRATORES SÃO SEBASTIÃO 11.8% [A026]
- **Conta:** 23 BRD - OLIMAQUINAS SOLUÇÕES 59.6% · 24 BRD - OLIMAQUINAS TRATORES 28% · 17 BB - OLIMAQUINAS SOLUÇÕES 4.4% · 18 BB - OLIMAQUINAS TRATORES 3% [A027]
- **Titulo:** 4 BOLETO 96% · 0 <SEM TIPO DE TITULO> 2.8% · 34 TED 0.7% · 9 PIX 0.4% [A028]

### 0 — <SEM TOP>

- **Configuração:** TIPMOV P · ativa S · atualiza financeiro 0 (I) · estoque N · livro fiscal N · contabilidade N · NF-e — · financeiro de origem N · 1 versões (1998-01-01 a 1998-01-01)
- **Uso:** 2717 documentos, 2717 títulos, 13 empresas, 94 parceiros, R$ 7.757.581; mediana do título R$ 20; origem nota 2 · financeiro 2715 · outra 0
- **Operação real:** Débito automático / tarifa 85.1% · Guia de encargo de folha 7.7% · Outro financeiro 2.5% · Guia tributária 2.1% · Boleto 1.8%
- **Natureza:** 1100100 TARIFAS BANCARIAS 57.2% · 1100400 TAXAS DE CARTAO 13.1% · 1100700 TARIFAS BANCARIAS COBRANCA 11% · 1061000 FGTS 4% [A025]
- **Centro:** 105200 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES PATROCINIO 23.5% · 105300 ADMINISTRATIVO   OLIMAQUINAS TRATORES FRANCA 19.1% · 105500 ADMINISTRATIVO  LIDON MAQUINAS PATROCÍNIO 17.6% · 205001 ADMINISTRATIVO / FINANCEIRO TODAS AS LOJAS 16% [A026]
- **Conta:** 23 BRD - OLIMAQUINAS SOLUÇÕES 35% · 24 BRD - OLIMAQUINAS TRATORES 23.1% · 19 BB - LIDON MAQUINAS 18.7% · 21 BRD - VALMAQUINAS 10.6% [A027]
- **Titulo:** 6 DEBITO AUTOMATICO 85.1% · 4 BOLETO 8.9% · 34 TED 2.1% · 47 GNRE - ICMS ST 2.1% [A028]

### 1419 — COMPRA - REVENDA PECAS

- **Configuração:** TIPMOV C · ativa S · atualiza financeiro -1 (I) · estoque E · livro fiscal E · contabilidade S · NF-e T · financeiro de origem N · 76 versões (2024-07-19 a 2026-10-14)
- **Uso:** 1276 documentos, 2254 títulos, 12 empresas, 216 parceiros, R$ 5.825.785; mediana do título R$ 1.090; origem nota 2254 · financeiro 0 · outra 0
- **Notas de compra (cabeçalho):** 1280 notas, 1280 com chave NF-e, 0 com chave CT-e, 1276 liberadas; mediana R$ 1.606
- **Operação real:** Nota fiscal de compra 100%
- **Natureza:** 1040600 COMPRA PECAS PARALELAS 61.1% · 1040800 COMPRA LUBRIFICANTES 19.4% · 1040500 COMPRA PECAS ORIGINAIS 13.9% · 1040900 COMPRA PNEUS 4.2% [A025]
- **Centro:** 103200 PEÇAS OLIMÁQUINAS SOLUÇÕES PATROCÍNIO 26.8% · 103100 PEÇAS VALMAQUINAS PATROCINIO 14.3% · 103301 PEÇAS OLIMAQUINAS TRATORES SÃO SEBASTIÃO 10.7% · 103201 PEÇAS OLIMÁQUINAS SOLUÇÕES UBERLÂNDIA 9.9% [A026]
- **Conta:** 23 BRD - OLIMAQUINAS SOLUÇÕES 46% · 24 BRD - OLIMAQUINAS TRATORES 21.9% · 21 BRD - VALMAQUINAS 13.9% · 16 BB - M.A.S MAQUINAS 6.8% [A027]
- **Titulo:** 4 BOLETO 97.1% · 9 PIX 1.3% · 2 DINHEIRO 1.2% · 34 TED 0.5% [A028]

### 1426 — COMPRA - PECAS ENTRE LOJAS/ SEM PEDIDO

- **Configuração:** TIPMOV C · ativa S · atualiza financeiro -1 (I) · estoque E · livro fiscal E · contabilidade S · NF-e T · financeiro de origem N · 20 versões (2024-12-02 a 2025-10-24)
- **Uso:** 1101 documentos, 1126 títulos, 12 empresas, 13 parceiros, R$ 1.446.606; mediana do título R$ 500; origem nota 1126 · financeiro 0 · outra 0; mais 1 provisões
- **Notas de compra (cabeçalho):** 1102 notas, 1102 com chave NF-e, 0 com chave CT-e, 1101 liberadas; mediana R$ 502
- **Operação real:** Nota fiscal de compra 99.9% · Guia tributária 0.1%
- **Natureza:** 1041700 COMPRA ENTRE LOJAS 92.6% · 1011700 VENDA ENTRE LOJAS 4.6% · 1040100 COMPRA MAQUINA NOVA 2.4% · 1051800 DESPESA OFICINA A RECUPERAR 0.2% [A025]
- **Centro:** 103301 PEÇAS OLIMAQUINAS TRATORES SÃO SEBASTIÃO 21.4% · 103200 PEÇAS OLIMÁQUINAS SOLUÇÕES PATROCÍNIO 18.3% · 103302 PEÇAS OLIMAQUINAS TRATORES CATANDUVA 12.1% · 103300 PEÇAS OLIMAQUINAS TRATORES FRANCA 10.4% [A026]
- **Conta:** 24 BRD - OLIMAQUINAS TRATORES 40.4% · 23 BRD - OLIMAQUINAS SOLUÇÕES 40.1% · 18 BB - OLIMAQUINAS TRATORES 6.2% · 16 BB - M.A.S MAQUINAS 5.2% [A027]
- **Titulo:** 34 TED 75.8% · 4 BOLETO 19.1% · 0 <SEM TIPO DE TITULO> 4.4% · 35 CREDITO EM CONTA 0.5% [A028]

### 1420 — COMPRA C/ ST FRONT - REVENDA PECAS

- **Configuração:** TIPMOV C · ativa S · atualiza financeiro -1 (I) · estoque E · livro fiscal E · contabilidade S · NF-e T · financeiro de origem N · 58 versões (2024-09-05 a 2026-10-13)
- **Uso:** 965 documentos, 1845 títulos, 12 empresas, 62 parceiros, R$ 9.131.605; mediana do título R$ 1.400; origem nota 1845 · financeiro 0 · outra 0; mais 1 provisões
- **Notas de compra (cabeçalho):** 967 notas, 967 com chave NF-e, 0 com chave CT-e, 965 liberadas; mediana R$ 2.958
- **Operação real:** Nota fiscal de compra 100%
- **Natureza:** 1040500 COMPRA PECAS ORIGINAIS 88.7% · 1040600 COMPRA PECAS PARALELAS 11.1% · 1010600 VENDA PECAS ORIGINAIS 0.1% · 1040900 COMPRA PNEUS 0.1% [A025]
- **Centro:** 103200 PEÇAS OLIMÁQUINAS SOLUÇÕES PATROCÍNIO 28.1% · 103201 PEÇAS OLIMÁQUINAS SOLUÇÕES UBERLÂNDIA 12.6% · 103300 PEÇAS OLIMAQUINAS TRATORES FRANCA 12.1% · 103301 PEÇAS OLIMAQUINAS TRATORES SÃO SEBASTIÃO 12% [A026]
- **Conta:** 23 BRD - OLIMAQUINAS SOLUÇÕES 50.8% · 24 BRD - OLIMAQUINAS TRATORES 32.7% · 21 BRD - VALMAQUINAS 8.5% · 17 BB - OLIMAQUINAS SOLUÇÕES 2.8% [A027]
- **Titulo:** 4 BOLETO 98.9% · 34 TED 0.7% · 9 PIX 0.4% [A028]

### 1405 — COMPRA - SERVICOS (COM RETENCAO)

- **Configuração:** TIPMOV C · ativa S · atualiza financeiro -1 (I) · estoque N · livro fiscal N · contabilidade S · NF-e M · financeiro de origem N · 11 versões (1998-01-01 a 2025-10-24)
- **Uso:** 939 documentos, 959 títulos, 11 empresas, 117 parceiros, R$ 2.706.438; mediana do título R$ 574; origem nota 959 · financeiro 0 · outra 0
- **Notas de compra (cabeçalho):** 939 notas, 0 com chave NF-e, 0 com chave CT-e, 939 liberadas; mediana R$ 574
- **Operação real:** Nota fiscal de compra 100%
- **Natureza:** 1051800 DESPESA OFICINA A RECUPERAR 18.3% · 1053100 SOFTWARE 11.7% · 1070100 COMBUSTIVEIS 8.8% · 1051000 SERVICOS DE TERCEIROS 6.7% [A025]
- **Centro:** 104200 SERVIÇOS OLIMÁQUINAS SOLUÇÕES PATROCÍNIO 11.9% · 101200 COM. MAQ. NOVAS  OLIMÁQUINAS SOLUÇÕES PATROCINIO 11.7% · 102200 COM. MAQ.  USADOS OLIMÁQUINAS SOLUÇÕES PATROCÍNIO 8.9% · 104100 SERVIÇOS VALMAQUINAS PATROCINIO 8.4% [A026]
- **Conta:** 23 BRD - OLIMAQUINAS SOLUÇÕES 62.1% · 21 BRD - VALMAQUINAS 16.3% · 24 BRD - OLIMAQUINAS TRATORES 11.1% · 17 BB - OLIMAQUINAS SOLUÇÕES 3.7% [A027]
- **Titulo:** 4 BOLETO 71% · 34 TED 28.2% · 2 DINHEIRO 0.6% · 9 PIX 0.2% [A028]

### 1401 — COMPRA - REVENDA MAQUINARIO

- **Configuração:** TIPMOV C · ativa S · atualiza financeiro -1 (I) · estoque E · livro fiscal E · contabilidade S · NF-e T · financeiro de origem N · 39 versões (1998-01-01 a 2026-01-14)
- **Uso:** 697 documentos, 2577 títulos, 11 empresas, 61 parceiros, R$ 107.961.021; mediana do título R$ 4.200; origem nota 2565 · financeiro 12 · outra 0; mais 5 provisões
- **Notas de compra (cabeçalho):** 704 notas, 695 com chave NF-e, 0 com chave CT-e, 693 liberadas; mediana R$ 139.092
- **Operação real:** Nota fiscal de compra 98.3% · Boleto 1.7%
- **Natureza:** 1040100 COMPRA MAQUINA NOVA 54.8% · 1040400 COMPRA  IMPL NOVOS 44.9% · 1010300 VENDA DE IMPLEMENTOS NOVOS 0.3% [A025]
- **Centro:** 101200 COM. MAQ. NOVAS  OLIMÁQUINAS SOLUÇÕES PATROCINIO 41.4% · 101300 COM. MAQ. NOVAS   OLIMÁQUINAS TRATORES FRANCA 19.1% · 101400 COM. MAQ. NOVAS   MAS PATROCÍNIO 11.5% · 101302 COM. MAQ. NOVAS   OLIMÁQUINAS TRATORES CATANDUVA 11.3% [A026]
- **Conta:** 23 BRD - OLIMAQUINAS SOLUÇÕES 45.6% · 24 BRD - OLIMAQUINAS TRATORES 31.1% · 16 BB - M.A.S MAQUINAS 11% · 17 BB - OLIMAQUINAS SOLUÇÕES 4.4% [A027]
- **Titulo:** 4 BOLETO 88.3% · 34 TED 10.6% · 0 <SEM TIPO DE TITULO> 0.7% · 9 PIX 0.3% [A028]

### 1601 — DESPESAS BANCÁRIAS 

- **Configuração:** TIPMOV I · ativa S · atualiza financeiro 0 (I) · estoque N · livro fiscal N · contabilidade N · NF-e M · financeiro de origem N · 2 versões (1998-01-01 a 2025-02-27)
- **Uso:** 493 documentos, 493 títulos, 7 empresas, 5 parceiros, R$ 290.594; mediana do título R$ 50; origem nota 0 · financeiro 493 · outra 0
- **Operação real:** Débito automático / tarifa 100%
- **Natureza:** 1071100 PEDAGIO 29.4% · 1101200 IOF 23.1% · 1101800 IR  S/ RECEITAS FINANCEIRAS 23.1% · 1100100 TARIFAS BANCARIAS 14.6% [A025]
- **Centro:** 205001 ADMINISTRATIVO / FINANCEIRO TODAS AS LOJAS 60% · 105100 ADMINISTRATIVO VALMAQUINAS PATROCINIO 11.4% · 105200 ADMINISTRATIVO  OLIMAQUINAS SOLUCOES PATROCINIO 8.7% · 105500 ADMINISTRATIVO  LIDON MAQUINAS PATROCÍNIO 6.3% [A026]
- **Conta:** 26 SCB - OLIMAQUINAS SOLUÇÕES 37.1% · 25 SCB - VALMAQUINAS 6.3% · 35 BB - VALMAQU. APLICAÇÃO 4.9% · 17 BB - OLIMAQUINAS SOLUÇÕES 4.5% [A027]
- **Titulo:** 6 DEBITO AUTOMATICO 99.8% · 4 BOLETO 0.2% [A028]

## 4. Recomendações sobre TOP por tipo de documento

Cada recomendação traz evidência, ocorrências, grau de confiança, risco e responsável. Nenhuma foi aplicada.

| Tipo | TOPs observadas (documentos) | Cobertura da 1ª | Confiança | Risco | Responsável |
|---|---|---:|---|---|---|
| Nota fiscal de entrada | 1404 COMPRA - SERVICO (SEM RETENCAO) (2951); 1403 COMPRA - USO/CONSUMO (2391); 1419 COMPRA - REVENDA PECAS (1276); 1426 COMPRA - PECAS ENTRE LOJAS/ SEM PEDIDO (1101) | 25.2% de 11693 | BAIXA | Nota com TOP errada atualiza estoque, livro fiscal e custo de forma errada. | Fiscal + Contabilidade |
| Boleto | 1112 LANCAMENTOS FINANCEIROS (1474); 1600 DESPESAS DIVERSAS (50); 1609 DESPESAS DE TRIBUTOS (18); 1650 RECEITAS DIVERSAS (16) | 94.6% de 1558 | ALTA | TOP financeira genérica; natureza e centro passam a depender do fornecedor. | Financeiro + Contabilidade |
| Guia tributária | 1609 DESPESAS DE TRIBUTOS (1032); 1600 DESPESAS DIVERSAS (25); 1112 LANCAMENTOS FINANCEIROS (9); 1602 ADIANTAMENTO A FORNECEDOR - DESPESA (1) | 96.7% de 1067 | ALTA | Tributo classificado em TOP de despesa comum perde a visão de impostos. | Fiscal |
| Folha de pagamento | 1607 LANCAMENTO FINANCEIRO - CT-E (1052); 1602 ADIANTAMENTO A FORNECEDOR - DESPESA (11); 1652 ADIANTAMENTO A FORNECEDOR - RECEITA (7); 1112 LANCAMENTOS FINANCEIROS (1) | 98.1% de 1072 | ALTA | A TOP usada hoje tem nome de CT-e; padronizar sem decisão replica a confusão. | RH + Contabilidade |
| Encargos de folha (INSS, FGTS, IRRF) | 1112 LANCAMENTOS FINANCEIROS (1) | 100% de 1 | ALTA | Encargo é guia, não folha: decide se vira tipo próprio ou entra em Guia de Imposto. | RH + Fiscal |

## 5. Fornecedores com histórico [A030 e seguintes]

- 3557 pares empresa × fornecedor com título no período; 1359 com 3 ou mais documentos.
- Consistentes (≥ 3 documentos e ≥ 70% no mesmo código): natureza 849, centro 952, conta 1242, tipo de título 1161.
- Detalhe por fornecedor em `matriz-fornecedores.csv`; dispersões em `divergencias-classificacao.csv`.

## 6. Duplicidades e cadastro

| Achado | Ocorrências | Evidência |
|---|---:|---|
| Títulos com mesmo parceiro, número, vencimento e valor em documentos diferentes | 95 | A131 |
| Mesma linha digitável em documentos diferentes | 74 | A132 |
| Mesma chave de NF-e em mais de uma nota | 0 | A133 |
| Mesmo número e série de nota do mesmo parceiro | 0 | A134 |
| CNPJ/CPF em mais de um parceiro ativo (entre os pagos) | 85 | A124 |
| Pares empresa × fornecedor: sem CNPJ/CPF · inválido · sem marca de fornecedor · inativo · transferência sem banco/PIX | 0 · 0 · 216 · 0 · 1048 | A122 |

Detalhe em `duplicidades-inconsistencias.csv`. Os números são sinais para conferir, não duplicidade confirmada.

## 7. Centro de resultado e empresa [A130]

Convenção observada: o final do código do centro coincide com a empresa em 23295 documentos, aponta para outra empresa do grupo em 1000 e não segue a convenção em 2535. A convenção é forte o bastante para marcar exceções como divergência (tipo CENTRO_DE_OUTRA_EMPRESA). É uma hipótese tirada do padrão de códigos; a Controladoria confirma.
