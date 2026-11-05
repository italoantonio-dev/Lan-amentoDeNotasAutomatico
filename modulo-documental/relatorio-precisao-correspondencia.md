# Relatório de precisão: motor de correspondência NF-e × pedido

Gerado por `backend/correspondencia/avaliar-historico.mjs`. Somente leitura no Sankhya: 117 consultas (`registro-consultas-correspondencia.md`).

**Piloto:** pedidos TOP 1314 e notas TOP 1419 e 1420. **Período das notas:** 01/11/2025 a 31/10/2026.

## Resumo

| Medida (cenário principal) | Resultado |
|---|---|
| Notas avaliadas, todas com o XML real | 2254 |
| Quando o motor afirma o pedido sem dúvida, ele acerta | **1474 de 1477 (99,8%)** |
| O pedido verdadeiro está entre os candidatos | **2225 de 2245 (99,1%)** |
| Notas que ficam para uma pessoa escolher (ambíguas) | 752 (33,5%) |
| Notas sem vínculo que receberam candidato falso | 1 de 9 |

O motor é preciso quando afirma, mas **um terço das notas depende de escolha humana**, porque o mesmo produto tem saldo em mais de um pedido. E a cobertura medida depende do de-para atual: veja o cenário pessimista e as limitações, que são a parte mais importante deste relatório.

## Método

- **Documento:** o XML real de cada NF-e recebida, guardado no portal de XML do Sankhya (`TGFIXN`). Cobertura de 2254 de 2254 notas.
- **Gabarito:** o vínculo que o Sankhya registrou entre a nota e o pedido (`TGFVAR`).
- **Pedidos como estavam quando a nota entrou:** só pedidos já existentes (`NUNOTA` menor que o da nota), com o saldo descontado apenas das notas anteriores.
- **Mesma base para ajustar e medir:** os ajustes feitos no motor durante a avaliação estão na seção 10. O motor não tem pesos nem limiares ajustados, mas a ordem de apresentação foi escolhida com estes mesmos dados, então o índice "1º da lista" é otimista. Não foi separado um período só para teste.

## 1. Resultado por nota (cenário principal)

| Situação | Notas com gabarito | % | Significado |
|---|---:|---:|---|
| PEDIDO_UNICO | 1474 | 65,7% | Todos os itens em um único pedido |
| MULTIPLOS_PEDIDOS | 3 | 0,1% | Cada item com um pedido, em mais de um pedido |
| AMBIGUO | 752 | 33,5% | Algum item cabe em mais de um pedido |
| PARCIAL | 2 | 0,1% | Parte dos itens sem pedido |
| SEM_PEDIDO | 14 | 0,6% | Nenhum item com saldo em pedido |
| PRODUTOS_NAO_IDENTIFICADOS | 0 | 0,0% | Nenhum item identificado |

Notas sem vínculo com pedido TOP 1314 (9): SEM_PEDIDO: 8; PARCIAL: 1.

**Afirmações erradas (3):** nota 79802: o motor apontou 71476; o vínculo final é 81234; nota 89863: o motor apontou 60117; o vínculo final é 89880; nota 133307: o motor apontou 116648; o vínculo final é 133330. Em todas, o pedido do vínculo final foi criado **depois** da nota, e o motor apontou um pedido anterior com saldo do mesmo produto.

**Pedido verdadeiro fora dos candidatos (20):** pedido criado depois da nota: 15; pedido fora do período lido: 5. Pedido criado depois da nota não existe no momento da conferência: é um fato do processo, não um erro de comparação.

## 2. Cenários

