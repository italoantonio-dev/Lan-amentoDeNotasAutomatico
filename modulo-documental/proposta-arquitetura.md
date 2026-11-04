# Módulo Inteligente de Entrada de Documentos — Proposta de Arquitetura (1ª entrega)

**Situação: proposta para aprovação. Nada foi implementado, alterado ou gravado.** O Sankhya foi apenas lido
(trava de `SELECT`/`WITH`, 13 consultas registradas em `registro-consultas.md`, números em `evidencias-tecnicas.md`).
A auditoria anterior (`../auditoria/`) é a outra base de evidência.

**Regra absoluta adotada em todo o desenho: o módulo nunca confirma nota.** Toda nota criada ou faturada fica não
confirmada; a confirmação é manual, por usuário autorizado, na interface do Sankhya.

### Legenda de comprovação

| Marca | Significado |
|---|---|
| ✅ | Comprovado neste ambiente, com evidência citada |
| 🟡 | Existe no projeto atual, mas nunca foi exercitado contra o ERP |
| 🔶 | Documentado pela plataforma ou pelo Sankhya, **não validado aqui** |
| ❓ | Pendência de validação técnica (código V-xx na seção 13) |
| ⛔ | Proibido pelo desenho |

---

## 1. Viabilidade técnica

**Conclusão: viável em etapas, com uma condição bloqueante para qualquer gravação** — falta um ambiente Sankhya de
homologação e a identificação, na documentação oficial da Sankhya, do serviço de faturamento de pedido. Sem os dois,
só é possível construir e operar a parte de **leitura, validação, classificação e correspondência**, sem gravar no ERP.

| Capacidade necessária | Situação | Evidência |
|---|---|---|
| Ler pedidos, notas, itens, vínculos e títulos do Sankhya | ✅ | Mais de 200 consultas de leitura bem-sucedidas pelo gateway (`DbExplorerSP.executeQuery`) na auditoria e nesta etapa |
| Identificar pedido de origem de uma nota | ✅ | `TGFVAR` (NUNOTA, SEQUENCIA, NUNOTAORIG, SEQUENCIAORIG, QTDATENDIDA) confirmada no dicionário e com dados: 6.389 notas ligadas a pedido no período |
| Calcular saldo do pedido | ✅ estrutura · ❓ semântica | `TGFITE` tem QTDNEG, QTDENTREGUE, QTDFAT, PENDENTE; `TGFCAB` tem PENDENTE. Qual coluna é o saldo oficial: V-05 |
| Ler XML de NF-e e CT-e, PDF textual, linha digitável | ✅ parcial | Motor de leitura atual (NF-e XML/PDF) e validador de linha digitável (97% das linhas do ERP válidas na amostra) |
| OCR de documento digitalizado | ✅ no navegador · ❓ no servidor | Tesseract roda no navegador; o ambiente das funções de servidor não tem OCR (V-09) |
| Faturar pedido existente gerando nota não confirmada | ❓ | Serviço oficial não identificado nem testado (V-01, V-02) |
| Criar nota direta não confirmada | 🟡 · ❓ | Código atual usa `CRUDServiceProvider.saveRecord`, **nunca executado**; se a nota nasce não confirmada é V-03 |
| Gravar título financeiro (boleto, guia) | 🟡 · ❓ | Mesmo serviço, nunca executado (V-04) |
| Rodar como tela dentro do Sankhya OM | 🔶 | Mecanismo Sankhya Pass documentado pela plataforma; exige cadastro do produto com a Sankhya (V-10) |
| Gravar só em ambiente de teste | ❓ bloqueante | A única conexão existente aponta para **produção** (V-08) |

## 2. Recursos nativos que poderão ser usados

### 2.1 No Sankhya (confirmados por leitura)

