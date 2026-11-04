# Prompt completo — Contas a pagar automatizado (lançamentos fiscais e financeiros)

> **Como usar:** crie um projeto novo e cole este arquivo inteiro no chat do projeto, ou anexe e
> escreva "construa o sistema descrito neste arquivo". Não é preciso ter senha nenhuma à mão: o
> sistema inteiro é construído antes de qualquer conexão.
>
> Esta é a versão 2. Ela junta o documento original com tudo o que a primeira construção, em produção,
> provou na prática: armadilhas medidas na plataforma, defeitos que só apareceram em teste real e os
> pontos onde a regra de segurança da plataforma muda o que o documento original pedia. **Cada regra
> "estranha" existe porque a alternativa óbvia falhou. Não simplifique nada sem perguntar.**
>
> Ordem de leitura: §0 (o que entregar) → §2 (armadilhas) → §3 (ordem) → §4 (telas) → o resto conforme
> a etapa.

---

## 0. O que é o sistema

Contas a pagar automatizado. Recebe documento fiscal (nota fiscal de entrada, boleto, guia de imposto,
folha de pagamento), lê os campos sozinho, classifica contabilmente, passa por aprovação quando o
valor exige e grava no ERP **Sankhya**.

**Três portas de entrada, mesmas regras:**

| Porta | Quem opera | Onde o documento é lido |
|---|---|---|
| Tela de Lançamentos | Operador | Navegador (pdf.js + tesseract) |
| Chat com o assistente | Operador | Navegador, antes de a IA ver |
| Robô de e-mail | Ninguém | Motor próprio no servidor |

**Nenhuma porta cria caminho paralelo.** As três terminam no mesmo código de duplicidade,
classificação, alçada e envio ao ERP. Na construção de referência isso é um arquivo só
(`backend/sf/_lancamento.js`), embutido nas funções da tela, do chat e do robô.

**Duas camadas:** o **núcleo** não depende de credencial; o **adaptador Sankhya** fala com o ERP só
pela conexão de slug `sankhya`. Construa o núcleo inteiro antes de ter credencial.

**Nenhuma tela inventa dado.** Sem integração, a área dependente mostra "integração não configurada".
Nada de empresa, CNPJ, fornecedor ou parâmetro de exemplo.

### Entrega mínima: as 8 entradas do menu

| # | Menu | Rota | Depende de credencial? |
|---|---|---|---|
| 1 | Painel | `/` | não |
| 2 | Lançamentos | `/lancamentos`, `/lancamentos/:id` | não |
| 3 | **Caixa de entrada** | `/caixa-entrada` | não (simulação) |
| 4 | Aprovações | `/aprovacoes` | não |
| 5 | **Assistente** | `/assistente` | não (relê conversas sem IA) |
| 6 | **Playground** | `/playground`, `/playground/:id` | não (lista e relê sem IA) |
| 7 | Configuração | `/configuracao` | não |
| 8 | Ajuda | `/ajuda` | não |

Mais a rota pública `/estudo/:token` (sem login e sem menu) e `/login`.

Não diga que terminou sem as oito abrindo. Se o trabalho ficar longo, **corte profundidade, nunca
tela**, e liste o que simplificou.

### Projeto novo ou bloco em projeto que já existe
Rode `getProjectContextMitra` e `listTablesMitra`. Havendo tabela além de `INT_USER` ou commit além do
inicial, é **bloco novo**:
- nunca reexecute um setup existente: scripts aditivos (`add-lancamentos-fiscais.mjs`...);
- não toque na rota `/` (prefixo `/fiscal/...`), não troque paleta, fonte nem `Layout`; acrescente
  entradas ao menu e reuse os componentes do projeto;
- confira colisão de nome de tabela e de SF antes de criar. Mesma coisa → reuse e acrescente coluna.
  Outra coisa → prefixo `FIS_` em **todas**. SF com nome repetido → `fiscal<Nome>`. Nunca atualize SF
  que você não criou;
- a identidade "Mitra" vale só para projeto novo.

---

## 1. Não peça credencial nenhuma

Construa tudo e deixe as conexões como tarefa do usuário:

| Conexão | O que você faz agora | O que fica para o usuário |
|---|---|---|
| Sankhya | Cria a conexão `sankhya` (template `sankhya_oauth`) com `PREENCHER` nos três campos, **só se ela não existir** | Trocar pela credencial real na tela de Integrações |
| Gmail | Cria a conexão `gmail` (conector próprio) com `PREENCHER` | Gerar as três credenciais do Google |
| IA | Engrenagem pronta para receber o id da connection | Criar a connection na aba AI |

> **A conexão pode já existir e estar conectada a um ERP de produção com dados reais.** Antes de criar,
> liste as integrações. Se existir, não toque. Leia à vontade, mas **nunca grave no ERP por teste**:
> gravação é irreversível. Teste o envio com o modo `simular` (§7.3).

Não chame `testIntegrationMitra` numa conexão criada com `PREENCHER`. Não termine a entrega com lista
de perguntas: entregue com padrão razoável e deixe as pendências preenchíveis na tela ou no guia.
Nunca pergunte o nome da empresa: o padrão é **Mitra**, e o nome real chega pela logo enviada ou
pela sincronização com o ERP.

### O que o cliente ajusta sem código (nada disso é constante)

| O que | Onde | Padrão | Quem |
|---|---|---|---|
| Corte de leitura do robô | Caixa de entrada → Ajustes | 90 | Administrador |
| Busca na caixa | Caixa de entrada → Ajustes | `has:attachment newer_than:7d` | Administrador |
| Mensagens por rodada | Caixa de entrada → Ajustes | 10 (1 a 50) | Administrador |
| Credencial e ambiente do ERP | Integrações → `sankhya` | `PREENCHER` | Desenvolvedor |
| Qual caixa o robô lê | Integrações → `gmail` | `PREENCHER` | Desenvolvedor |
| Connection e modelo de IA | Engrenagem do Assistente | vazio = credencial pessoal | Administrador |
| TOP, natureza, centro, conta, tipo de título, produto padrão, destino e limite | Configuração → Parâmetros | vazio | Administrador |
| Aprovadores e alçada | Configuração → Aprovadores | vazio | Administrador |
| Quem é administrador | Configuração → Permissões | ninguém (todos entram) | Desenvolvedor marca |
| Tipos de documento que cada usuário vê | Configuração → Permissões | todos | Administrador |
| Empresas e cadastros | Sincronizar com o ERP, ou CRUD manual | vazio | Administrador |

O valor salvo vale na próxima operação: nenhuma SF guarda cópia em memória. A tela mostra o valor em
vigor onde ele decide algo (a Caixa diz "acima de 85% ele lança sozinho" com o número atual). O número
90 aparece **uma vez** no sistema: na semente.

---

## 2. Armadilhas da plataforma — leia antes de codar

Os itens marcados **[medido]** foram confirmados em teste real e contradizem ou completam a
documentação.

### 2.1 Limite de execuções e chamadas aninhadas **[medido]**
O projeto tem 300 execuções de SF por minuto, somando todos os usuários. **Chamada de SF feita por
outra SF também conta**: no minuto em que o limite estourou, 206 de 300 execuções eram aninhadas.
Estourar dá `RATE_LIMIT_EXCEEDED` e a chamada não executa. Consequências obrigatórias:
- trilha gravada **em lote** (`registrarLogsLote`), nunca uma chamada por linha;
- tela de detalhe abre com **uma** SF (`detalheLancamento`, com `JSON_ARRAYAGG` para itens, trilha,
  decisões e envios; ordene no cliente, porque a ordem do `JSON_ARRAYAGG` não é garantida);
