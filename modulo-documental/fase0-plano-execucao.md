# Fase 0 — Contenção: plano de execução e resultado

**Situação:** implementada, publicada e testada em 04/11/2026. Analisada pelo Grupo Lidon, que aprovou a porta única, as travas, os testes e a proibição de confirmação, e pediu os ajustes da seção 0, já feitos.

**Resultado em uma linha:** hoje nenhum caminho do sistema grava no Sankhya. O envio de título, a criação de nota, a correção de cadastro e o envio automático do robô param antes de qualquer chamada ao ERP. Leitura, classificação, alçada e conferência continuam funcionando. Os testes automatizados (112 verificações) comprovam isso no código-fonte, no comportamento isolado, no código publicado e nas funções em produção.

**Fato verificado antes da Fase 0:** a tabela `ERP_ENVIO` tem 0 linhas e nenhum log de execução dos últimos 3 dias cita `saveRecord`. Ou seja, este sistema nunca gravou no Sankhya.

---

## 0. Ajustes depois da análise do Grupo Lidon

| Pedido | O que foi feito |
|---|---|
| A proibição de **confirmar** nota é permanente; a de **criar** nota é temporária | Duas regras separadas. Confirmar: recusa permanente (`CONFIRMACAO_PROIBIDA`), com qualquer trava ligada. Criar: trava própria, `CRIACAO_NOTA_HABILITADA = false` (`CRIACAO_NOTA_BLOQUEADA`), que só religa com serviço oficial homologado e autorização explícita |
| No futuro, faturar pedidos existentes e salvar as notas NÃO CONFIRMADAS; não habilitar agora | Caminho registrado no código e nos documentos, sem nada ativado. Mesmo com as duas travas ligadas, nota não tem caminho de gravação (`FATURAMENTO_NAO_IMPLEMENTADO`): nenhum serviço de faturamento foi cadastrado na porta única. Os testes provam isso em memória |
| Conferência de NF-e integral, somente leitura | Nova conferência: extrai os dados da NF-e, identifica pedidos, compara itens e valores e mostra divergências. Disponível em qualquer situação do lançamento e em uma tela própria (`modulo-documental/motor-correspondencia.md`). Não cria nota, não altera pedido, não gera provisão e não grava neste sistema |
| Investigar V-17 | Resultado na seção 7.1: **o contorno existe para conta de desenvolvedor**; para usuário business, não foi possível testar |

## 1. Escopo autorizado e decisões registradas

| Item | Situação |
|---|---|
| Fase 0: bloquear a criação independente de notas e o envio automático pelo robô | Executada e aprovada, com os ajustes da seção 0 |
| Fases 1 e 2: estrutura, leitura, validação, classificação, correspondência de pedidos e revisão, **só com consultas** ao Sankhya | Em desenvolvimento, autorizadas |
| Fases 3, 4 e 5 | **Não autorizadas** |
| Gravação no ERP de produção | **Não autorizada.** A aprovação da arquitetura não vale como autorização |
| Regra permanente | O sistema nunca confirma nota. A confirmação é exclusivamente manual, por usuário autorizado no Sankhya |
| Regra temporária | O sistema não cria nota, enquanto não houver serviço oficial homologado e autorização explícita |

**D-01, confirmada pelo repositório.** O "projeto externo" é este projeto (repositório deste projeto, branch `main`). Os componentes citados na proposta estão nele:

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
| C5 Criação de nota bloqueada | `CRIACAO_NOTA_HABILITADA = false`. Na porta única, `CabecalhoNota` e `ItemNota` são recusados com `CRIACAO_NOTA_BLOQUEADA`. A conferência de nota só lê e compara com os pedidos | `sf/_erp.js`, `enviarLancamentoParaErp.js` | **Temporária:** serviço oficial homologado e autorização explícita |
| C6 Envio real recusado | Sem `simular`, a função recusa com `GRAVACAO_BLOQUEADA` antes de reservar ou consultar. Se ainda assim chegar à porta única, o lançamento **não** vira ERRO | `enviarLancamentoParaErp.js` | Trava geral |
| C7 Correção de cadastro recusada | Recusa antes de qualquer outra coisa, para qualquer usuário e ação | `corrigirCadastroErp.js` | Trava geral |
| C8 Robô só confere | O robô chama o envio sempre com `simular: 'S'`, valor fixo no código. Novos desfechos: `PRONTO` (conferido, pronto para uma pessoa) e `NOTA_PEDIDO` (nota conferida com os pedidos, só lendo; não é erro) | `sf/_robo.js`, `roboVarrerEmails.js` | **Permanente** (não depende da trava geral) |
| C9 Interface | Detalhe do lançamento: só "Conferir sem gravar". Correção de cadastro e "Criar parceiro" ficam ocultos. Textos da Caixa de entrada, da Ajuda e do Assistente corrigidos. Indicador "Lançados sozinhos" passa a "Prontos para conferência" | `frontend/src/...` | Pela constante da tela (o backend bloqueia de qualquer forma) |
| C10 Agente de negócio | Instruções dizem que a gravação está desligada e que o sistema nunca confirma nota. `enviarLancamentoParaErp` documentada como conferência | `lib/instrucoes-agente.mjs` | — |
| C11 Publicação | `fase0/aplicar.mjs` **recusa publicar** se a trava estiver ligada no código-fonte | `backend/fase0/aplicar.mjs` | — |