| Recurso | Uso no módulo | Situação |
|---|---|---|
| Pedido de compra (`TGFCAB.TIPMOV = 'O'`) e itens (`TGFITE`) | Fonte da correspondência | ✅ 11.478 pedidos no período; 4.737 marcados como pendentes hoje |
| Vínculo pedido→nota (`TGFVAR`) | Comprovar faturamento e preservar vínculo | ✅ |
| Situação da nota (`TGFCAB.STATUSNOTA`: A, L, P) | Conferir, depois de salvar, que a nota ficou não confirmada | ✅ estrutura · ❓ significado de cada letra no ambiente (V-06) |
| Provisão financeira (`TGFFIN.PROVISAO`) | Distinguir título provisório de definitivo | ✅ os 270 documentos na situação A (34 notas de compra e 236 pedidos) têm 224 títulos, todos de provisão, e nenhum título real |
| Configuração da TOP (`TGFTOP`): TIPMOV, EXIGECOTACAO, PERCTOLVARQTD, PERCTOLVARVLRUNIT, VALVARIACVLRUNIT, DESCONSIDPEDXML, PENDENTE | Regras por operação; tolerâncias | ✅ colunas existem · ❓ significado (V-07); as tolerâncias estão **vazias** nas TOPs de compra |
| Chaves e identificadores (`TGFCAB.CHAVENFE`, `CHAVECTE`; `TGFFIN.LINHADIGITAVEL`, `CODBARRA`, `NOSSONUM`, `EMVPIX`, `CHAVENFEGNRE`) | Duplicidade e conferência | ✅ |
| Importação de XML nativa do Sankhya (a coluna `DESCONSIDPEDXML` sugere que existe) | Possível caminho oficial para nota a partir de XML com pedido | ❓ V-11 — precisa ser investigada antes de construir o faturamento por conta própria |
| Rotina de faturamento de pedido na interface do Sankhya | É o "processo oficial" exigido | Existe como prática (6.389 notas vindas de pedido) · ❓ equivalente por API (V-01) |

### 2.2 Na plataforma (Mitra)

| Recurso | Uso | Situação |
|---|---|---|
| Server Functions SQL, JavaScript e INTEGRATION | Motores e adaptador | ✅ em uso no projeto atual |
| Integração com o gateway do Sankhya (OAuth, slug `sankhya`) | Leitura e, no futuro, gravação | ✅ leitura |
| Arquivo privado + link temporário emitido por função | Guardar o original e exibir na conferência | ✅ prova em `INT_FILEACCESSLOG` (SERVER_FUNCTION) |
| Aplicação web publicada (React) | Central de processamento | ✅ |
| Função agendada (cron, mínimo 5 minutos) | Leitura de caixa, reconciliação | 🔶 documentado; não exercitado neste projeto |
| Agente de IA (Agent SDK) | Apoio à extração e explicação, nunca dado fiscal | 🟡 construído; não testado com IA real |
| Sankhya Pass (tela no menu do Sankhya OM, login automático) | Módulo "interno" | 🔶 documentado pela plataforma; não exercitado |
| Perfis e políticas de linha | Segregação de funções | ✅ perfis criados; políticas não usadas ainda |

## 3. Limitações técnicas identificadas