| Cenário | Notas | Com gabarito | Gabarito entre os candidatos | Afirmou sem dúvida | Acertos ao afirmar | Ambíguas | Ambíguas: gabarito entre os candidatos | Ambíguas: gabarito é o 1º da lista |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Principal: de-para de hoje; item cortado segue pendente | 2254 | 2245 | 99,1% | 1477 (65,8%) | 1474 de 1477 (99,8%) | 752 (33,5%) | 99,6% | 94,0% |
| Otimista: item cortado já estava fechado | 2254 | 2245 | 98,5% | 1583 (70,5%) | 1578 de 1583 (99,7%) | 619 (27,6%) | 99,5% | 94,7% |
| Últimos 6 meses, de-para de hoje (base de comparação) | 1150 | 1147 | 99,0% | 711 (62,0%) | 710 de 711 (99,9%) | 426 (37,1%) | 99,5% | 94,6% |
| Últimos 6 meses, **de-para pessimista** | 1150 | 1147 | 73,6% | 329 (28,7%) | 328 de 329 (99,7%) | 395 (34,4%) | 99,5% | 94,7% |

- **Item cortado:** 440 itens de pedido estão hoje não pendentes com saldo (corte de resíduo), sem data conhecida. Os dois primeiros cenários são os limites: a operação real fica entre eles.
- **De-para pessimista:** só vale o par fornecedor-código já visto em nota anterior do período. É um piso: conta como desconhecido até par que já existia antes de 11/2025. Nele, 25,9% dos itens ficam sem identificação e a cobertura cai para 73,6%, mas **a precisão ao afirmar se mantém (99,7%)**: sem de-para, o motor diz "não identificado" em vez de errar.

## 3. Por TOP da nota (cenário principal)

| TOP | Com gabarito | Candidatos | Afirmou sem dúvida | Acertos | Ambíguas | 1º da lista |
|---|---:|---:|---:|---:|---:|---:|
| 1419 | 1279 | 98,8% | 922 | 919 (99,7%) | 347 | 92,5% |
| 1420 | 966 | 99,5% | 555 | 555 (100,0%) | 405 | 95,3% |

## 4. Identificação do produto

Itens do XML: 13901; alinhados ao item da nota pelo número do item: 13831 (2249 de 2254 notas têm o mesmo número de itens no XML e no ERP).

| Fonte | Itens | Produto certo | Produto errado | Vários produtos, com o certo | Vários produtos, sem o certo |
|---|---:|---:|---:|---:|---:|
| De-para do Sankhya (TGFPAP) | 13831 | 10134 | 0 | 3696 | 1 |

Medido **sem o de-para**, para saber se dá para confiar nas outras fontes:

| Fonte alternativa | Itens | Produto certo | Produto errado | Código com vários produtos | Uso no motor |
|---|---:|---:|---:|---:|---|
| Referência do fornecedor (`REFFORN`) | 2818 | 2130 | 611 (21,7%) | 77 | Só sugestão visível; não decide |
| Referência do produto (`REFERENCIA`) | 127 | 48 | 79 (62,2%) | 0 | Não usada |
| GTIN contra a referência | 25 | 0 | 25 (100,0%) | 0 | Não usada |

**Evidência para aprovação (A-08):** a sugestão por referência do fornecedor acerta 2154 de 2818 (76,4%) sozinha, e 2138 de 2174 (98,3%) quando também existe linha pendente daquele produto em pedido do fornecedor. O motor não usa isso para decidir; é uma regra que Compras pode avaliar.

## 5. Item → pedido

Itens com um único pedido candidato e com gabarito: 10836; pedido certo em 10831 (99,95%).

## 6. Divergências observadas no histórico (evidência para A-04, sem tolerância aplicada)

Comparação da NF-e com a linha verdadeira do pedido, em 13486 linhas.

**Preço unitário** (9204 linhas de mesma unidade):

| Diferença | Linhas | % |
|---|---:|---:|
| igual | 5707 | 62,0% |
| até R$ 0,01 | 2900 | 31,5% |
| até 1% | 125 | 1,4% |
| de 1% a 5% | 85 | 0,9% |
| acima de 5% | 387 | 4,2% |

