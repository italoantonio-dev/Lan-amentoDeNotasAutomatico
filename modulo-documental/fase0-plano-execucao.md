# Fase 0 — Contenção: plano de execução e resultado

**Situação:** implementada, publicada e testada em 04/11/2026. **Aguarda validação do Grupo Lidon.** As fases 1 e 2 só começam depois dessa validação.

**Resultado em uma linha:** hoje nenhum caminho do sistema grava no Sankhya. O envio de título, a criação de nota, a correção de cadastro e o envio automático do robô param antes de qualquer chamada ao ERP. Leitura, classificação, alçada e conferência continuam funcionando. Os testes automatizados (95 verificações) comprovam isso no código-fonte, no comportamento isolado, no código publicado e nas funções em produção.

**Fato verificado antes da Fase 0:** a tabela `ERP_ENVIO` tem 0 linhas e nenhum log de execução dos últimos 3 dias cita `saveRecord`. Ou seja, este sistema nunca gravou no Sankhya.

---

## 1. Escopo autorizado e decisões registradas

| Item | Situação |
|---|---|
| Fase 0: bloquear a criação independente de notas e o envio automático pelo robô | Autorizada com restrições e executada |
| Fases 1 e 2: estrutura, leitura, validação, classificação, correspondência de pedidos e revisão, **só com consultas** ao Sankhya | Autorizadas para desenvolvimento, **depois** da validação da Fase 0 |
| Fases 3, 4 e 5 | **Não autorizadas** |
| Gravação no ERP de produção | **Não autorizada.** A aprovação da arquitetura não vale como autorização |
| Regra permanente | O robô nunca confirma nota. A confirmação é manual, por usuário autorizado no Sankhya |

**D-01, confirmada pelo repositório.** O "projeto externo" é este projeto (`mitra-agent-projects/p-65898`, branch `main`). Os componentes citados na proposta estão nele:

| Componente | Onde fica |
|---|---|
| Motor de leitura de XML e PDF | `backend/robo/leitura.cjs` |
| Validações de CNPJ, CPF e linha digitável | `backend/auditoria/validacoes.mjs` |
| OCR no navegador | `frontend/src/lib/ocr.ts` |
| Núcleo de classificação e criação | `backend/sf/_lancamento.js` |
| Adaptador do ERP | `backend/sf/_erp.js` |
| Envio ao ERP | `backend/sf/enviarLancamentoParaErp.js` |
| Correção de cadastro | `backend/sf/corrigirCadastroErp.js` |
| Robô | `backend/sf/_robo.js` |

**D-02:** cliente único, Grupo Lidon, com segregação de dados, permissões e operações por empresa.
**D-05:** acesso restrito a usuários autorizados pelo Grupo Lidon. A lista de e-mails complementa a autenticação, a autorização e as permissões do Sankhya; não substitui nenhuma delas.

## 2. Pontos de entrada de gravação (inventário feito antes da mudança)

Toda gravação no Sankhya passava por **uma única função**, `erpSalvar` (serviço `CRUDServiceProvider.saveRecord`). O inventário procurou também caminhos que não passam por ela.

| # | Ponto | Onde (antes da Fase 0) | Quem acionava | O que gravava no Sankhya |
|---|---|---|---|---|
| P1 | `erpSalvar`, a porta de escrita | `sf/_erp.js:43-63` | as funções abaixo | qualquer entidade pedida |
| P2 | Envio de título | `enviarLancamentoParaErp` (SF 139), `:141` | tela de detalhe (`useEnvioErp.ts:17`), "Tentar novamente" (`PainelRecusaErp`), robô, agente de negócio, chamada direta à função | `Financeiro` (TGFFIN) |
| P3 | Criação de nota (cabeçalho e itens) | `enviarLancamentoParaErp`, `:180` e `:192` | os mesmos de P2 | `CabecalhoNota` (TGFCAB) e `ItemNota` (TGFITE) |
| P4 | Correção de cadastro | `corrigirCadastroErp` (SF 156), `:16` e `:28` | tela de recusa, só administrador (`PainelRecusaErp.tsx:53`) | `Parceiro` (TGFPAR): marcar fornecedor ou cliente, criar parceiro |
| P5 | Envio automático do robô | `sf/_robo.js:65` → P2/P3, em `roboVarrerEmails` (SF 174) | botão "Buscar agora", assistente, agente de negócio | o mesmo de P2/P3 |
| P6 | Instruções do agente de negócio | `add-agente-negocio.mjs:45` | agente do usuário final | expunha `enviarLancamentoParaErp` como ação |