| # | Limitação | Efeito | Tratamento proposto |
|---|---|---|---|
| L-01 | Só há conexão com o Sankhya de **produção** | Impossível testar gravação sem violar "não gravar dados de teste em produção" | Bloqueante: conexão de homologação antes da fase 3 |
| L-02 | Limite de 300 execuções por minuto no projeto, **contando chamadas entre funções** | Lotes grandes podem travar as telas de todos | ✅ medido; orçamento de chamadas por documento e filas com teto |
| L-03 | O serviço de consulta do Sankhya devolve no máximo 5.000 linhas | Pesquisas amplas de pedido precisam de filtro | Consultar sempre por empresa + fornecedor + período |
| L-04 | O gateway ficou inacessível por cerca de 20 minutos durante a auditoria | Gravação pode ficar sem resposta | Estado INCERTO + reconciliação por leitura antes de qualquer nova tentativa |
| L-05 | Função de servidor tem teto de tempo de execução (300 s, documentado) | Lotes longos | Processamento documento a documento, em fila |
| L-06 | Sem OCR no servidor | Documento digitalizado vindo por e-mail não é lido sem pessoa | OCR no navegador na fase inicial; serviço de OCR no servidor é V-09 |
| L-07 | NFS-e não tem chave de 44 dígitos e o padrão varia por município | 4.632 documentos no período; o leitor atual daria no máximo 60 pontos | Leitor próprio por padrão (nacional ou municipal), V-12 |
| L-08 | Sankhya Pass: usuário entra sem perfil; credencial do agente de IA não carrega o cliente; tela aparece no menu de todos os clientes do Sankhya | Funções podem ser recusadas no primeiro acesso | Perfil padrão por rotina agendada (documentado pela plataforma) |
| L-09 | Tolerâncias de variação nas TOPs estão vazias | Sem regra oficial de quanto preço/quantidade pode divergir do pedido | Decisão de Compras/Fiscal (A-04) |
| L-10 | O módulo atual cria nota **independente** pelo serviço genérico de gravação e pode enviar sozinho pelo robô | Violaria a regra de pedido | Contenção na fase 0 (hoje não há parâmetro nem envio: `ERP_ENVIO` vazio) |

## 4. Serviços oficiais necessários

O módulo terá uma **lista permitida** (allowlist) de serviços no adaptador: só o que estiver nela é chamado. Não há lista de bloqueio; qualquer serviço fora da lista é recusado antes de sair.

| Necessidade | Serviço | Situação | O que falta |
|---|---|---|---|
| Consultas | `DbExplorerSP.executeQuery` | ✅ | — |
| Faturar pedido de compra existente, gerando nota de entrada **sem confirmar** e preservando `TGFVAR` | A identificar na documentação oficial da Sankhya para a versão do cliente | ❓ V-01 | Nome, parâmetros, se aceita "não confirmar", se aceita faturamento parcial, o que grava em `TGFVAR` |
| Ajustar a nota faturada (quantidades, preços, itens) antes de salvar | A identificar | ❓ V-02 | Se o faturamento aceita itens/quantidades parciais na mesma chamada |
| Criar nota direta (operação sem pedido) não confirmada | `CRUDServiceProvider.saveRecord` (entidades `CabecalhoNota` e `ItemNota`) | 🟡 · ❓ V-03 | Confirmar que nasce não confirmada, que calcula impostos como a interface e que respeita as regras da TOP |
| Criar título financeiro (boleto, guia) | `CRUDServiceProvider.saveRecord` (entidade `Financeiro`) | 🟡 · ❓ V-04 | Comportamento de provisão; se precisa de nota de origem |
| Importação de XML pelo próprio Sankhya | A identificar | ❓ V-11 | Se existe por API e se faz a correspondência com pedido |
| Confirmar nota | — | ⛔ | Nenhum serviço de confirmação entra na lista permitida. Recomendação adicional: o usuário de integração no Sankhya **sem permissão de confirmar** (V-13) |

**Não foram usados nomes de serviço não comprovados.** O documento original do projeto relata que `CACSP.incluirNota` e `DatasetSP.load` não existiam neste gateway; isso também não foi verificado aqui e entra em V-01.

## 5. Estratégia de migração do projeto externo

**Suposição registrada:** o "projeto externo" é a aplicação atual deste projeto (leitura, classificação, alçada e envio), que roda fora do Sankhya. Se for outro sistema, a estratégia é a mesma, mas o inventário da tabela abaixo precisa ser refeito para ele (D-01).

1. **Envolver, não reescrever (padrão de substituição gradual).** Os motores viram serviços com contrato estável; a nova central chama os mesmos motores. Uma regra existe em um lugar só.
2. **Reaproveitar o que já está provado:**

