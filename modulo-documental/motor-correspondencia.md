# Motor de correspondência NF-e × pedido de compra (Fases 1 e 2)

**Situação:** primeiro incremento implementado, publicado e medido em 04/11/2026. Aguarda revisão do Grupo Lidon.

**Escopo:** piloto de revenda de peças, pedido TOP 1314 e notas TOP 1419/1420. **Só consultas de leitura ao Sankhya.** Sem gravação, sem faturamento, sem confirmação, sem alteração de pedidos.

**Resultado medido:** ver `relatorio-precisao-correspondencia.md`. Em 2.247 NF-e reais, quando o motor afirma o pedido sem dúvida ele acerta 99,8%; o pedido verdadeiro está entre os candidatos em 99,2%; e um terço das notas fica para uma pessoa escolher. Esses números dependem do de-para atual: o cenário pessimista e as limitações estão no relatório.

---

## 1. Arquitetura

```
XML da NF-e ──► Leitor ──► Função conferirNfePedidos ──► Motor ──► Resultado ──► Telas, robô, assistente, agente
(tela ou arquivo            (permissão, empresa,          (puro: sem
 do lançamento)              consultas de leitura)         rede nem banco)
                                       │
                                       ▼
                              Porta única do ERP
                         (só serviço de consulta, só SELECT)
```

| Componente | Arquivo | Papel |
|---|---|---|
| Leitor de NF-e | `backend/robo/leitura.cjs` | Extrai cabeçalho e itens do XML. Passou a trazer código do fornecedor, GTIN, unidade, número do item e valor total |
| Motor | `backend/correspondencia/motor.cjs` | Compara e classifica. Sem rede, banco ou relógio: o mesmo código roda na função, nos testes e na avaliação histórica |
| Adaptador de leitura | `backend/sf/_correspondencia.js` | Monta as consultas ao ERP e trata o código vindo do XML como entrada hostil |
| Função de entrada | `backend/sf/conferirNfePedidos.js` | Confere a permissão, obtém o documento, chama o adaptador e o motor. Aceita o lançamento ou um XML |
| Permissão | função `podeConferirNfe` | Mesmo alcance por tipo de documento das telas |
| Telas | `frontend/src/pages/ConferenciaNfePage.tsx`, `components/ConferenciaPedidos.tsx`, card no detalhe do lançamento | Revisão humana. Não há nenhuma ação de gravar |
| Avaliação | `backend/correspondencia/historico.mjs`, `avaliar-historico.mjs` | Lê o histórico e gera o relatório de precisão |

**Consultas feitas ao Sankhya em cada conferência (no máximo 6, todas de leitura):**

| Consulta | Tabela | Para quê |
|---|---|---|
| Parceiros pelo CNPJ do emitente | `TGFPAR` | Fornecedor. Um CNPJ pode ter vários códigos de parceiro |
| De-para | `TGFPAP` | Código do fornecedor → produto do ERP |
| Referência do fornecedor | `TGFPRO.REFFORN` | Só sugestão visível |
| Pedidos com saldo dos produtos | `TGFCAB`, `TGFITE`, `TGFPRO` | Candidatos, com todos os itens de cada pedido |
| Vínculos | `TGFVAR`, `TGFCAB` | O que já foi faturado de cada pedido |
| Duplicidade | `TGFCAB`, `TGFIXN` | Mesma chave, mesmo número do mesmo fornecedor, XML já importado |

### O que o motor faz e o que não faz

- **Não aplica tolerância.** Toda diferença de preço aparece, com o valor. O único arredondamento é o técnico, de ponto flutuante (0,000001).
- **Não escolhe entre pedidos.** Se dois pedidos servem, a situação é `AMBIGUO` e os dois aparecem. A ordem da lista é só apresentação.
- **Não converte unidades.** Unidade diferente é sinalizada, e a quantidade não é comparada.
- **Não adivinha produto.** Só identificam o de-para do Sankhya ou um produto informado por pessoa. Não há comparação por descrição.
- **Não usa nenhuma regra fiscal.** A TOP só delimita o piloto.

### Situações

| Situação da nota | Significado |
|---|---|
| `PEDIDO_UNICO` | Todos os itens em um único pedido |
| `MULTIPLOS_PEDIDOS` | Cada item com um único pedido, em mais de um pedido |
| `AMBIGUO` | Algum item cabe em mais de um pedido: uma pessoa escolhe |
| `PARCIAL` | Parte dos itens sem pedido |
| `SEM_PEDIDO` | Nenhum item com saldo em pedido deste fornecedor para esta empresa |
| `PRODUTOS_NAO_IDENTIFICADOS` | Nenhum item com de-para |
| `SEM_EMPRESA`, `SEM_FORNECEDOR`, `SEM_ITENS` | Não dá para comparar |

Divergências por linha: `PRECO_DIFERENTE`, `QUANTIDADE_ACIMA_DO_PENDENTE`, `UNIDADE_DIFERENTE`.

Alertas: `JA_EXISTE_NO_ERP`, `PEDIDO_EM_OUTRA_EMPRESA`, `PRODUTO_AMBIGUO`, `LEITURA_CORTADA`, `EMPRESA_DIFERENTE_DO_LANCAMENTO`.