**Caminhos conferidos que não gravam:**
- As 12 consultas de `erpConsulta` (só `SELECT`).
- As 7 funções de integração com SQL fixo (`sankhyaEmpresas`, `Tops`, `Naturezas`, `Centros`, `Contas`, `TiposTitulo`, `Usuarios`).
- As chamadas do robô à caixa de e-mail, só `GET` e em outra conexão.
- Os 3 scripts avulsos de leitura: `levantamento-parametros.mjs`, `auditoria/leitura.mjs` e `_smoke-parceiro-duplicidade.mjs`.

**Outras portas verificadas** (pela tabela da plataforma `INT_SERVERFUNCTION`, só leitura):
- Nenhuma função agendada.
- Nenhuma função disparada por evento de tabela.
- Nenhuma conexão JDBC além do banco do próprio projeto.
- Nenhum data loader e nenhuma ação de banco.
- A única função pública (`playground_publico`) não alcança o ERP.

## 3. Mecanismo de trava

São camadas independentes, e cada uma sozinha impede a gravação. Os testes provam isso desligando uma de cada vez em memória (seção 5, prova inversa).

| Camada | O que faz | Onde | Permanente ou pela trava geral |
|---|---|---|---|
| C1 Porta única | Toda chamada ao ERP passa por `erpChamar`. Serviço fora da lista (`DbExplorerSP.executeQuery`, `CRUDServiceProvider.saveRecord`) é recusado com `SERVICO_NAO_PERMITIDO` | `sf/_erp.js` | Permanente |
| C2 Trava geral | `const GRAVACAO_ERP_HABILITADA = false;` Serviço de escrita é recusado com `GRAVACAO_BLOQUEADA` **antes** de qualquer chamada de rede. Nenhum parâmetro de tela, de banco ou de entrada liga a trava | `sf/_erp.js` | É a trava geral |
| C3 Confirmação proibida | Serviço com "confirm" no nome é recusado com `CONFIRMACAO_PROIBIDA`, mesmo com a trava ligada | `sf/_erp.js` | **Permanente** |
| C4 Só leitura na consulta | A consulta só aceita `SELECT`/`WITH`, sem comando de gravação, `;` ou comentário (o texto entre aspas é ignorado na checagem) | `sf/_erp.js` | Permanente |
| C5 Nota proibida | Destino `NOTA` é recusado com `NOTA_PROIBIDA` no envio **e na conferência**: a nota nasce do pedido, no Sankhya | `enviarLancamentoParaErp.js` | **Permanente** |
| C6 Envio real recusado | Sem `simular`, a função recusa com `GRAVACAO_BLOQUEADA` antes de reservar ou consultar. Se ainda assim chegar à porta única, o lançamento **não** vira ERRO | `enviarLancamentoParaErp.js` | Trava geral |
| C7 Correção de cadastro recusada | Recusa antes de qualquer outra coisa, para qualquer usuário e ação | `corrigirCadastroErp.js` | Trava geral |
| C8 Robô só confere | O robô chama o envio sempre com `simular: 'S'`, valor fixo no código. Novos desfechos: `PRONTO` (conferido, pronto para uma pessoa) e `NOTA_PEDIDO` (nota segue pelo pedido, não é erro) | `sf/_robo.js`, `roboVarrerEmails.js` | **Permanente** (não depende da trava geral) |
| C9 Interface | Detalhe do lançamento: só "Conferir sem gravar". Correção de cadastro e "Criar parceiro" ficam ocultos. Textos da Caixa de entrada, da Ajuda e do Assistente corrigidos. Indicador "Lançados sozinhos" passa a "Prontos para conferência" | `frontend/src/...` | Pela constante da tela (o backend bloqueia de qualquer forma) |
| C10 Agente de negócio | Instruções dizem que a gravação está desligada e que o sistema nunca confirma nota. `enviarLancamentoParaErp` documentada como conferência | `lib/instrucoes-agente.mjs` | — |
| C11 Publicação | `fase0/aplicar.mjs` **recusa publicar** se a trava estiver ligada no código-fonte | `backend/fase0/aplicar.mjs` | — |