| Componente atual | Destino | Ajuste necessário |
|---|---|---|
| Leitura de XML/PDF da NF-e (`backend/robo/leitura.cjs`) | Motor documental | Separar "extração" de "pontuação"; registrar origem de cada campo |
| Validadores de CNPJ, CPF, chave e linha digitável (`backend/auditoria/validacoes.mjs`, `leitura.cjs`) | Motor documental | Acrescentar arrecadação (48 dígitos), PIX (CRC16) e CT-e (modelo 57) |
| OCR no navegador (`frontend/src/lib/ocr.ts`) | Motor documental | Mantido até existir OCR no servidor |
| Classificação por histórico (`backend/sf/_lancamento.js`) | Motor de regras | TOP deixa de vir só do parâmetro: passa a vir da regra aprovada e do pedido (TOP do pedido → TOP da nota) |
| Duplicidade local e no ERP, escolha de parceiro, reserva de envio (`backend/sf/enviarLancamentoParaErp.js`) | Adaptador Sankhya | Reescrever a gravação: lista permitida, faturamento de pedido, idempotência com reconciliação, conferência de STATUSNOTA depois de salvar |
| Trilha (`LOG_EXECUCAO`) e auditoria somente leitura (`backend/auditoria/`) | Auditoria | Evolui para o modelo da seção 7 |
| Destino "NOTA" do envio atual e envio automático do robô | — | **Desativar** (fase 0) até o adaptador novo existir |

3. **Modo sombra antes de gravar:** o módulo processa os documentos reais, sugere tudo e compara com o que o time lançou de fato no Sankhya, sem gravar. Só avança quando a acurácia medida for aprovada.
4. **Uma empresa, uma operação de cada vez** (seção 10).

## 6. Arquitetura proposta

```
 Canais (upload, e-mail, chat)
          │
 ┌────────▼─────────┐   ┌──────────────────┐   ┌───────────────────────┐
 │ 1 Interface      │──▶│ 2 Motor          │──▶│ 3 Motor de regras     │
 │   (central)      │   │   documental     │   │   (classificação)     │
 └────────┬─────────┘   └──────────────────┘   └──────────┬────────────┘
          │                                               │
          │             ┌──────────────────┐   ┌──────────▼────────────┐
          │             │ 6 Auditoria e    │◀──│ 4 Correspondência     │
          │             │   monitoramento  │   │   de pedidos          │
          │             └────────▲─────────┘   └──────────┬────────────┘
          │                      │                        │
          └──────────────────────┴──────────┬─────────────┘
                                   ┌────────▼────────┐
                                   │ 5 Adaptador     │  único ponto de escrita
                                   │   Sankhya       │  lista permitida · nunca confirma
                                   └────────┬────────┘
                                            ▼
                                   Sankhya (gateway oficial)
```

| Componente | Responsabilidade | Onde roda | Regras-chave |
|---|---|---|---|
| 1 Interface interna | Central de processamento, conferência, exceções, regras | Aplicação publicada; dentro do Sankhya OM via Sankhya Pass (🔶) | Nenhuma decisão de acesso no navegador |
| 2 Motor documental | Extração determinística: XML → campos; PDF textual; OCR; linha digitável; arrecadação; PIX; NFS-e | Funções de servidor + navegador (OCR) | **Cada campo guarda a origem** (XML, texto rotulado, OCR, heurística, IA). Campo de IA nunca é dado fiscal: só sugestão, sempre "conferir" |
| 3 Motor de regras | Empresa, parceiro, tipo, TOP, natureza, centro, conta, título | Funções de servidor + tabelas de regra | TOP vem de **regra aprovada** e da TOP do pedido; frequência é evidência, não decisão |
| 4 Correspondência de pedidos | Busca pedidos pendentes da empresa e do fornecedor, casa itens, mede saldo e divergência | Funções de servidor, leitura no Sankhya | Consulta sempre filtrada; nunca altera pedido |
| 5 Adaptador Sankhya | Única peça que grava no ERP | Função de servidor | Lista permitida; idempotência; reconciliação; leitura de conferência depois de salvar (STATUSNOTA não confirmado e vínculo em `TGFVAR`); **nunca** confirma, exclui ou altera cadastro |
| 6 Auditoria e monitoramento | Eventos imutáveis, tentativas, tela de integração | Tabelas do projeto | Registro antes e depois de cada chamada ao ERP |