### O que foi pedido e onde aparece

| Pedido | Onde está no resultado |
|---|---|
| Pedidos candidatos | `pedidos`, com itens cobertos, com saldo e com preço igual |
| Empresa e fornecedor | `empresas` (um CNPJ pode ter vários códigos de empresa) e `parceiros` |
| Produtos correspondentes | `itens[].identificacao`: fonte e produto |
| Quantidades negociadas, entregues e pendentes | `itens[].linhas[]`: `negociada`, `entregue`, `pendente`, `saldoAposDocumento` |
| Preços e divergências | `precoPedido`, `precoDocumento`, `diferencaPreco`, `diferencaPrecoPct`, `divergencias` |
| Faturamentos parciais | `pedidos[].jaFaturadoParcialmente`, `saldoAposDocumento` |
| Vínculos entre pedidos e notas | `pedidos[].vinculos` (`TGFVAR`) |
| Ambiguidade | situação `AMBIGUO`, `itens[].pedidos`, `PRODUTO_AMBIGUO` |
| Duplicidade | `duplicidade`, alerta `JA_EXISTE_NO_ERP` |

### Segurança

- Toda consulta passa pela porta única, que só deixa sair o serviço de consulta com `SELECT`/`WITH`.
- O código e o número vindos do XML são limpos antes de entrar no SQL: só letras, números e `. _ / -`, nunca aspas.
- A função não grava neste sistema nem no ERP. Os testes conferem as tabelas antes e depois.
- O XML enviado na tela "Conferência de NF-e" é lido e descartado; não vira lançamento.
- O robô, ao ler uma nota, faz a mesma conferência e registra o resumo. Teto de 8 documentos por rodada (eram 10), porque a conferência aumenta o custo por documento e chamadas entre funções contam no limite por minuto.

## 2. Implementação incremental

| # | Incremento | Situação |
|---|---|---|
| 1 | Motor puro com casos de teste | ✅ |
| 2 | Avaliação histórica com NF-e real e gabarito da `TGFVAR` | ✅ |
| 3 | Função de conferência, adaptador e permissão | ✅ publicado |
| 4 | Tela de conferência avulsa e card no detalhe do lançamento | ✅ publicado |
| 5 | Robô, assistente e agente usando a conferência | ✅ publicado |
| 6 | Trilha de auditoria das conferências (quem conferiu, quando, com qual resultado) | Próximo; hoje a conferência não grava nada |
| 7 | Fila de revisão de notas pendentes de conferência | Próximo |
| 8 | Operação assistida: conferir notas reais na chegada, para medir o de-para real (V-20) | Próximo; é o que falta para fechar a medição |
| 9 | Regras de ambiguidade, tolerância e unidade | Depende de A-04, A-07 e A-16 |
| 10 | Faturamento do pedido, com a nota salva não confirmada | **Não autorizado.** Depende de V-01 a V-03, homologação e autorização explícita |

## 3. Casos de teste

**Motor** (`backend/_teste-motor-correspondencia.mjs`, offline, 39 verificações, todas passando):

| Caso | Esperado |
|---|---|
| Pedido único, tudo igual | `PEDIDO_UNICO`, sem divergência; negociada, entregue e pendente corretas |
| Faturamento parcial anterior | Pendente = negociada − entregue; pedido marcado, com o vínculo; saldo depois da nota |
| Preço com R$ 0,01 de diferença | `PRECO_DIFERENTE`, com valor e percentual: não há tolerância |
| Resto de ponto flutuante | Não é divergência |
| Quantidade acima do pendente | `QUANTIDADE_ACIMA_DO_PENDENTE` |
| Unidade diferente | `UNIDADE_DIFERENTE`; sem conversão e sem comparar quantidade |
| Dois pedidos com o mesmo produto | `AMBIGUO`, com os dois candidatos; no empate, o mais recente primeiro, e continua ambíguo |
| Cada item em um pedido diferente | `MULTIPLOS_PEDIDOS` |
| Sem de-para | `PRODUTOS_NAO_IDENTIFICADOS`, sem palpite por descrição |
| Parte dos itens com pedido | `PARCIAL` |
| Saldo só em outra empresa | Não é candidato; vira alerta |
| Pedido de outro fornecedor | Ignorado |
| Item cortado ou sem saldo | Não é candidato |
| Duplicidade | Vira alerta, e a análise continua |
| Dois parceiros com o mesmo CNPJ | Os dois são considerados |
| Fontes de identificação | De-para identifica; referência do fornecedor só sugere; GTIN e referência do produto não identificam; de-para de outro parceiro não vale; zero à esquerda não é removido; produto informado por pessoa vale |
| Sugestão com linha no pedido | Mostra a linha, mas não decide |
| Sem empresa, sem fornecedor | Para antes de comparar |
| Duas linhas do mesmo produto no mesmo pedido | `PEDIDO_UNICO`, com saldo somado |
| Pedido com outros itens pendentes | Ficam contados |
| CNPJ com dois códigos de empresa | Pedido em qualquer um é candidato |
| Código com dois produtos | Sem alerta se o pedido desfaz a dúvida; com alerta se não desfaz |
| Mesma entrada duas vezes | Mesma saída, e a entrada fica intacta |