**Religar a gravação não está autorizado e não tem atalho.** Exige autorização escrita, uma mudança revisada na linha da trava e um procedimento novo de publicação na fase que autorizar escrita. O script atual se recusa a publicar a trava ligada.

## 4. Arquivos afetados

**Backend:**

| Arquivo | Mudança |
|---|---|
| `sf/_erp.js` | Porta única `erpChamar`, trava geral, lista de serviços, recusa de confirmação, checagem de SQL de leitura. `erpConsulta` e `erpSalvar` passam pela porta (o código de `erpSalvar` foi mantido) |
| `sf/enviarLancamentoParaErp.js` | `NOTA_PROIBIDA` e `GRAVACAO_BLOQUEADA` no início. A trava da porta única não marca ERRO. O trecho de nota foi mantido e comentado como inalcançável |
| `sf/corrigirCadastroErp.js` | Recusa no início. O código de correção foi mantido |
| `sf/_robo.js` | Sempre `simular: 'S'`; desfechos `PRONTO` e `NOTA_PEDIDO` |
| `sf/roboVarrerEmails.js` | Conta os `PRONTO` |
| `add-robo-email.mjs` | Indicador `PRONTOS`; descrição da varredura |
| `add-erp-envio.mjs`, `add-diagnostico-erp.mjs` | Descrições das funções |
| `add-agente-negocio.mjs` | Passa a ler as instruções de `lib/instrucoes-agente.mjs` (novo), com o texto corrigido |
| `fase0/snapshot.mjs`, `fase0/funcoes.mjs`, `fase0/aplicar.mjs`, `fase0/reverter.mjs` | Novos: cópia, definição, publicação e reversão |
| `fase0/antes/`, `fase0/depois/` | Novos: código publicado das 25 funções que tocam o ERP, antes e depois |
| `_smoke-bloqueio-erp.mjs` | Novo: testes de bloqueio |
| `_smoke-erp-nota.mjs`, `_smoke-robo.mjs`, `_smoke-erp.mjs`, `_smoke-diagnostico-erp.mjs`, `lib/smoke.mjs` | Testes antigos ajustados ao novo comportamento |

**Frontend:** `hooks/useEnvioErp.ts`, `pages/LancamentoDetalhePage.tsx`, `components/PainelRecusaErp.tsx`, `pages/CaixaEntradaPage.tsx`, `lib/ferramentas.ts`, `lib/guiaAjuda.ts`.

**Funções republicadas** (mesmo id, mesmo nome):
- As 16 funções JavaScript que carregam o adaptador do ERP: `enviarLancamentoParaErp`, `corrigirCadastroErp`, `roboProcessarAnexo`, `roboVarrerEmails`, `conferirCadastroErp`, `sankhyaParceiros`, `sankhyaParceiroPorCnpj`, `sankhyaParceiroPorCodigo`, `sankhyaPadroesLancamento`, `sankhyaPadraoFornecedor`, `resolverClassificacaoLancamento`, `criarLancamentoViaChat`, `sincronizarCadastrosSankhya`, `erpVerificarConexao`, `sankhyaProdutos` e `sankhyaCidades`.
- A função SQL `roboKpis`.
- O texto das instruções do agente.

**Dados:** a Fase 0 não criou, não alterou e não apagou tabela nem dado. Nada mudou no Sankhya: nenhuma configuração, nenhuma permissão, nenhum registro. A tabela `ZZ_PROBE` não foi tocada.