**Máquina de estados do documento:**
`RECEBIDO → EXTRAIDO → VALIDADO → CLASSIFICADO → CORRESPONDIDO | SEM_PEDIDO → PRONTO → GRAVANDO → NOTA_NAO_CONFIRMADA`
com saídas `EXCECAO` (exige pessoa), `DUPLICADO`, `IGNORADO` (folha integrada, título gerado pelo ERP) e `INCERTO`
(falha de comunicação durante a gravação: só sai por reconciliação de leitura, nunca por nova tentativa cega).

**Idempotência e recuperação:**
1. Cada documento tem uma **chave de idempotência** (hash do conteúdo + empresa + tipo).
2. Antes de chamar o ERP, o adaptador grava a **intenção** (tentativa PREPARADA).
3. Depois da chamada, grava o resultado e o número devolvido.
4. Sem resposta, a tentativa vira INCERTA. O reconciliador **lê o Sankhya** pela chave fiscal; por empresa + parceiro + número + série; e pelo vínculo em `TGFVAR` com o pedido. Só libera nova tentativa se comprovar que a primeira não gravou.
5. Gravar um identificador do documento numa coluna da nota facilitaria a reconciliação. Isso depende de campo adicional no Sankhya (decisão da TI, V-14).

## 7. Modelo de dados (proposto, no banco do projeto)

Prefixo `MD_` para não colidir com as tabelas atuais. Datas como texto `AAAA-MM-DDTHH:MM:SS`.

| Tabela | Conteúdo | Chaves e regras |
|---|---|---|
| `MD_DOCUMENTO` | Documento recebido: canal, arquivo (key privada), hash, tipo detectado, empresa, parceiro, chave fiscal, número/série, valor, estado, chave de idempotência | Única por hash; única por chave fiscal quando houver |
| `MD_EXTRACAO` | Cada extração: método (XML, PDF, OCR, IA), versão do motor, campos em JSON com **origem e confiança por campo** | Histórico, nunca sobrescreve |
| `MD_VALIDACAO` | Cada validação: regra, resultado, detalhe, evidência | Uma linha por regra por extração |
| `MD_SUGESTAO` | Sugestão de classificação por campo: valor, origem (regra, histórico, pedido, IA), regra aplicada, aceita/alterada por quem | Alteração humana gera nova linha |
| `MD_REGRA` | Regras aprovadas e versionadas: escopo (empresa, TOP, fornecedor, operação), condição, ação, aprovada por, vigência | Só regra aprovada entra na decisão |
| `MD_REGRA_PEDIDO` | Exigência de pedido por empresa × operação/TOP; mapeamento TOP do pedido → TOP da nota; tolerâncias aprovadas | Aprovada por Compras e Fiscal |
| `MD_PEDIDO_CANDIDATO` | Pedidos encontrados para o documento: NUNOTA do pedido, pontuação, motivo, escolhido por | Leitura do Sankhya, sem gravar nele |
| `MD_CORRESPONDENCIA_ITEM` | Item do documento ↔ item do pedido: produto, quantidade, unidade, preço, saldo lido, divergência | Base da tela de comparação |
| `MD_DEPARA_PRODUTO` | Código do produto do fornecedor → CODPROD do Sankhya, aprovado | ❓ V-15: verificar se o Sankhya já guarda esse vínculo |
| `MD_TENTATIVA` | Cada chamada ao ERP: operação, serviço (da lista permitida), hash do pedido enviado, estado (PREPARADA, ENVIADA, GRAVADA, INCERTA, RECUSADA), resposta, NUNOTA/NUFIN, STATUSNOTA lido depois | Base da idempotência |
| `MD_EVENTO` | Auditoria imutável: documento, quem, quando, ação, antes/depois, regra, tentativa | Só inserção |
| `MD_LOG_IMPORTACAO` | Execuções de leitura e reconciliação (exigido pelo guia de integração de dados) | Retenção definida com a TI |

