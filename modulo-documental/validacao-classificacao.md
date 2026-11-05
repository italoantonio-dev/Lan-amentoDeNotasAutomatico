# Validação retrospectiva da classificação do motor

Gerado por `backend/correspondencia/validar-classificacao.mjs` em 2026-11-05. Somente leitura no Sankhya (117 consultas registradas, a partir do cache). Piloto: pedido TOP 1314 → notas TOP 1419/1420.

**Desenvolvimento:** notas de 01/11/2025 a 30/06/2026. **Validação:** notas de 01/07/2026 a 31/10/2026. As regras foram escritas antes de rodar. Houve **um ajuste depois da primeira rodada**: a referência de pedido do XML deixou de rebaixar a nota, porque quase nunca coincide com o pedido do vínculo (1 de 7.076 itens em desenvolvimento). Os números de validação daquela rodada estavam visíveis no mesmo momento, então a validação não é totalmente cega a esse ajuste; ele só retira uma regra. O vínculo da própria nota (TGFVAR) nunca entra no motor; ele só é usado depois, como gabarito.

## Resultado (cenário principal: de-para de hoje, item cortado segue pendente)

| Medida | Desenvolvimento | Validação |
|---|---:|---:|
| Notas avaliadas (com XML) | 1456 | 798 |
| Com vínculo conhecido (gabarito) | 1449 | 796 |
| **Correspondência segura** (cobertura da automação) | 314 (21,7%) | 149 (18,7%) |
| **Precisão das seguras** | 313 de 314 (99,7%) | 149 de 149 (100,0%) |
| **Falsas correspondências** (segura com pedido errado) | 1 | 0 |
| Segura em nota sem vínculo com pedido | 0 de 7 | 0 de 2 |
| Ambíguas | 493 (34,0%) | 324 (40,7%) |
| Ambíguas com o pedido certo entre os candidatos | 99,8% | 99,4% |
| Incompatíveis | 637 (44,0%) | 314 (39,4%) |
| … só por preço ou unidade (sem tolerância aprovada) | 613 | 307 |
| Sem pedido | 5 | 9 |
| Pedido verdadeiro não encontrado entre os candidatos | 8 (0,6%) | 12 (1,5%) |
| Notas com divergência de preço | 639 | 345 |
| Notas com quantidade acima do saldo | 67 | 19 |
| Notas com unidade diferente | 708 | 376 |
| Notas com produto não identificado | 0 | 2 |
| Itens com referência de pedido no XML; confere com o vínculo | 7076; 1 (0,0%) | 3544; 2 (0,1%) |
| Tempo do motor por nota: mediana / p95 / máximo (ms) | 0.22 / 32.97 / 135.2 | 0.22 / 32.36 / 222.8 |

Falsas correspondências: nota 79802: motor 71476, vínculo 81234 (pedido do vínculo criado depois da nota).

## Cenários de sensibilidade (validação)

| Cenário | Seguras | Precisão | Falsas | Ambíguas | Não encontrados |
|---|---:|---:|---:|---:|---:|
| Principal | 149 (18,7%) | 100,0% | 0 | 324 | 12 |
| De-para pessimista (só par já visto antes da nota) | 68 (8,5%) | 100,0% | 0 | 304 | 209 |
| Item cortado já fechado | 166 (20,9%) | 100,0% | 0 | 253 | 13 |

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