- seletores de uma tela vêm de **uma** SF (`listarOpcoesCadastro`, `UNION ALL` de todos os cadastros);
- paginação com `COUNT(*) OVER() AS TOTAL_GERAL` na própria listagem, sem SF de contagem separada;
- envio ao ERP com o mínimo de passos (`erpConcluirEnvio` grava situação, chave e libera a reserva num
  UPDATE só);
- robô com **teto de 10 documentos por rodada** e parada imediata ao receber limite estourado, sem
  marcar a mensagem como lida (§8.5);
- nada de polling curto nem retentativa automática no sistema. Só os scripts de teste esperam 65 s e
  repetem uma vez.

### 2.2 Proteção de parâmetros (bind) **[medido]**
Com a proteção ligada, `{{param}}` em posição de valor vira parâmetro de banco:
- `'{{texto}}'`, `{{numero}}`, `LIKE '%{{busca}}%'`, `LIMIT {{limite}} OFFSET {{offset}}`,
  `'{{v}}' REGEXP '^...$'`, `NULLIF({{x}}, 0)`, `FROM_BASE64('{{b64}}')` funcionam;
- **`JSON_TABLE('{{lista}}', ...)` é bloqueado** (`parse=FAILED; execution blocked`). Lote em uma SF
  só: JSON em base64 e **CTE recursiva**, com o parâmetro aparecendo uma vez:
  ```sql
  INSERT INTO T (A, B)
  WITH RECURSIVE j(d) AS (SELECT CONVERT(FROM_BASE64('{{linhas}}') USING utf8mb4)),
       n(i) AS (SELECT 0 UNION ALL SELECT n.i + 1 FROM n, j WHERE n.i + 1 < JSON_LENGTH(j.d))
  SELECT NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.d, CONCAT('$[', n.i, '].a'))), ''), ...
  FROM n, j WHERE '{{_nonce}}' = '{{_nonce}}'
  ON DUPLICATE KEY UPDATE A = VALUES(A)
  ```
  Não chame com lista vazia (o caso base gera uma linha nula). Blocos de 100 linhas.
- todo texto livre longo (HTML, mensagem, título, conversa) viaja em **base64** e o SQL usa
  `CONVERT(FROM_BASE64('{{x}}') USING utf8mb4)`. Funciona com a proteção ligada e desligada;
- execute toda SF SQL nova uma vez antes de dar como pronta: o bloqueio só aparece na execução.

### 2.3 `_nonce` em toda SF SQL e em toda chamada
Pedido do documento original: a plataforma pode cachear pela assinatura. **[medido]** Hoje dois
INSERTs idênticos gravaram duas linhas, mas o custo é zero: mantenha.
```sql
WHERE '{{_nonce}}' = '{{_nonce}}' AND ...
INSERT INTO T (A) SELECT '{{a}}' FROM DUAL WHERE '{{_nonce}}' = '{{_nonce}}'
```
Frontend: nunca chame `executeServerFunctionMitra` direto. Use `callSF`/`execSF` em `src/lib/api.ts`,
que injeta `_nonce: \`${Date.now()}-${++contador}\``, preenche com `''` os filtros opcionais do mapa
`FILTROS_OPCIONAIS[sfId]` e transforma `FAILED` em exceção legível. Nas SFs JavaScript, cada chamada
interna leva o próprio nonce.

### 2.4 SF JavaScript **[medido]**
- Ambiente: Node 20, `require('mitra-sdk')` já autenticado com o JWT de quem chamou, `zlib`, `crypto`,
  `Buffer`, `Blob` e `File` disponíveis, `process.env.MITRA_PROJECT_ID`. Entrada de 4 MB passa.
  Disponíveis e testados: `executeServerFunctionMitra`, `callIntegrationMitra`, `runQueryMitra`,
  `uploadFilePrivateMitra`, `getFileLinkMitra`, `deleteFileMitra`. `setVariableMitra` não.
- O código fica em **arquivo** (`backend/sf/*.js`) e o script lê do disco: colado num template literal,
  todo `\s` de regex vira `s` e as validações passam a aceitar qualquer coisa.
- **O texto `module.exports` no código muda como a plataforma envolve a função, e o `await` de primeiro
  nível quebra** ("await is only valid in async functions"). Para embutir um módulo, troque
  `module.exports =` por `return` dentro de uma IIFE.
- IDs de SF no código: um placeholder `__SF_MAP__` trocado no deploy pelos ids das SFs citadas como
  `SF.nome` (o script faz a varredura com regex). Id de SF pode ser número fixo; id de projeto nunca.
- Falha da SF chamada vira exceção, nunca resultado vazio. Resposta de negócio volta como
  `{ ok: false, erro }` com status COMPLETED.

### 2.5 Outras **[medido]**
- `runDdlMitra` com `DROP` é **bloqueado sem confirmação do usuário**. Não crie tabela de sondagem:
  teste nas tabelas reais e limpe pelas próprias SFs.
- `createProfileMitra` não devolve o id confiável: releia com `listProfilesMitra`.
- `setProfileUsersMitra` **só acrescenta**. Lista vazia é recusada e não há como retirar um usuário de
  um perfil pela SDK (excluir o perfil limpa todos).
- `setProfileSelectTablesMitra` exige `jdbcConnectionConfigId: 1`.
- `INT_USER` tem `ID`, `DESCR` (e-mail) e **`ISDEV`**: é assim que a tela sabe se quem está logado é
  desenvolvedor.
- `INT_PROFILEUSER (USERID, PROFILEID)` é legível por SF SQL.
- O SDK lança objeto simples; serialize com `JSON.stringify` antes de casar o texto do erro.
- Datas em `VARCHAR(10)`/`VARCHAR(19)`, sem `DEFAULT CURRENT_TIMESTAMP`; carimbo no SQL com
  `DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s')`.
- Nunca importe interface entre arquivos (`verbatimModuleSyntax`): defina local.
- `executeServerFunctionMitra` usa `input`. Colunas voltam em MAIÚSCULAS.
- `executePublicServerFunctionMitra` exige `projectId`; a resposta não tem `.result` e o `output` vem
  como texto JSON. Uma SF JavaScript pública consegue chamar SF SQL privada para quem não tem login.
- Hash aleatório: `LOWER(HEX(RANDOM_BYTES(16)))`, nunca `UUID()`.
- O app usa assets relativos (`base: './'`). Para recarregar uma rota com dois níveis
  (`/estudo/x`, `/lancamentos/12`) sem 404, o `index.html` tem um script que cria
  `<base href="/">` quando o caminho começa por uma rota conhecida.

---

## 3. Regras de segurança da plataforma que mudam o pedido original

São regras que passam na frente do pedido. Aplique e registre a divergência em
`featuresearquitetura.md`.