As tabelas atuais (`DOCUMENTOS`, `LANCAMENTOS`, `LOG_EXECUCAO`, `ERP_ENVIO`) continuam até a migração terminar. Não serão apagadas sem aprovação.

## 8. Telas necessárias

| Tela | Conteúdo |
|---|---|
| Central de processamento | Upload e canais; lista com estado, tipo, empresa, fornecedor, valor, pedido, nota gerada; filtros; contadores por estado |
| Detalhe do documento | Original lado a lado com os dados extraídos (origem e confiança de cada campo), validações, sugestões com a regra que as gerou, histórico, número da nota não confirmada e acesso a ela no Sankhya (❓ V-16: se o Sankhya aceita abrir uma nota por link) |
| Comparação pedido × documento | Pedidos candidatos, escolha, itens lado a lado (produto, unidade, quantidade, saldo, preço), divergências e tolerância aplicada |
| Fila de exceções | Documentos parados, motivo, quem resolve; correção e **reprocessamento seguro** (nova extração ou nova classificação, nunca regravação sem reconciliação) |
| Regras | Cadastro, versão, aprovação e vigência das regras e da exigência de pedido; quem aprovou |
| Monitor de integração | Leituras, tentativas, incertezas, reconciliações, falhas, tempos (exigido pelo guia de integração de dados) |
| Auditoria | Linha do tempo por documento e consulta por usuário, período, empresa |

## 9. Fluxos de exceção

| # | Situação | Ação do módulo | Quem resolve |
|---|---|---|---|
| E-01 | XML com estrutura inválida ou chave que não confere (dígito, UF, data, modelo, CNPJ do emitente) | Para em EXCECAO; usa PDF só como apoio | Fiscal |
| E-02 | Destinatário não é empresa do grupo | EXCECAO | Fiscal |
| E-03 | Fornecedor não cadastrado | EXCECAO; **não cria cadastro** | Cadastro |
| E-04 | Mais de um parceiro com o mesmo CNPJ (85 casos na auditoria) | Pede escolha; grava a escolha como regra só com aprovação | Cadastro / Compras |
| E-05 | Documento já existe (hash, chave, número + série + parceiro, linha digitável) | DUPLICADO, com referência ao existente | — |
| E-06 | Operação exige pedido e não há pedido | Bloqueia; não cria pedido | Compras |
| E-07 | Mais de um pedido compatível | Lista candidatos; pessoa escolhe | Compras |
| E-08 | Saldo do pedido insuficiente ou pedido já faturado | Bloqueia | Compras |
| E-09 | Preço ou quantidade fora da tolerância aprovada (8,9% dos itens hoje divergem em preço acima de 1%) | Bloqueia com a comparação | Compras |
| E-10 | Produto sem correspondência ou unidade diferente | Bloqueia; sugere de-para para aprovação | Compras / Cadastro |
| E-11 | Sem regra aprovada para a TOP | Bloqueia | Fiscal |
| E-12 | Falha de comunicação durante a gravação | INCERTO; reconciliação por leitura; nunca regrava às cegas | Automático + TI |
| E-13 | Sankhya recusou | Mensagem traduzida (tradutor atual), sem nova tentativa automática | Conforme a causa |
| E-14 | **Nota lida depois de salvar não está como não confirmada** | Alarme crítico, suspende o adaptador inteiro | TI + Fiscal |
| E-15 | Folha integrada (origem P) ou título gerado pelo próprio ERP (582 guias e 64 boletos na auditoria) | IGNORADO, com motivo | — |
| E-16 | Leitura com baixa confiança ou campo vindo só de IA | EXCECAO para conferência | Quem lançaria |
| E-17 | NFS-e de padrão não suportado | EXCECAO | Fiscal |
| E-18 | Limite de execuções do projeto atingido | Fila espera a janela; nada se perde | Automático |

## 10. Plano de implementação incremental

Cada fase só começa com a anterior aprovada. Nenhuma fase grava em produção sem a aprovação explícita dela.