**Conferência sem rede** (`_smoke-bloqueio-erp.mjs`, parte B): sem permissão recusa antes de ler o ERP; XML encontra o pedido pelo de-para; só leituras no ERP e só funções de leitura aqui; XML hostil (injeção de SQL em código e número) não escapa das aspas; pelo lançamento sem XML usa o produto informado; não grava nem com as duas travas ligadas em memória.

**Conferência ao vivo, com dados reais e só leitura** (parte D): um pedido pendente real é encontrado com as quantidades e o preço do ERP; uma nota real é apontada como duplicada pela chave; as tabelas `LANCAMENTOS`, `DOCUMENTOS`, `ERP_ENVIO` e `APROVADORES` terminam iguais.

**Regressão:** 8 suítes dos fluxos existentes passando, e `_smoke-aprovadores` **não** foi rodado, porque insere e apaga aprovadores de teste. Quando rodadas em sequência, as suítes podem esgotar o limite por minuto, e uma repetição do teste do robô acusa duplicidade: rodado isolado, ele passa.

## 4. Pendências para homologação futura

**Validação técnica (TI e Sankhya):**

| Código | Pergunta | Situação |
|---|---|---|
| V-01 | Qual serviço oficial fatura pedido de compra por API, e ele salva sem confirmar? | Aberta. Pré-requisito do faturamento |
| V-02 | O faturamento aceita itens e quantidades parciais e preserva a `TGFVAR`? | Aberta |
| V-03 | A nota criada por serviço fica não confirmada, com impostos como na interface? | Aberta |
| V-05 | Qual é o saldo oficial do item do pedido? | **Com evidência forte:** `QTDENTREGUE` = soma de `QTDATENDIDA` em 99,99% dos 29.694 itens. Falta a confirmação de Compras e TI |
| V-06, V-07 | Significado de `STATUSNOTA` e das colunas de tolerância da TOP | Aberta |
| V-08 | Existe base de homologação acessível? | Aberta. Pré-requisito de qualquer teste de gravação |
| V-11 | O Sankhya tem importação de XML com correspondência de pedido utilizável por API? | Aberta |
| V-13 | É possível um usuário de integração sem permissão de gravar e de confirmar? | Aberta. É a correção definitiva do V-17 |
| V-17 | Usuário business contorna a porta única? | **Aberta.** Para desenvolvedor, comprovado |
| V-18 | O serviço de consulta recusa comando de escrita? | Aberta. Só em homologação |
| V-19 | `TGFVOA` e `TGFPAP.UNIDADEPARC` servem de fonte oficial de unidade? | Aberta |
| V-20 | Quando a `TGFPAP` é alimentada? | Aberta. Define a cobertura real na chegada da nota: entre 74% e 99% |

**Aprovações de negócio (com a evidência já levantada):**

| Código | Área | Decisão | Evidência |
|---|---|---|---|
| A-01 | Fiscal | Relação TOP do pedido → TOP da nota | Piloto 1314 → 1419/1420 |
| A-04 | Compras + Fiscal | Tolerâncias de preço e quantidade | Preço: 62,0% igual; 31,5% até R$ 0,01; 1,4% até 1%; 0,9% de 1% a 5%; 4,2% acima de 5% |
| A-07 | Compras | Regra para vários pedidos candidatos | Único pedido que cobre todos os itens: 98,2%; mais recente: 74,2%; mais antigo: 11,5% |
| A-08 | Compras | Referência do fornecedor pode identificar? | 76,6% sozinha; 98,3% com linha pendente no pedido |
| A-12 | TI | Conexão de homologação e usuário sem permissão de confirmar | V-17 |
| A-16 (nova) | Compras + Fiscal | Equivalência de unidades | 31,8% das linhas com unidade diferente; quantidade coincide em 97,7% delas; pares UN/PC/EA/PEC/UND |
| A-17 (nova) | TI + Grupo Lidon | Segregação por empresa (D-02) | O sistema tem alcance por tipo de documento, **não por empresa**: hoje quem confere um XML vê pedidos de qualquer empresa. Precisa ser resolvido antes de abrir para mais usuários |

**Antes de habilitar o faturamento, no mínimo:** V-01, V-02, V-03, V-08 e V-13 respondidas com evidência em homologação, a bateria de testes da proposta sem falha e a autorização explícita. A confirmação continuará exclusivamente manual, no Sankhya.

## 5. Como rodar

```bash
cd backend
node _teste-motor-correspondencia.mjs            # casos de teste, offline
node _smoke-bloqueio-erp.mjs --vivo              # segurança e conferência ao vivo, só leitura
node _smoke-v17.mjs                              # sonda do V-17, só SELECT 1
node correspondencia/avaliar-historico.mjs       # avaliação histórica e relatório, a partir do cache
```

O cache da leitura fica em `backend/auditoria/.cache/`, fora do git, porque contém dado real do ERP. Apague a pasta para ler tudo de novo do Sankhya.