| Pedido original | O que fazer | Por quê |
|---|---|---|
| `PERMISSOES_USUARIO.ADMINISTRADOR` | Administrador = perfil **"Administrador"** da plataforma. A tabela guarda só o alcance por tipo (`TODOS_OS_TIPOS` + `PERMISSAO_TIPO_DOCUMENTO`) | Papel não fica em tabela própria |
| `consulta_livre` (SF que executa SQL recebido) | **Não existe.** A analista do Playground consulta pelo `runQuery` nativo do agente, que confere cada tabela contra o perfil | SF executora genérica põe o banco na mão de qualquer usuário logado |
| `uploadFilePublicMitra` nos anexos | `uploadFilePrivateMitra`, guardar a **key**, link na hora por `obterLinkArquivo` (5 min) | Arquivo público abre para quem tiver o endereço |
| Variáveis `IA_CONNECTION_ID`/`IA_MODELO` | Tabela `CONFIG_SISTEMA`, gravação só por administrador | Variáveis de projeto descontinuadas |
| SF INTEGRATION com `'event.x'` dentro do SQL do ERP | Só consulta **sem parâmetro** é INTEGRATION. Consulta com parâmetro e toda gravação no ERP ficam em SF JavaScript que valida o valor antes | `'event.x'` não tem bind: com "perfis nas telas" desligado, qualquer usuário chamaria a SF direto com injeção |
| `sankhyaGravarFinanceiro/Nota/ItemNota`, `sankhyaCriarParceiro`, `sankhyaMarcarFornecedor/Cliente`, `sankhyaDuplicidade*` como SFs | Funções internas de `enviarLancamentoParaErp` e `corrigirCadastroErp` (`backend/sf/_erp.js`) | SF de escrita no ERP chamável pela tela pularia todas as guardas |
| Botão de sair | Não existe | A sessão é do workspace da plataforma |
| `uploadFilePublicMitra` no Agent SDK (`send({files})`) | Não usar anexo nativo do chat: o anexo é lido no navegador e vai como texto | Mesmo motivo do arquivo público |

**Toda autoridade está no SQL**, porque com "perfis nas telas" desligado qualquer usuário logado chama
qualquer SF privada com o input que quiser:
- fragmento de administrador, com o estado inicial aberto do documento (enquanto o perfil estiver vazio,
  todos entram):
  ```sql
  (NOT EXISTS (SELECT 1 FROM INT_PROFILEUSER WHERE PROFILEID = <id>)
   OR EXISTS (SELECT 1 FROM INT_PROFILEUSER WHERE USERID = :VAR_USER AND PROFILEID = <id>))
  ```
- fragmento de visibilidade por tipo, em toda leitura de lançamento, trilha, envio e anexo do robô:
  ```sql
  (NOT EXISTS (SELECT 1 FROM PERMISSOES_USUARIO PU WHERE PU.USUARIO_ID = :VAR_USER AND PU.TODOS_OS_TIPOS = FALSE)
   OR D.TIPO_DOCUMENTO_ID IN (SELECT PT.TIPO_DOCUMENTO_ID FROM PERMISSAO_TIPO_DOCUMENTO PT WHERE PT.USUARIO_ID = :VAR_USER))
  ```
- autor e dono sempre `:VAR_USER`; chat e estudo filtrados por `:VAR_USER`;
- escrita recusada pela conferência não dá erro: afeta zero linhas. A tela lê `affectedRows` e diz
  "Sem permissão ou valor inválido — nada foi alterado".

**Risco residual que deve ser documentado:** um usuário logado pode chamar direto `erpRegistrarEnvio` e
`erpConcluirEnvio` e marcar um aprovado como lançado sem gravar no ERP. As SFs aceitam só as transições
`APROVADO|ERRO → LANCADO|ERRO`. Ligar "perfis nas telas" não fecha isso, porque o robô precisa delas.

---

## 4. Ordem de execução

Scripts separados, aditivos e idempotentes: DDL de tabela existente é ignorado, lookup só é populado
vazio, SF é criada **ou atualizada pelo nome** (preserva o id). Execute cada script logo depois de
criá-lo. Toda etapa com tela é obrigatória.

| # | Script / etapa | O que muda na tela |
|---|---|---|
| 1 | `lib/base.mjs` (apoio) + `setup-backend.mjs`: perfis, tabelas do núcleo, integração, permissões e aprovadores, lookups, SFs do núcleo | — |
| 2 | Base do frontend | Tokens, `Layout` com as 8 entradas, `api.ts`, identidade Mitra, favicon, script de `<base>` |
| 3 | — | Painel |
| 4 | — | Lançamentos + Detalhe + upload + `ocr.ts` + `hash.ts` |
| 5 | — | Aprovações |
| 6 | — | Configuração com Empresas, TOPs, Naturezas, Centros, Contas, Parâmetros |
| 7 | `add-chat-ia.mjs` (inclui `CONFIG_SISTEMA`) | — |
| 8 | `add-anexos-chat.mjs` | — |
| 9 | — | Assistente completo (§9) |
| 10 | `add-sankhya.mjs` | "Sincronizar com o ERP" e data da última carga |
| 11 | `add-aprovadores.mjs` + `add-parceiros.mjs` | Aba Aprovadores, busca de fornecedor no ERP, alçada no topo da fila |
| 12 | `add-erp-envio.mjs` | Bloco "Enviar ao ERP", histórico, escolha de parceiro |
| 13 | `add-parametros-erp.mjs` | Destino, tipo de título, produto padrão, "Sugerir do ERP" |
| 14 | `add-padrao-fornecedor.mjs` (inclui `criarLancamentoViaChat`) | Origem da classificação na lista e no detalhe |
| 15 | `add-permissoes.mjs` | Aba Permissões, guarda da rota, abas de Lançamentos pelo que o usuário vê |
| 16 | `robo/leitura.cjs` + `add-robo-email.mjs` (inclui `obterLinkArquivo`) | — |
| 17 | — | Caixa de entrada completa |
| 18 | `add-diagnostico-erp.mjs` | `PainelRecusaErp` |
| 19 | — | Ajuda |
| 20 | `add-playground.mjs` | Playground e estudo público |
| 21 | `add-agente-negocio.mjs` (**sempre por último**: grava a lista inteira de SFs e tabelas dos perfis) | — |
| 22 | `gerar-mapa-sf.mjs` → `frontend/src/lib/sfIds.ts` | O mapa `SF` que `api.ts` reexporta |
| 23 | Smokes do §13 | — |
| 24 | Documentação do §14 | — |

`add-gmail.mjs` e `ligar-varredura.mjs` ficam escritos e documentados, mas quem roda é o usuário.

---

## 5. Modelo de dados (final)

Normalizado. Toda tabela tem comentário com `RETENCAO:` (cadastro, configuração, auditoria: "tudo").

**Núcleo**
- `EMPRESAS(ID, CODEMP UNIQUE, NOME, CNPJ, ATIVO, CRIADO_EM)`
- `TIPOS_DOCUMENTO(ID, CODIGO UNIQUE, DESCRICAO, DESTINO_PADRAO, TIPMOV_ESPERADO)`. Seed:
  `NOTA_FISCAL` (Nota Fiscal de Entrada, NOTA, C), `BOLETO`, `GUIA_IMPOSTO`, `FOLHA_PAGAMENTO`
  (FINANCEIRO, I).
- `STATUS_LANCAMENTO(ID, CODIGO UNIQUE, DESCRICAO, ORDEM)`. Seed: AGUARDANDO_APROVACAO 2, APROVADO 3,
  LANCADO 4, REJEITADO 5, ERRO 6; o robô acrescenta REVISAO_LEITURA 7. **Não crie `EXTRAIDO`.**
- `TOPS(ID, CODTIPOPER UNIQUE, DESCRICAO, ATIVO, TIPMOV, MOVIMENTO, ATUALIZA_FINANCEIRO)`
- `NATUREZAS(ID, CODNAT UNIQUE, ...)`, `CENTROS_RESULTADO(ID, CODCENCUS UNIQUE, ...)`,
  `CONTAS_BANCARIAS(ID, CODCTABCO UNIQUE, DESCRICAO, BANCO, ATIVO)`, `TIPOS_TITULO(ID, CODTIPTIT UNIQUE, ...)`