| Fase | Entrega | Grava no Sankhya? | Critério de saída |
|---|---|---|---|
| 0 Contenção | Desativar no módulo atual o envio de nota e o envio automático do robô | Não | Aprovação desta proposta |
| 1 Validação técnica | Conexão de homologação; documentação oficial dos serviços; pendências V-01 a V-16 respondidas com evidência | Só em homologação | Relatório de validação aprovado pela TI |
| 2 Leitura e sugestão (modo sombra) | Central, motor documental, regras, correspondência de pedidos, auditoria; compara com o que o time lançou de fato | Não | Acurácia por campo e por tipo, aprovada por Fiscal e Compras |
| 3 Faturamento em homologação | Adaptador com lista permitida, faturamento de pedido, idempotência, reconciliação, conferência de STATUSNOTA | Só em homologação | Bateria de testes da seção 11 sem falha |
| 4 Piloto em produção | 1 empresa, 1 operação com pedido (sugestão: revenda de peças, TOP 1314 → 1419, 99,7% vinda de pedido), volume limitado, conferência manual de cada nota | Sim, notas não confirmadas | Período de piloto sem divergência |
| 5 Expansão | Demais operações com pedido; operações diretas autorizadas; CT-e; NFS-e; boletos e guias | Sim | Uma aprovação por operação |
| 6 Migração | Desligar os caminhos antigos; migrar histórico | — | Aprovação da TI |

## 11. Testes obrigatórios

| Grupo | Testes |
|---|---|
| Nunca confirmar | Lista permitida sem serviço de confirmação; varredura do código procurando chamadas fora da lista; leitura de STATUSNOTA depois de cada gravação em homologação; usuário de integração sem permissão de confirmar |
| Extração | Arquivos de referência por tipo (XML NF-e, XML CT-e, DANFE textual, digitalizado, NFS-e por padrão, boleto, guia, PIX) com o resultado esperado campo a campo; campo de IA sempre marcado como sugestão |
| Validadores | Chave (módulo 11 + UF + data + modelo + CNPJ), CNPJ/CPF, linha digitável de boleto e de arrecadação, fator de vencimento, valor embutido, CRC16 do PIX |
| Correspondência | Pedido único, vários pedidos, saldo parcial, pedido faturado, preço e quantidade no limite da tolerância, unidade diferente, produto sem de-para |
| Duplicidade e idempotência | Duplo clique, mesmo arquivo duas vezes, mesmo documento escaneado de novo, falha de rede **depois** de o Sankhya gravar (deve reconciliar, não regravar), falha **antes** de gravar |
| Segurança | Usuário sem permissão; segregação (quem lança não confirma); nada de cadastro, pedido ou exclusão alterados |
| Carga | Lote dentro do limite de execuções; fila sem perda ao atingir o limite |
| Ponta a ponta em homologação | Uma bateria por TOP habilitada, conferida pelo Fiscal |
| Modo sombra | Comparação com os lançamentos reais do período |

## 12. Dependências de aprovação

| Área | Decisões |
|---|---|
| **Fiscal** | A-01 Regras de TOP por operação, incluindo o de-para TOP do pedido → TOP da nota observado (1314→1419/1420, 1301→1401, 1304→1404/1405/1412, 1302→1403) · A-02 Tratamento da NFS-e · A-03 Critérios de bloqueio de XML e chave · A-04 Tolerâncias de preço e quantidade, junto com Compras · A-05 Quem confere e confirma as notas no Sankhya |
| **Compras** | A-06 Quais empresas e operações **exigem** pedido. Evidência: revenda 98–100% vinda de pedido; uso e consumo 19%; serviços 45–55%; TOPs "sem pedido" 1424, 1425 e 1426 · A-07 Regra para vários pedidos candidatos e para saldo parcial · A-08 De-para de produto do fornecedor |
| **Financeiro** | A-09 Boletos e guias: entram como título? Com provisão? · A-10 Tratamento de títulos gerados pelo ERP e da folha integrada · A-11 Alçada e quem aprova |
| **TI (Grupo Lidon e Sankhya)** | A-12 Conexão de homologação e usuário de integração sem permissão de confirmar · A-13 Serviços oficiais de faturamento e criação (V-01 a V-04) · A-14 Campo adicional para o identificador do documento (V-14) · A-15 Sankhya Pass: cadastro do produto e quem controla o acesso · A-16 Retenção e acesso aos logs |