**Religar a gravação não está autorizado e não tem atalho.** Exige autorização escrita, uma mudança revisada na linha da trava e um procedimento novo de publicação na fase que autorizar escrita. O script atual se recusa a publicar com qualquer uma das duas travas ligadas.

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

Comando: `cd backend && node _smoke-bloqueio-erp.mjs --vivo`. **Resultado em 04/11/2026, depois dos ajustes: 112 de 112.**

| Parte | O que prova | Verificações |
|---|---|---|
| **A. Código-fonte** | A trava está desligada. O adaptador tem uma única saída de rede. Fora dele, só a caixa de e-mail chama integração, e só com `GET`. Nenhum serviço de gravação é citado fora do adaptador. Nenhuma tela chama integração direto. O robô confere sem gravar. Os scripts avulsos só consultam. Nenhum script religa a trava | 12 |
| **B. Comportamento isolado** | Roda o código **exato** das funções com um SDK falso, sem rede. Se uma trava falhasse, a gravação ficaria registrada no SDK falso e não iria a lugar nenhum. Casos cobertos: as quatro entidades de escrita; serviços de confirmação e serviços desconhecidos (`__proto__`, `constructor`); 12 SQLs de escrita, inclusive escondidos em comentário; envio real com entradas hostis (`simular: 'N'`, `simular: false`, `forcar`, `GRAVACAO_ERP_HABILITADA: true`); nota no envio e na conferência; as três ações de correção de cadastro; uma **rodada real do robô de ponta a ponta**, com caixa de e-mail falsa e o envio rodando por dentro; as guardas da conferência preservadas (aprovação, revisão, rejeitado, sem classificação, já enviado); e a conferência de NF-e com XML hostil (injeção em código e número), sem permissão e pelo lançamento | 54 |
| **B. Prova inversa** | Com a trava ligada **em memória**, o teste enxerga a gravação: prova que o teste detecta. Sem a guarda do envio, a porta única ainda segura. Com a trava geral ligada, nota para na trava temporária; com as duas ligadas, ainda não há caminho de gravação de nota. A confirmação continua recusada com as travas ligadas. O robô e a conferência não gravam nem com as travas ligadas | (dentro das 54) |
| **C. Publicado** | O código no ar é **byte a byte** o código testado em B (as 17 funções e as 2 de SQL). Toda função com o adaptador tem a trava desligada. Nenhuma chama o ERP fora da porta única. As 7 integrações só leem. Pela tabela da plataforma: nenhum JDBC externo, nenhuma função agendada, nenhum gatilho de tabela, nenhuma função pública alcança o ERP | 34 |
| **D. Ao vivo** | As funções publicadas, com CNPJ fictício e entradas preparadas para que, **mesmo sem a trava**, parassem antes de gravar (parceiro inexistente, cidade não informada). Prova: envio real e envio hostil recusados; marcar fornecedor e criar parceiro recusados; lançamento sem mudança de situação e sem chave do ERP; `ERP_ENVIO` igual (0 linhas); a leitura do ERP segue respondendo (27 empresas). Conferência com dados reais: um pedido pendente real é encontrado com as quantidades certas, uma nota real é apontada como duplicada pela chave, e as tabelas do sistema terminam iguais | 12 |

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
| R3 Reversão total | Só com **autorização escrita** do Grupo Lidon para voltar a gravar | `node fase0/reverter.mjs --religa-gravacao-erp --autorizacao "<quem, quando, por qual meio>"` restaura as 17 funções alteradas a partir de `fase0/antes/` e registra a autorização em `fase0/reversoes.log`. Instruções do agente e telas voltam com `git revert` do commit da Fase 0. As 2 funções novas da conferência só leem e ficam como estão | **Sim** |

Sem os dois argumentos, `reverter.mjs` só lista o que restauraria e não altera nada. Como a Fase 0 não mudou dados, não há dado a restaurar. Os desfechos novos (`PRONTO`, `NOTA_PEDIDO`) são só valores novos numa coluna de texto, e as linhas antigas ficaram como estavam.

## 7. Riscos residuais e pendências

### 7.1 V-17: a função de integração do navegador contorna a porta única?

**Conclusão: para conta de desenvolvedor, sim. Para usuário business, não foi possível testar, porque o projeto não tem nenhum.** Nenhuma gravação foi enviada: a sonda (`backend/_smoke-v17.mjs`) só manda `SELECT 1 FROM DUAL` pelo serviço de consulta.

A biblioteca do navegador expõe uma função que chama a rota de integração com conexão, método, endpoint e corpo livres, usando o token da sessão. Ela não passa pelas funções do sistema, portanto não passa pela porta única.

| Quem chama | Resultado da sonda | Leitura |
|---|---|---|
| Sem token | HTTP 403 | Bloqueado |
| Token inválido | HTTP 403 | Bloqueado |
| Conta de desenvolvedor | HTTP 200, **chegou ao ERP** | **Contorno comprovado.** Essa conta também pode alterar as funções, então a porta única nunca foi uma barreira contra ela |
| Usuário business | Não testado | O projeto tem só 2 usuários, ambos desenvolvedores |