- `PARAMETROS_LANCAMENTO(ID, EMPRESA_ID, TIPO_DOCUMENTO_ID, TOP_ID, NATUREZA_ID, CENTRO_ID, CONTA_ID,
  LIMITE_APROVACAO, DESTINO_ERP, CODTIPTIT, CODPROD_PADRAO, CRIADO_EM, UNIQUE(EMPRESA_ID, TIPO_DOCUMENTO_ID))`
- `DOCUMENTOS(ID, EMPRESA_ID, TIPO_DOCUMENTO_ID, ARQUIVO_NOME, ARQUIVO_URL /*key privada*/,
  HASH_DOCUMENTO UNIQUE, CRIADO_POR, CRIADO_EM)`
- `LANCAMENTOS(ID, DOCUMENTO_ID FK ON DELETE CASCADE, EMPRESA_ID, CNPJ_FORNECEDOR /*só dígitos*/,
  NOME_FORNECEDOR, CODPARC, NUMERO_DOC, SERIE, DATA_EMISSAO, DATA_VENCIMENTO, VALOR_TOTAL, TOP_ID,
  NATUREZA_ID, CENTRO_ID, CONTA_ID, ORIGEM_CLASSIFICACAO, STATUS_ID, NUNOTA_SANKHYA, NUFIN_SANKHYA,
  ENVIANDO_DESDE /*reserva do envio*/, CRIADO_POR, CRIADO_EM)`
- `LANCAMENTO_ITENS`, `APROVACOES`, `LOG_EXECUCAO`: FK para LANCAMENTOS com `ON DELETE CASCADE`
  (excluir lançamento = apagar o documento e deixar a cascata limpar).
- `SINCRONIZACAO_ERP`, `APROVADORES(CODUSU UNIQUE, NOME, EMAIL, GRUPO, LIMITE_ALCADA NULL, USUARIO_MITRA_ID,
  ATIVO)`, `ERP_ENVIO(LANCAMENTO_ID, DESTINO, CHAVE_ERP, NUMERO_ITENS, STATUS OK|PARCIAL|ERRO, MENSAGEM)`
- `PERMISSOES_USUARIO(USUARIO_ID UNIQUE, TODOS_OS_TIPOS, ATUALIZADO_EM, ATUALIZADO_POR)` (**sem**
  ADMINISTRADOR), `PERMISSAO_TIPO_DOCUMENTO(USUARIO_ID, TIPO_DOCUMENTO_ID, UNIQUE)`

**Chat:** `CHAT_CONVERSA(CHAVE, USUARIO_ID, TITULO, TASK_ID, MODELO, ARQUIVADA, ...)`,
`CHAT_MENSAGEM(CHAVE, CONVERSA_ID, AUTOR, CONTEUDO, SEQUENCIA, STATUS PARCIAL|OK|DESCARTADA)`,
`CHAT_FERRAMENTA_EXEC`, `CHAT_ANEXO(CHAVE, CONVERSA_ID, MENSAGEM_ID, NOME, TIPO_ARQUIVO, TAMANHO,
URL /*key*/, HASH, TEXTO_EXTRAIDO, CAMPOS_JSON, STATUS LIDO|SEM_LEITURA|DUPLICADO|LANCADO, LANCAMENTO_ID)`,
`CONFIG_SISTEMA(CHAVE UNIQUE, VALOR, ATUALIZADO_EM, ATUALIZADO_POR)`.
`CHAVE` é um uuid gerado no cliente: o INSERT não devolve o id, então grava-se com a chave e relê-se
por ela.

**Robô:** `ROBO_CONFIG` (CORTE_CONFIANCA 90, GMAIL_QUERY, MAX_MENSAGENS 10, ATIVO N, INTEGRACAO gmail),
`ROBO_EXECUCAO`, `ROBO_EMAIL(MENSAGEM_ID UNIQUE, ..., PROCESSADO_EM /*só no fim*/)`,
`ROBO_ANEXO(EMAIL_ID, NOME, TIPO, TAMANHO, HASH_DOCUMENTO, ORIGEM_LEITURA, CONFIANCA, CRITERIOS, CAMPOS,
DECISAO, MOTIVO, LANCAMENTO_ID, DOCUMENTO_ID, CHAVE_ERP, ARQUIVO_URL /*key*/)`.

**Playground:** `PLAYGROUND(USUARIO, NOME, HTML LONGTEXT, TASK_ID, SHARE_TOKEN, CHAVE_IA, CONVERSA LONGTEXT,
ATIVO, ...)`, `PLAYGROUND_VERSAO(PLAYGROUND_ID, HTML, CRIADO_EM)`.

---

## 6. Server Functions (nomes finais)

SQL para tudo o que é leitura e escrita simples; JavaScript só para orquestrar.

**Núcleo** (`setup-backend.mjs`): `listarTiposDocumento`, `listarStatusLancamento`;
`listar/criar/atualizar/excluir` para Empresa(s), Top(s), Natureza(s), Centro(s), Conta(s),
TipoTitulo/TiposTitulo (escrita só administrador); `contarEmpresas`; `listarOpcoesCadastro`;
`listarParametros`, `salvarParametro` (upsert), `excluirParametro`, `parametroComEmpresa`;
`verificarDuplicidadeDocumento`, `criarDocumento`, `obterDocumentoPorHash`, `criarLancamento`,
`obterLancamentoPorDocumento`, `criarItemLancamento`, `criarItensLancamento` (lote),
`atualizarItemLancamento`, `listarItensLancamento`, `obterLancamento`, `detalheLancamento`,
`listarLancamentos`, `contarLancamentos`, `atualizarClassificacaoLancamento` (vira MANUAL),
`corrigirDadosLancamento` (reavalia a alçada), `atualizarStatusLancamento` (só APROVADO|ERRO →
LANCADO|ERRO), `excluirLancamento` (quem criou ou administrador; nunca depois de ERP_ENVIO),
`registrarLog`, `registrarLogsLote`, `listarTrilhaLancamento`, `kpisDashboard` (com
TOTAL_PARAMETROS e TOTAL_EMPRESAS para os avisos), `resumoPorStatus`, `resumoPorEmpresa`,
`lancamentosRecentes`.

**A situação inicial é decidida no SQL de `criarLancamento`**, nunca recebida da tela:
`APROVADO` se existe parâmetro com limite > 0 e valor < limite; senão `AGUARDANDO_APROVACAO`;
`REVISAO_LEITURA` se o robô pediu revisão. `corrigirDadosLancamento` usa a mesma regra: mudar o valor
invalida a aprovação anterior.

**Chat** (`add-chat-ia.mjs`, `add-anexos-chat.mjs`): `configIaLer`, `configIaSalvar`,
`chatUsuarioAtual`, `chatCriarConversa`, `chatObterConversa`, `chatListarConversas`
(TOTAL_MENSAGENS sem as descartadas), `chatContarConversas`, `chatVincularTask`, `chatRenomearConversa`,
`chatTocarConversa`, `chatArquivarConversa`, `chatExcluirConversa`, `chatExcluirMensagensConversa`,
`chatExcluirFerramentasConversa`, `chatSalvarMensagem`, `chatAtualizarMensagem`,
`chatObterMensagemPorChave`, `chatListarMensagens`, `chatContarMensagens`, `chatRegistrarFerramenta`,
`chatListarFerramentas`, `chatSalvarAnexo`, `chatObterAnexo`, `chatObterAnexoPorChave`,
`chatListarAnexos` (sem TEXTO_EXTRAIDO), `chatVincularAnexoMensagem`, `chatMarcarAnexoLancado`,
`chatExcluirAnexos`. Ordem de exclusão: anexos → ferramentas → mensagens → conversa.