## 5. Testes de bloqueio

Comando: `cd backend && node _smoke-bloqueio-erp.mjs --vivo`. **Resultado em 04/11/2026: 95 de 95.**

| Parte | O que prova | Verificações |
|---|---|---|
| **A. Código-fonte** | A trava está desligada. O adaptador tem uma única saída de rede. Fora dele, só a caixa de e-mail chama integração, e só com `GET`. Nenhum serviço de gravação é citado fora do adaptador. Nenhuma tela chama integração direto. O robô confere sem gravar. Os scripts avulsos só consultam. Nenhum script religa a trava | 11 |
| **B. Comportamento isolado** | Roda o código **exato** das funções com um SDK falso, sem rede. Se uma trava falhasse, a gravação ficaria registrada no SDK falso e não iria a lugar nenhum. Casos cobertos: as quatro entidades de escrita; serviços de confirmação e serviços desconhecidos (`__proto__`, `constructor`); 12 SQLs de escrita, inclusive escondidos em comentário; envio real com entradas hostis (`simular: 'N'`, `simular: false`, `forcar`, `GRAVACAO_ERP_HABILITADA: true`); nota no envio e na conferência; as três ações de correção de cadastro; uma **rodada real do robô de ponta a ponta**, com caixa de e-mail falsa e o envio rodando por dentro; e as guardas da conferência preservadas (aprovação, revisão, rejeitado, sem classificação, já enviado) | 45 |
| **B. Prova inversa** | Com a trava ligada **em memória**, o teste enxerga a gravação: prova que o teste detecta. Sem a guarda do envio, a porta única ainda segura. A nota continua proibida e a confirmação continua recusada com a trava ligada. O robô não grava nem com a trava ligada | (dentro das 45) |
| **C. Publicado** | O código no ar é **byte a byte** o código testado em B (as 16 funções e `roboKpis`). Toda função com o adaptador tem a trava desligada. Nenhuma chama o ERP fora da porta única. As 7 integrações só leem. Pela tabela da plataforma: nenhum JDBC externo, nenhuma função agendada, nenhum gatilho de tabela, nenhuma função pública alcança o ERP | 32 |
| **D. Ao vivo** | As funções publicadas, com CNPJ fictício e entradas preparadas para que, **mesmo sem a trava**, parassem antes de gravar (parceiro inexistente, cidade não informada). Prova: envio real e envio hostil recusados; marcar fornecedor e criar parceiro recusados; lançamento sem mudança de situação e sem chave do ERP; `ERP_ENVIO` igual (0 linhas); a leitura do ERP segue respondendo (27 empresas) | 7 |

A parte D só roda se A, B e C passarem. Ela nunca executa contra código que não foi comprovado antes.

**Regressão (o que não podia quebrar):** todas as suítes passaram.

| Suíte | Resultado |
|---|---|
| `_smoke-erp` | OK |
| `_smoke-erp-nota` | OK |
| `_smoke-diagnostico-erp` | OK |
| `_smoke-parceiro-duplicidade` | OK |
| `_smoke-padrao` | OK |
| `_smoke-parametros` | OK |
| `_smoke-robo` | OK |
| `_smoke-permissoes` | OK |

Um ponto de `_smoke-erp` depende de quem roda ser aprovador. Com os aprovadores cadastrados hoje sem vínculo de login, a guarda de classificação não é exercitada ali. Ela é coberta na parte B.

**Build do frontend** concluído, sem erros de tipo.

## 6. Estratégia de reversão

**Cópia guardada:** em `backend/fase0/antes/` estão o código e a descrição publicados, em 04/11/2026 às 20:04 (UTC), das 25 funções que tocam o ERP, com `manifesto.json`. O estado novo fica em `backend/fase0/depois/`.