### Decisões de desenho a confirmar (guia de produto dentro do Sankhya OM)

| # | Decisão | Proposta |
|---|---|---|
| D-01 | O "projeto externo" é este projeto ou outro sistema? | Supus que é este |
| D-02 | Modelo de dados | **Single-tenant** (um único cliente, Grupo Lidon); o guia recomenda multitenant para produto vendido a vários clientes, o que não é o caso |
| D-03 | Origem dos dados | API do Sankhya pelo gateway (já conectada); sem JDBC direto |
| D-04 | Terá agente de IA para o usuário final? | Só como apoio de leitura e explicação; nunca decide nem grava |
| D-05 | Quem decide quem entra pela tela do Sankhya | Lista de e-mails controlada pelo Grupo Lidon (segregação de funções) |
| D-06 | O produto já está cadastrado no Sankhya Pass? | Não; cadastro feito pela Sankhya, a pedido do desenvolvedor |

## 13. Pendências de validação técnica

| Código | Pergunta | Como validar | Responsável |
|---|---|---|---|
| V-01 | Qual serviço oficial fatura pedido de compra por API, e ele permite salvar sem confirmar? | Documentação oficial da Sankhya para a versão do cliente + teste em homologação | TI / Sankhya |
| V-02 | O faturamento aceita itens e quantidades parciais e preserva `TGFVAR`? | Homologação | TI |
| V-03 | `CRUDServiceProvider.saveRecord` em `CabecalhoNota` cria nota não confirmada, com impostos calculados como na interface? | Homologação, comparando com nota digitada à mão | TI + Fiscal |
| V-04 | Gravação de título (`Financeiro`) para boleto e guia: provisão, campos obrigatórios | Homologação | TI + Financeiro |
| V-05 | Qual coluna representa o saldo oficial do item do pedido (QTDNEG − QTDENTREGUE, QTDFAT, PENDENTE)? | Conferir com pedidos parcialmente faturados conhecidos | Compras + TI |
| V-06 | Significado de STATUSNOTA A, L e P no ambiente | Documentação + amostra conferida na interface | TI |
| V-07 | Significado de EXIGECOTACAO, PERCTOLVARQTD, PERCTOLVARVLRUNIT, VALVARIACVLRUNIT, DESCONSIDPEDXML e PENDENTE na TOP | Documentação Sankhya | TI |
| V-08 | Existe base de homologação acessível pelo gateway? | TI do cliente | TI |
| V-09 | OCR no servidor | Avaliar serviço de OCR por integração | TI |
| V-10 | Sankhya Pass para um único cliente | Time do Sankhya Pass | TI |
| V-11 | O Sankhya tem importação nativa de XML com correspondência de pedido utilizável por API? | Documentação + interface | TI + Fiscal |
| V-12 | Padrão de NFS-e dos municípios dos fornecedores (nacional ou municipal) | Amostra de documentos reais | Fiscal |
| V-13 | É possível tirar do usuário de integração a permissão de confirmar nota? | Configuração de acesso do Sankhya | TI |
| V-14 | Campo adicional na nota para o identificador do documento | TI do Sankhya | TI |
| V-15 | O Sankhya guarda o vínculo entre código do produto do fornecedor e CODPROD? | Dicionário + documentação | TI + Compras |
| V-16 | É possível abrir uma nota específica no Sankhya por link a partir da central? | Documentação / Sankhya Pass | TI |

---

**Aguardando aprovação da arquitetura.** Nenhum componente operacional será criado, nenhuma alteração será feita no
módulo atual e nada será gravado no Sankhya antes da aprovação explícita — começando pela fase 0 (contenção), que também
depende de autorização por mexer no comportamento do módulo atual.