**Sankhya** (`add-sankhya.mjs`): INTEGRATION sem parâmetro `sankhyaEmpresas`, `sankhyaTops`
(versão vigente), `sankhyaNaturezas`, `sankhyaCentros`, `sankhyaContas`, `sankhyaTiposTitulo`,
`sankhyaUsuarios`; SQL `upsert*` (lote), `codigosCadastroExistentes`, `registrarSincronizacao`,
`ultimaSincronizacao`, `souAdministrador`; JS `sincronizarCadastrosSankhya` (administrador),
`erpVerificarConexao`, `sankhyaProdutos`, `sankhyaCidades`.

**Aprovadores e parceiros:** `listarAprovadores`, `salvarAprovador` (casa o login pelo e-mail no SQL),
`inativarAprovador`, `minhaAlcada`, `listarPendentesAprovacao` (com PODE_APROVAR),
`contarPendentesAprovacao`, `listarAprovacoesLancamento`, `verificarPermissaoAprovacao`,
`gravarDecisaoAprovacao` (situação e alçada no próprio UPDATE), `registrarAprovacao`, JS
`aplicarDecisaoAprovacao`; JS `sankhyaParceiros`, `sankhyaParceiroPorCnpj`, `sankhyaParceiroPorCodigo`;
SQL `parceiroJaEscolhidoParaCnpj`.

**Envio, parâmetros, padrão:** `erpDadosEnvio` (traz ENVIOS_JSON), `listarEnviosLancamento`,
`erpRegistrarEnvio`, `erpReservarEnvio`, `erpConcluirEnvio`, `corrigirDadosLancamentoParceiro`, JS
`enviarLancamentoParaErp`; JS `sankhyaPadroesLancamento`; `padraoLocalFornecedor`, `mapearCodigosErp`,
`keyArquivoDocumento`, `keyArquivoAnexoChat`, JS `sankhyaPadraoFornecedor`,
`resolverClassificacaoLancamento`, `criarLancamentoViaChat` (atende tela e chat pelo campo `origem`).

**Permissões:** `permissoesUsuarioAtual` (ADMINISTRADOR, TOTAL_ADMINS, PERFIL_ADMIN_ID, ISDEV),
`tiposVisiveisUsuario`, `listarUsuariosPermissoes`, `gravarPermissaoUsuario`, `limparTiposUsuario`,
`gravarTiposUsuario`, JS `salvarPermissoesUsuario`.

**Robô:** `roboLerConfig`, `roboSalvarConfig`, `roboKpis`, `roboListarAnexos`, `roboObterAnexo`,
`keyArquivoAnexoRobo`, `roboUltimaExecucao`, `roboCriarExecucao`, `roboObterExecucao`,
`roboConcluirExecucao`, `roboMensagensProcessadas`, `roboRegistrarEmail`, `roboConcluirEmail`,
`roboEmailPorMensagem`, `roboRegistrarAnexo`, `roboEmpresas`; JS `roboTestarCaixa`,
`roboProcessarAnexo` (simulação), `roboVarrerEmails`, `obterLinkArquivo`.

**Diagnóstico:** JS `conferirCadastroErp`, `corrigirCadastroErp` (administrador; grava no ERP).

**Playground:** ver §10.

---

## 7. ERP Sankhya

### 7.1 Leitura
Endpoint `/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`, corpo
`{ serviceName, requestBody: { sql } }`. `callIntegrationMitra` devolve `{ statusCode, body }`; leia
`body.status === '1'` e `body.responseBody.fieldsMetadata` + `rows` (matriz). **[medido]**
- **HTTP 200 com recusa**: erro em `statusMessage`, sem `responseBody`. Sem corpo = falha explícita.
- Oracle 19c; `ROWNUM` antes do `ORDER BY`: ordene em subconsulta. `FETCH FIRST n ROWS ONLY` funciona.
- **O DbExplorer remove `--` mesmo dentro de string**: tire `--` do texto validado.
- Corta em 5.000 linhas (`burstLimit`). Recusa escrita.
- Colunas confirmadas numa base real: `TSIEMP(CODEMP, NOMEFANTASIA, RAZAOSOCIAL, CGC)`,
  `TGFTOP(CODTIPOPER, DESCROPER, TIPMOV, ATIVO, ATUALFIN, DHALTER)` — versionada: 2.881 linhas para 330
  TOPs, filtre `DHALTER = MAX(DHALTER)` por código e deduplique pelo código no upsert;
  `TGFNAT(CODNAT, DESCRNAT, ATIVA)`, `TSICUS(CODCENCUS, DESCRCENCUS, ATIVO)`,
  `TSICTA(CODCTABCOINT, DESCRICAO, CODBCO, ATIVA)`, `TGFTIT(CODTIPTIT, DESCRTIPTIT, ATIVO)`,
  `TSIUSU(CODUSU, NOMEUSU, EMAIL, VLRMAXAUT, CODGRUPO)` — não peça `INTERNO`;
  `TGFPAR(CODPARC, NOMEPARC, RAZAOSOCIAL, CGC_CPF, FORNECEDOR, CLIENTE, ATIVO, TIPPESSOA, CODCID)`,
  `TGFPRO(CODPROD, DESCRPROD, CODVOL, ATIVO)`, `TSICID(CODCID, NOMECID, UF)`.
- Valor que entra no SQL do ERP só depois de validado no JS: número com `parseInt`, CNPJ só dígitos com
  11 ou 14, texto normalizado (sem acento, maiúsculo, só `[A-Z0-9 &./-]`, sem `--`, até 60 caracteres).

### 7.2 Gravação: `CRUDServiceProvider.saveRecord`
`requestBody.dataSet = { rootEntity, includePresentationFields: 'N', dataRow: { localFields:
{ CAMPO: { $: 'valor' } }, key? }, entity: { fieldset: { list: 'CHAVE' } } }`. Sucesso só com
`status = 1` **e** a chave em `responseBody.entities.entity.<CHAVE>.$`. Datas `dd/mm/aaaa`.
Financeiro: `CODEMP, CODPARC, NUMNOTA, DTNEG, DTVENC, VLRDESDOB, RECDESP=-1, CODTIPOPER, DHTIPOPER
(versão vigente da TOP), CODNAT, CODCENCUS, CODTIPTIT, CODCTABCOINT, PROVISAO='N', ORIGEM='F',
DESDOBRAMENTO='1', HISTORICO`. Nota: `CabecalhoNota` (+ TIPMOV 'C', SERIENOTA, CODTIPVENDA da última
nota da mesma TOP e empresa, VLRNOTA) e `ItemNota` (NUNOTA, CODPROD, QTDNEG, VLRUNIT, VLRTOT, CODVOL).
**Esta gravação não foi exercitada contra o ERP de produção na construção de referência.** A primeira
gravação real é feita por uma pessoa, na tela.