| Nível | Quando usar | Como | Religa a gravação? |
|---|---|---|---|
| R1 Só a tela | Um texto ou botão novo atrapalhou | `git revert` da parte de `frontend/` e `npm run build` | Não: o backend continua bloqueando |
| R2 Corrigir sem religar | Uma leitura ou conferência quebrou | Corrigir o fonte; `node _smoke-bloqueio-erp.mjs` (A e B); `node fase0/aplicar.mjs`; `node _smoke-bloqueio-erp.mjs --vivo` | Não |
| R3 Reversão total | Só com **autorização escrita** do Grupo Lidon para voltar a gravar | `node fase0/reverter.mjs --religa-gravacao-erp --autorizacao "<quem, quando, por qual meio>"` restaura as 17 funções alteradas a partir de `fase0/antes/` e registra a autorização em `fase0/reversoes.log`. Instruções do agente e telas voltam com `git revert` do commit da Fase 0 | **Sim** |

Sem os dois argumentos, `reverter.mjs` só lista o que restauraria e não altera nada. Como a Fase 0 não mudou dados, não há dado a restaurar. Os desfechos novos (`PRONTO`, `NOTA_PEDIDO`) são só valores novos numa coluna de texto, e as linhas antigas ficaram como estavam.

## 7. Riscos residuais e pendências

| # | Risco | Situação | Mitigação |
|---|---|---|---|
| R-01 | A biblioteca do navegador tem uma função para chamar integração direto (`callIntegrationMitra`). Em tese, um usuário autenticado poderia chamar a conexão `sankhya` sem passar pelas funções do sistema | Nenhuma tela faz isso (verificado na parte A). **Não validei** se a plataforma permite essa chamada a um usuário business. Entra como pendência **V-17** | A definitiva é **V-13 / A-12**: usuário de integração do Sankhya sem permissão de gravar ou confirmar. Não foi feita aqui, pela restrição de não alterar permissões do ERP |
| R-02 | Quem tem acesso de desenvolvedor ao projeto pode alterar o código das funções, inclusive a trava | Controle de acesso do projeto | Manter o acesso de desenvolvedor restrito. A parte C acusa qualquer diferença entre o publicado e o testado: rodar `_smoke-bloqueio-erp.mjs` a cada mudança e periodicamente |
| R-03 | Os perfis nas telas estão desligados no projeto: qualquer usuário do projeto pode executar qualquer função privada | As travas estão **dentro** das funções e valem para qualquer chamador | Nenhuma ação necessária para a Fase 0 |
| R-04 | A credencial OAuth do Sankhya mantém as permissões atuais no ERP | Não alterada, por restrição | V-13 / A-12 |

**Observação operacional, fora do escopo:** hoje foram cadastrados 2 aprovadores sem vínculo com um login do sistema. Enquanto houver aprovador ativo, só quem tem vínculo aprova, então nenhum lançamento acima do limite consegue ser aprovado agora. Os cadastros não foram alterados.

## 8. Validação pedida ao Grupo Lidon

1. Abrir um lançamento aprovado: o card mostra "Conferir para o ERP" e só o botão "Conferir sem gravar". A conferência mostra parceiro e campos, e diz que nada foi gravado.
2. Abrir um lançamento de nota fiscal: a conferência explica que a nota nasce do pedido, no Sankhya.
3. Na Caixa de entrada, conferir os textos e o indicador "Prontos para conferência".
4. Opcional, por quem tem acesso técnico: `cd backend && node _smoke-bloqueio-erp.mjs --vivo` deve terminar em "tudo certo".

## 9. Depois da validação: fases 1 e 2 (só leitura)

O primeiro incremento é o piloto de revenda de peças: a correspondência entre o pedido TOP 1314 e as notas TOP 1419/1420.

**Critérios de correspondência:** fornecedor, empresa, produtos, quantidades, preços, saldo pendente e vínculos na `TGFVAR`.

**O que fica de fora até haver aprovação:**
- Nenhuma tolerância de divergência é assumida antes da aprovação de Compras e Fiscal. Divergência aparece como divergência, sem "aceitar perto".
- A definição de saldo oficial (V-05) é levantada com evidência e não presumida.
- Nada é gravado no Sankhya.