**Indícios sobre o business, que não são prova:** as funções do sistema usam essa mesma rota com o token de quem as chama; a lista de bloqueios documentada para business não cita integração; e a biblioteca envia uma prova de execução de função, que permitiria à plataforma distinguir os dois casos, sem que eu saiba se ela exige. **Trate como aberto até testar.**

**Outros pontos verificados:**
- **Sem detecção:** a tabela de log HTTP do projeto está vazia, e essas chamadas não ficam registradas no banco do projeto.
- **Sem controle na integração:** o cadastro da conexão não tem campo que a restrinja às funções do sistema.
- **Contas de desenvolvedor:** são 2, e **uma delas usa um e-mail de domínio descartável**. Vale confirmar de quem é, porque hoje essa conta alcança o ERP.
- **O que a porta única protege:** telas, robô, assistente, agente de negócio e qualquer função do sistema, para qualquer usuário. As SFs de integração com o ERP têm SQL fixo, sem parâmetro de entrada (verificado).

**Correção proposta (nada disto foi executado; depende da sua decisão):**

| # | Correção | Responsável | O que resolve | Teste que comprova |
|---|---|---|---|---|
| 1 | **Definitiva:** trocar o usuário da credencial de integração por um usuário do Sankhya sem permissão de gravar nem de confirmar (V-13, A-12). Quando uma fase autorizar escrita, criar uma segunda conexão, separada e mínima | TI do Grupo Lidon | Bloqueia gravação e confirmação por **qualquer** caminho, inclusive token de desenvolvedor, porque a recusa vem do próprio ERP | Em homologação, um `saveRecord` deve ser recusado pelo ERP. Em produção, a leitura segue funcionando (`_smoke-bloqueio-erp.mjs`, parte D). **Nunca testar gravação em produção** |
| 2 | **Imediata:** revisar as 2 contas de desenvolvedor e substituir a de e-mail descartável | Grupo Lidon | Reduz quem alcança o ERP hoje | Lista de usuários do projeto |
| 3 | **Antes do primeiro usuário business:** rodar a sonda com a conta dele. Se chegar ao ERP, não liberar antes da correção 1 | Quem cria o usuário | Fecha o V-17 | `TOKEN_BUSINESS_TESTE=<token> node _smoke-v17.mjs`: termina com erro se o business alcançar o ERP |
| 4 | Pedir ao suporte da plataforma que a rota de integração, para business, só aceite chamada vinda de função do sistema | Grupo Lidon / suporte | Fecha o caminho na plataforma | A mesma sonda |

Não proponho uma correção dentro do código deste sistema porque ela não existiria de verdade: quem tem o token chama a rota sem passar pelo nosso código.

### 7.2 Outros riscos

| # | Risco | Situação | Mitigação |
|---|---|---|---|
| R-02 | Quem tem acesso de desenvolvedor pode alterar o código das funções, inclusive as travas | Controle de acesso do projeto | Manter o acesso restrito (correção 2). A parte C acusa diferença entre o publicado e o testado: rodar `_smoke-bloqueio-erp.mjs` a cada mudança e periodicamente |
| R-03 | Os perfis nas telas estão desligados no projeto: qualquer usuário do projeto pode executar qualquer função privada | As travas estão **dentro** das funções e valem para qualquer chamador | Nenhuma ação necessária para as travas |
| R-04 | A credencial do Sankhya mantém as permissões atuais no ERP | Não alterada, por restrição | Correção 1 |
| R-05 | Não se sabe se o serviço de consulta do Sankhya recusa comando de escrita. Testar exigiria enviar um, o que é proibido em produção | A porta única só deixa sair `SELECT`/`WITH`. A chamada direta do V-17 não passa por essa checagem | V-18, em homologação. Correção 1 |

**Observação operacional, fora do escopo:** há 2 aprovadores cadastrados sem vínculo com um login do sistema. Enquanto houver aprovador ativo, só quem tem vínculo aprova, então nenhum lançamento acima do limite consegue ser aprovado agora. Os cadastros não foram alterados, conforme a restrição.

## 8. Validação pedida ao Grupo Lidon

1. Abrir um lançamento aprovado: o card mostra "Conferir para o ERP" e só o botão "Conferir sem gravar". A conferência mostra parceiro e campos, e diz que nada foi gravado.
2. Abrir um lançamento de nota fiscal, ou a tela "Conferência de NF-e" com um XML: a conferência mostra pedidos candidatos, quantidades, preços, vínculos e divergências, sem gravar nada.
3. Na Caixa de entrada, conferir os textos e o indicador "Prontos para conferência".
4. Opcional, por quem tem acesso técnico: `cd backend && node _smoke-bloqueio-erp.mjs --vivo` deve terminar em "tudo certo".

## 9. Fases 1 e 2

Em desenvolvimento, só com consultas. Veja `motor-correspondencia.md` e `relatorio-precisao-correspondencia.md`.