Toda diferença é mostrada como divergência. Decidir a partir de quanto ela importa é de Compras e Fiscal; a faixa "até R$ 0,01" sozinha é 31,5% das linhas, então essa decisão muda muito o volume de alertas.

**Unidade:** a unidade da NF-e difere da do pedido em 4282 linhas (31,8%). Nessas linhas, a quantidade coincide com o saldo em 4183 (97,7%), o que sugere nomes diferentes para a mesma unidade, sem que isso esteja comprovado. Pares mais comuns (NF-e → pedido): UN -> PC (1981); PC -> UN (981); EA -> UN (192); PEC -> PC (169); EA -> PC (153); UND -> UN (142); PEC -> UN (62); UND -> PC (57); BB -> UN (51); UN -> MT (50); BB -> BD (41); GL -> UN (39). **O motor não converte nem trata como iguais:** sinaliza e não compara a quantidade (pendência A-16).

**Quantidade:** acima do saldo em 8 linhas; atendimento parcial (sobra saldo depois da nota) em 214 linhas; 23 notas atenderam pedido que já tinha faturamento anterior.

## 7. Notas ambíguas: evidência para A-07, sem regra aplicada

Em 752 notas ambíguas (mediana de 3 candidatos, 90% com até 7, máximo 29):

| Critério, se fosse adotado | Acerta |
|---|---:|
| Pedido mais recente | 557 (74,1%) |
| Pedido mais antigo | 86 (11,4%) |
| Único pedido que cobre todos os itens (existe em 500 notas) | 491 (98,2%) |
| Primeiro da lista de apresentação | 707 (94,0%) |

Mesmo o melhor critério erraria. Por isso a nota continua ambígua até Compras aprovar uma regra (A-07).

## 8. Saldo oficial do pedido (evidência para V-05)

Em 29694 itens de pedido: `QTDENTREGUE` é igual à soma de `TGFVAR.QTDATENDIDA` em 29692 (99,99%); `PENDENTE = 'S'` sem saldo em 1; `PENDENTE = 'N'` com saldo em 440 (corte de resíduo). A leitura usada pelo motor (`QTDNEG - QTDENTREGUE`, zerada quando `PENDENTE = 'N'`) é consistente com os dados, mas ainda precisa da confirmação de Compras e TI.

## 9. Limitações, sem as quais os números enganam

1. **O de-para de hoje pode ter sido criado por estas mesmas notas.** A `TGFPAP` não tem data. 5101 de 13831 itens (36,9%) são a primeira ocorrência do par fornecedor-código no período, e esse é o teto do que poderia não estar cadastrado quando a nota chegou. O resultado real na chegada da nota fica entre o cenário principal e o pessimista, e **só a operação assistida vai medir isso** (V-20).
2. **O gabarito é o que a equipe fez**, que pode conter erro; não é uma verdade independente.
3. **O saldo foi reconstruído pela ordem de `NUNOTA`.** A data de corte de resíduo é desconhecida.
4. **Precisão não autoriza automação.** "Afirmou sem dúvida" significa que há um único pedido com saldo, não que a nota esteja certa: preço, unidade e quantidade continuam a ser divergências a conferir.
5. **Só o piloto foi medido.** Nada aqui vale para outras TOPs.

## 10. Ajustes feitos no motor durante a avaliação

| O que a avaliação mostrou | Ajuste |
|---|---|
| Três CNPJs pertencem a dois códigos de empresa (299+200, 300+399, 500+599); o mapeamento simples perdia 251 notas | O motor passou a usar o conjunto de empresas do CNPJ. Erro do mapeamento, não prática do grupo |
| `REFERENCIA` e GTIN erram muito (seção 4) | Retiradas |
| `REFFORN` erra 21,7% sozinha | Virou só sugestão, que não decide |
| Empate pelo pedido mais antigo acerta só 11,4% | A apresentação passou a mostrar primeiro o mais recente. Muda só a ordem de exibição |