### 7.3 `enviarLancamentoParaErp({ lancamentoId, codparc?, simular? })`
Lê tudo do banco (`erpDadosEnvio`), nunca do input. Guardas nesta ordem, cada recusa na trilha:
1. já enviado (`OK`) → devolve a chave existente; `PARCIAL` → recusa (reenviar criaria segunda nota);
2. aguardando aprovação, revisão de leitura ou rejeitado → recusa;
3. classificação incompleta → diz o que falta (TOP, natureza, centro; no financeiro também conta e
   tipo de título);
4. TOP incompatível: `TIPMOV` da TOP ≠ `TIPMOV_ESPERADO` do tipo, ou destino NOTA com TOP que não é `C`;
   a mensagem nomeia os dois movimentos;
5. parceiro: **CNPJ exato**, fornecedor primeiro; escolha da tela revalidada contra o CNPJ; escolha
   anterior de uma pessoa (`LANCAMENTOS.CODPARC`) reaproveitada; sobrando mais de um →
   `{ escolhaParceiro: true, candidatos }`; nenhum → `{ semParceiro: true }`;
6. duplicidade no ERP: `TGFFIN`/`TGFCAB` por empresa + parceiro + `NUMNOTA`; falha na consulta bloqueia;
   documento sem número segue com ATENCAO na trilha;
7. nota sem item e sem produto padrão → recusa.

`simular` passa por todas as guardas e devolve o pedido montado, sem reservar nem gravar. Os smokes e a
simulação do robô usam isso. Envio real: `erpReservarEnvio` (dois cliques não geram dois títulos) →
`saveRecord` → `erpRegistrarEnvio` + `erpConcluirEnvio` + log. Cabeçalho gravado e item recusado =
`PARCIAL`, situação ERRO, não reenviável. **Envio nunca é automático ao aprovar.**

### 7.4 Recusa explicada
`src/lib/diagnosticoErp.ts`: regras por texto (não-fornecedor com "Corrigir cadastro", duplicado,
campo nulo, código inexistente, período fechado, credencial, sem resposta). Filtre `ORA-06512` e
`ORA-04088` da exibição; mensagem desconhecida cai no genérico; marque quando tentar de novo piora.
`conferirCadastroErp` lista requisito a requisito; `corrigirCadastroErp` (administrador) só altera
parceiro que tem o CNPJ do documento, e cria parceiro com nome e cidade (`sankhyaCidades`).

### 7.5 Sugerir do ERP
`sankhyaPadroesLancamento(codemp)`: `TGFFIN`, 24 meses, despesa, `GROUPING SETS` com ranking geral
(`TOP_REF = TODOS`) e dentro de cada TOP, para TOP, natureza, centro, conta e tipo de título. A tela
escolhe a TOP mais usada **da família do tipo** e, dentro dela, natureza, centro, conta e título, e
**mostra a evidência** ("1401 COMPRA - REVENDA — 135 documentos").

---

## 8. Classificação, robô e leitura

### 8.1 Classificação (`resolverClassificacao`)
- A TOP **nunca** é aprendida: vem do parâmetro.
- Natureza, centro e conta, **por dimensão**: histórico local com ≥ 2 lançamentos e ≥ 70% (sem
  rejeitados e sem revisão de leitura); senão histórico do ERP (fornecedor único pelo CNPJ) com ≥ 3
  títulos e ≥ 70%. Falha no ERP não trava: vira ATENCAO na trilha.
- A trilha guarda a contagem ("Natureza 2010000 Produtos para venda herdada do histórico do fornecedor
  no ERP (88 de 91 títulos)"). `ORIGEM_CLASSIFICACAO` = PARAMETRO | PADRAO_HISTORICO | MANUAL.

### 8.2 Criação (`criarLancamentoNucleo`)
Valida empresa, tipo, valor e datas; aceita só key `ai-files/private/...`; hash do conteúdo (sem
arquivo: sha256 dos campos). **Documento já existente sem lançamento é sobra de tentativa interrompida:
retome com ele em vez de travar o arquivo para sempre** (defeito real). Itens em lote, trilha em lote
com a porta em português ("recebido pela tela de Lançamentos / pelo Assistente / pelo robô").

### 8.3 Motor de leitura (`backend/robo/leitura.cjs`, sem dependência externa)
- XML da NF-e pelas tags; PDF descomprimindo `stream ... endstream` com `zlib`; PDF foto cai em zero.
- **Depois de cada stream, avance o cursor para depois de `endstream`**: senão o "stream" dentro de
  "endstream" engole o objeto seguinte (defeito real, some com o ToUnicode).
- Fonte em subconjunto: hexadecimal de 4 dígitos é glifo, traduzido pelo mapa ToUnicode (`bfchar` e
  `bfrange`) de todas as fontes.
- **A chave de 44 zeros passa no módulo 11.** Chave só vale com módulo 11 + UF válida + mês 01–12 +
  modelo 55/65 + CNPJ não nulo; no XML, o CNPJ da chave tem de ser o do emitente.
- Pesos: chave 40 (XML assinado 40, chave que não confere 30), valor rotulado 25 (sem rótulo 10),
  vencimento 15 (XML sem duplicata = à vista, pontua), emissão 10, destinatário 10. A justificativa
  volta critério a critério.
- Quem recebe a nota é a empresa cadastrada; quem emite é o fornecedor.

### 8.4 Decisão do robô
Duplicado (com lançamento) → DUPLICADO; sem empresa → SEM_EMPRESA (fica na caixa com os CNPJs lidos);
confiança < corte → lançamento em REVISAO_LEITURA; ≥ corte e acima da alçada → APROVACAO; ≥ corte e
dentro → envio ao ERP (LANCADO ou ERRO com o motivo). **Na simulação o envio roda com `simular` e o
desfecho é SIMULADO ("lançaria no ERP"): nada é gravado.** O motivo sempre registra o corte usado
("confiança 87 ≥ corte 85"). O corte é lido do banco a cada rodada, com `??`, nunca `||`.

### 8.5 Rodada da caixa (`roboVarrerEmails`)
- **Um parâmetro de consulta por chamada de integração**: com dois, o primeiro é descartado e a API
  devolve a caixa inteira com 200. Limite de quantidade sai no `slice`. Espaço via `params`, nunca `%20`.
- Nunca condicione ao selo da conexão própria (fica vermelho para sempre). Qualquer resposta ≥ 400
  levanta erro com a mensagem real; a tela mostra o motivo, nunca "0 mensagens".
- A mensagem é registrada no início, mas **só conta como lida (`PROCESSADO_EM`) depois de todos os
  anexos**. Limite do projeto estourado no meio → para a rodada, não marca, fica para a próxima.
- Teto de 10 documentos por rodada e 230 s de tempo; status PARCIAL com "clique de novo para continuar".
- Sem `origem` no input é cron: só roda com `ATIVO = 'S'`. A tela manda `BOTAO`, o assistente
  `ASSISTENTE`. Nenhum cron nasce agendado; `ligar-varredura.mjs S|N` liga a cada 30 minutos.
- `roboTestarCaixa` pergunta o perfil (`/gmail/v1/users/me/profile`): é o teste que vale.

### 8.6 Ajustes (`roboSalvarConfig`)
Só `CORTE_CONFIANCA` (`^(100|[0-9]{1,2})$`), `GMAIL_QUERY` (não vazio) e `MAX_MENSAGENS` (1 a 50), com
a validação **e** a conferência de administrador no próprio SQL. `ATIVO` não se liga pela tela. A tela
recusa vazio, texto e decimal antes de chamar.

---

## 9. Assistente

- Sessão: `getAgentTaskMitra({ create: true, projectId, connectionId?, modelId? })`, espalhando só o
  que existe. Eventos: `delta {delta, kind}` (use `kind === 'text'`), `turnEnd {content}`,
  `taskCreated {task}`, `tool {tool, input, content}`, `error {error}`, `cancelled`.
- `agenteDisponivel()` = `window.__mitraEnv?.agentWsUrl`. Sem isso, avise e continue relendo as conversas.
- Persistência: a tela é reconstruída do banco; sessão nova numa conversa antiga recebe o resumo da
  transcrição. Rascunho `PARCIAL` com debounce de 1,2 s promovido na mesma linha a `OK`; turno sem texto
  vira `DESCARTADA`. Ao entrar, retome a conversa mais recente.
- Ferramentas por contrato de texto `<FERRAMENTA>{"nome","args"}</FERRAMENTA>` (aceitar dentro de cerca
  de código), teto de 5 idas e voltas, chip por execução com resultado e duração, resultado vazio =
  "nenhum registro encontrado, diga isso ao usuário — não invente dados". Catálogo: listar_empresas,
  listar_tipos, listar_lancamentos, consultar_lancamento, pendentes_aprovacao, indicadores,
  trilha_lancamento, listar_anexos, buscar_parceiro, criar_lancamento, aprovar_lancamento,
  rejeitar_lancamento, buscar_emails. Enviar ao ERP não é ferramenta.
- Anexos: duplicidade → upload privado → leitura no navegador → `chatSalvarAnexo`; envio bloqueado
  enquanto lê; a IA recebe os campos com CONFERIR; sem `anexoId` e com um pendente, resolve sozinho.
- Engrenagem: lê `configIaLer`, lista modelos com `list_models` **passando o connectionId**, grava por
  `configIaSalvar` (administrador). Lista vazia → campo de texto.
- Ajuda: mesmo SDK, sem ferramenta, o guia (`lib/guiaAjuda.ts`) vai como preâmbulo, com instrução de não
  responder fora dele.

---

## 10. Playground

- **Sem `consulta_livre`.** A analista consulta pelo `runQuery` nativo do agente, limitado às tabelas
  liberadas no perfil. Conversas, estudos, permissões e configuração ficam fora de todos os perfis.
- SFs que a analista chama: `schema_resumo` (sem parâmetro), `playground_salvar_html(playgroundId,
  chave, html)` e `playground_renomear(playgroundId, chave, nome)`. Elas conferem **`CHAVE_IA`** (32
  hexadecimais criados com o estudo): filtrar só pelo ID deixaria qualquer usuário sobrescrever estudo
  alheio, e `:VAR_USER` deixaria a analista sem gravar.
- Internas: `_playground_versionar`, `_playground_gravar_html`, `_playground_gravar_nome` (base64).
- Tela, sempre por `:VAR_USER`: `playground_criar`, `_ultimo`, `_listar`, `_get`, `_set_task`,
  `_salvar_conversa`, `_renomear_dono`, `_excluir` (derruba o link), `_compartilhar`
  (`LOWER(HEX(RANDOM_BYTES(16)))`), `_descompartilhar`, `_versoes`, `_versionar_atual`, `_restaurar`.
- Público: `playground_publico` (JavaScript, `togglePublicExecutionMitra`) valida o token como
  hexadecimal de 32 e chama `_playground_publico_sql`.
- Contexto inteiro na primeira mensagem: id e chave do estudo, ids das SFs lidos do mapa `SF`, tabelas
  e colunas do núcleo, convenções (datas como texto, situações), como comentar cada SQL com
  `/* titulo: ... */`, como desenhar (HTML autônomo, sem script e sem CDN, gráficos em SVG com valores
  reais, cores do sistema) e a proibição de lançar, aprovar ou enviar.
- Tela: canvas `<iframe sandbox="">` e conversa de 400 px, ambas com rolagem própria; empilham abaixo
  de 1100 px. Passos ao vivo pelo evento `tool` (input chega truncado: o parser casa por texto), chamadas
  repetidas viram `×N`, cronômetro depois de 3 s, "Analisando os dados" / "Atualizado às HH:MM",
  esqueleto do resultado como estado vazio, cartão de conexão dentro da conversa quando falta
  credencial, versões e compartilhar com aviso do que fica exposto.

---

## 11. Perfis e agente de negócio (`add-agente-negocio.mjs`, sempre por último)

- Perfis: Administrador (`#15803d`), Operador Financeiro (`#1e40af`), Aprovador (`#b45309`).
- Toda SF de tela entra em pelo menos um perfil (é o que deixa o projeto pronto para ligar "perfis nas
  telas"), incluindo as SFs chamadas por SFs JavaScript.
  - Administrador: todas.
  - Operador: todas menos as de administrador e as de decisão de aprovação.
  - Aprovador: todas menos as de administrador e as de criação.
- Tabelas de leitura iguais para os três: as da operação (lançamentos, documentos, cadastros, parâmetros,
  aprovações, trilha, envios, robô). Nunca chat, Playground nem permissões.
- `additionalBusinessInstructions`: regras de negócio, as SFs que o agente pode usar (com parâmetros),
  "as demais são das telas", regras do Playground e o bloco de identidade obrigatório da plataforma.
  Nada que o agente descobre por consulta nem nada que muda com o uso.

---

## 12. Frontend, UX e design

- React 19 + TS + Vite 7 + Tailwind 4; `recharts`, `lucide-react`, `pdfjs-dist`, `tesseract.js`
  (carregados sob demanda; o tesseract baixa o idioma do CDN na primeira leitura).
- Referência Linear + Stripe, tom claro. `--brand #2E3C50` nas ações; verde `#66CB66` só como acento
  (barra do item ativo, aba ativa, anel de foco, progresso): com texto branco dá 1,7:1. Fundo
  `#f8fafc`, superfície branca, borda `#e2e8f0`, texto `#0f172a`, secundário `#64748b`; receita/pago
  `#2F8F3F`, despesa `#dc2626`, pendente `#d97706`. Os tokens do projeto vêm **depois** do bloco de
  apelidos `--color-*` do template, senão não valem.
- Controles de 40 px: ajuste `Button md`, `Select`, `MultiSelect` e `DatePicker` para
  `h-[var(--altura-controle)]` (o template vem com `h-9` e desalinha da busca).
- Cartões com raio 16 px e `--shadow-md`; nenhum controle nativo; nenhum emoji; ícone fixo por ação;
  português acentuado em todo texto visível, inclusive os códigos da trilha mapeados para rótulos
  (ENTRADA → Entrada, CLASSIFICACAO → Classificação, ALCADA → Alçada...).
- Identidade "Mitra" no `<title>` (`Mitra — Lançamentos Fiscais`), no topo da navegação (pedido
  explícito) e no favicon. Logo do cliente sempre em `public/`. Sem botão de sair.
- Robô em SVG próprio (ocioso, pensando, executando, erro, feliz), botão flutuante que some no Assistente
  e no estudo; conversa com grade de 26 px.
- Microinterações de 120 a 320 ms com `cubic-bezier(0.22, 1, 0.36, 1)`, desligadas em
  `prefers-reduced-motion`.
- Painel: avisos (sem empresa; sem parâmetro → "nada cabe em alçada"), 4 KPIs que navegam, 2 gráficos de
  barras sem rótulo fixo (o rótulo corta no topo) com filtro cruzado e chips, últimos lançamentos.
- Lançamentos: aba por tipo na URL, sem "todos"; busca só depois da aba; vencimento some na nota;
  "Data de apuração" na guia, "Competência" na folha; fornecedor com busca no ERP a partir de 2
  caracteres e 400 ms, texto livre aceito; campos lidos por heurística com selo "conferir".
- Detalhe: dados, classificação (com origem), itens com produto do ERP, trilha; à direita, aprovação,
  enviar ao ERP (confirmação "irreversível", escolha de parceiro, histórico, painel de recusa),
  decisões e excluir.
- Configuração: guarda que espera a resposta do servidor; aviso enquanto ninguém é administrador; "Tornar
  administrador" só para desenvolvedor (`ISDEV`), com a nota de que retirar é na plataforma.
- Estados de carregando, vazio com ação, erro com "Tentar novamente" e sem permissão em toda tela.
- Depois de cada build, abra as telas num navegador (headless serve) e olhe: a validação de cor não pega
  desalinhamento nem corte de rótulo.

---

## 13. Testes (scripts em `backend/`, todos rodando antes de dizer pronto)

Cada smoke monta o próprio cenário e limpa o que criou, mesmo se falhar. **Nenhum grava no ERP.**

| Script | Cobre |
|---|---|
| `robo/_teste-leitura.mjs` | Motor isolado: XML a 100, à vista, chave de zeros, emitente divergente, PDF comprimido, ToUnicode, foto |
| `_smoke-test.mjs` | CRUD, criação, duplicidade por hash, status genérico não aprova, decisão, trilha, detalhe em 1 chamada |
| `_smoke-parametros.mjs` | Limite abaixo/acima/zero, upsert, TOP incompatível, sugestão com TODOS e por TOP |
| `_smoke-padrao.mjs` | Herança local 2 de 2, TOP nunca aprendida, contagem na trilha, disperso fica no parâmetro, apóstrofo não entra no SQL do ERP |
| `_smoke-erp.mjs` / `_smoke-erp-nota.mjs` | Guardas e pedido montado com `simular` |
| `_smoke-parceiro-duplicidade.mjs` | CNPJ repetido real para e pergunta, escolha revalidada, documento existente no ERP barrado |
| `_smoke-aprovadores.mjs` | Vínculo por e-mail, teto, recusa no servidor e na escrita direta, inativar |
| `_smoke-permissoes.mjs` | Não administrador recusado, alcance por tipo na lista e no detalhe |
| `_smoke-ajustes.mjs` | Corte vazio, texto, decimal, −1, 101 recusados; não administrador; a rodada seguinte usa o valor novo |
| `_smoke-chat-ia.mjs` / `_smoke-anexos.mjs` | Base64 com aspas e acento, rascunho promovido, isolamento por usuário, ciclo do anexo, **prova de que o link saiu de SF** (`INT_FILEACCESSLOG.ACCESS_CONTEXT = 'SERVER_FUNCTION'`) |
| `_smoke-robo.mjs` | Desfechos SEM_EMPRESA, APROVACAO, DUPLICADO, parada no parceiro, foto, REVISAO; caixa sem credencial diz o motivo; nenhum ERP_ENVIO criado |
| `_smoke-diagnostico-erp.mjs` | Tradutor (com `node --experimental-strip-types`) e conferência de cadastro |
| `_smoke-playground.mjs` | Sem executor de SQL, perfis sem tabelas sensíveis, chave da analista, versões, link público anônimo, token forjado |

Técnicas que funcionaram:
- **Administrador sem mexer no perfil real:** crie um perfil temporário, acrescente outro usuário, copie
  a SF trocando o id do perfil, execute e apague (a plataforma não retira usuário de perfil).
- **CNPJ fictício válido** para nunca casar com parceiro real.
- **Limite por minuto nos testes:** espere 65 s e repita uma vez. Só nos testes.

---

## 14. Documentação que o projeto deve produzir

`featuresearquitetura.md` (com as divergências do §3, as medições do §2 e o que ficou aberto),
`ux.md`, `design.md` (identidade provisória e as duas formas de trocar), `plano-de-teste.md` (com os
destrutivos por último), `conectar-sankhya.md` (templates de produção e homologação, trocar mantendo o
slug, 401 com credencial de sandbox), `conectar-gmail.md` (projeto, API, consentimento e prazo de 7 dias
em Testing, credencial web com redirect exato, OAuth Playground, escopo `gmail.readonly`, busca em três
camadas), `conectar-assistente.md`, `tasks.md`.

---

## 15. Checklist de entrega

- [ ] 8 entradas abrindo, rota `/` no Painel, `/estudo/:token` pública, `npm run build` limpo
- [ ] Nenhuma SF sem tela que a chame; nenhuma tela chamando SF que não existe
- [ ] `_nonce` em toda SF SQL e toda chamada passando por `callSF`/`execSF`
- [ ] Lote por CTE recursiva; nenhum `JSON_TABLE` com parâmetro
- [ ] Situação inicial e alçada decididas no SQL; nenhum caminho genérico para APROVADO
- [ ] Administrador pelo perfil; alcance por tipo no SQL de toda leitura
- [ ] Arquivo privado e link por `obterLinkArquivo`, com a prova no log de acesso
- [ ] Nenhuma SF INTEGRATION com parâmetro dentro do SQL do ERP; escrita no ERP só nos orquestradores
- [ ] As 7 guardas do envio, reserva contra clique duplo, PARCIAL não reenviável, `simular`
- [ ] Classificação por dimensão, TOP nunca aprendida, contagem na trilha
- [ ] Motor com cursor depois de `endstream`, ToUnicode e chave plausível
- [ ] Robô: um parâmetro por chamada, mensagem lida só no fim, teto por rodada, simulação sem ERP
- [ ] Corte de 0 a 100 validado na tela e no SQL, só administrador, lido do banco a cada rodada
- [ ] Trilha em lote, detalhe em 1 chamada, seletores em 1 chamada
- [ ] Playground sem executor de SQL, com `CHAVE_IA`, versões e link público validado
- [ ] Perfis gravados por último, com SFs e tabelas; instruções do agente com o bloco de identidade
- [ ] Conexões `sankhya` e `gmail` na aba de Integrações; nenhuma credencial em arquivo
- [ ] Nenhum dado de exemplo deixado no banco; smokes limpando o que criam
- [ ] Todos os smokes passando; telas conferidas num navegador
- [ ] Divergências e o que ficou aberto escritos, não escondidos

---

## 16. O que NÃO fazer

- Não crie `EXTRAIDO`, não envie ao ERP ao aprovar, não resolva parceiro por `LIKE` + primeiro da lista.
- Não trate HTTP 200 do Sankhya como sucesso; não grave no ERP por teste.
- Não crie SF que execute SQL recebido, nem SF de escrita no ERP que a tela possa chamar.
- Não use `JSON_TABLE` com parâmetro, `UUID()` para hash, arquivo público, variável de projeto.
- Não escreva `module.exports` dentro do código de SF JavaScript.
- Não faça uma chamada de SF por linha de log, item ou registro de carga.
- Não marque mensagem de e-mail como lida antes de processar os anexos.
- Não condicione nada ao selo de uma conexão própria; não mande dois parâmetros de consulta na mesma
  chamada de integração.
- Não crie tabela de sondagem (o `DROP` exige confirmação do usuário).
- Não use CRUD REST nem `mitra-sdk` nas telas; não importe interface entre arquivos.
- Não pare antes de Caixa de entrada, Assistente e Playground; não termine com lista de perguntas.
