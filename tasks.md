# Tasks — Lançamentos Fiscais e Financeiros

| # | Task | Status | Output |
|---|------|--------|--------|
| 1 | Núcleo (tabelas, lookups, SFs) | ✅ done | setup-backend.mjs |
| 2 | Base do frontend (tokens, Layout, api.ts, identidade) | ✅ done | 8 entradas no menu |
| 3 | Painel | ✅ done | / com filtro cruzado |
| 4 | Lançamentos + Detalhe | ✅ done | /lancamentos, /lancamentos/:id |
| 5 | Aprovações | ✅ done | /aprovacoes |
| 6 | Configuração | ✅ done | 8 abas + sincronização |
| 7-9 | Chat: dados, agente de negócio, anexos | ✅ done | add-chat-ia, add-agente-negocio, add-anexos-chat |
| 10 | Assistente | ✅ done | /assistente (IA não testada: sem connection) |
| 11-15 | Sankhya, aprovadores, parceiros, envio, parâmetros, padrão | ✅ done | add-*.mjs + telas |
| 16 | Permissões | ✅ done | perfil Administrador + alcance por tipo |
| 17-18 | Robô e Caixa de entrada | ✅ done | add-robo-email, /caixa-entrada |
| 19 | Recusa do ERP | ✅ done | PainelRecusaErp |
| 20 | Ajuda | ✅ done | /ajuda |
| 21 | Playground | ✅ done | /playground, /estudo/:token |
| 22 | Testes | ✅ done | 12 smokes + motor de leitura, todos passando |
| 23 | Documentação | ✅ done | §18 |
| 4.x | Validações (segurança, SDKs, design, prompt) | ✅ done | featuresearquitetura.md |
| — | Gravação real no ERP | ⛔ bloqueada | desligada na Fase 0; religar exige autorização escrita |
| — | Tabela de sondagem ZZ_PROBE | ✅ mantida | o usuário pediu para não excluir |

## Módulo documental

| # | Task | Status | Output |
|---|------|--------|--------|
| MD-A | Auditoria somente leitura dos parâmetros | ✅ done | auditoria/ |
| MD-P | Proposta de arquitetura | ✅ aprovada com condições | modulo-documental/proposta-arquitetura.md |
| MD-0 | Fase 0: travas de gravação, testes de bloqueio, reversão | ✅ aprovada, com ajustes feitos | modulo-documental/fase0-plano-execucao.md |
| MD-0a | Ajustes: criação de nota temporária, conferência de NF-e, investigação do V-17 | ✅ done | V-17 aberto para business; correção depende de decisão |
| MD-1/2 | Motor de correspondência do piloto TOP 1314 → 1419/1420, só consultas | ✅ primeiro incremento, aguarda revisão | modulo-documental/motor-correspondencia.md |
| MD-1/2b | Próximos incrementos: trilha de conferência, fila de revisão, operação assistida | ⏳ pending | depois da revisão |
| MD-P1 | Matriz de parâmetros e testes isolados | ✅ aguarda aprovação; carga não autorizada | parametros/revisao-parametros.md |
| MD-P2 | Aprovação fail-closed, vínculo pelo login, matriz por operação, testes estáveis | ✅ aguarda revisão | parametros/seguranca-aprovacoes.md |
| MD-1/2c | Classificação do motor, validação retrospectiva, tela e isolamento dos testes | ✅ aguarda revisão | modulo-documental/validacao-classificacao.md, parametros/seguranca-contas.md |
| MD-PA | Piloto assistido somente leitura (20 NF-e ou 5 dias úteis) | ✅ preparado, aguardando documentos | modulo-documental/piloto-operacao.md |
| MD-3/4/5 | Faturamento, piloto e expansão | ⛔ não autorizadas | — |

## Rotina de pedido e pendências (pedido em 06/11/2026: "vamos fazer tudo")

| # | Task | Status | Output |
|---|------|--------|--------|
| RP-1 | Configuração por empresa (TOP pedido/faturamento, tipo de venda, local, ADM) | ✅ done | Configurações → Rotina de pedidos |
| RP-2 | Robô e botão lançam pedido 1314 não confirmado (CACSP.incluirNota, só TIPMOV O) | ✅ done, desligado até configurar | sf/lancarPedidoErp.js |
| RP-3 | Ler confirmação do ADM e liberação no Sankhya (TSILIB evento 44) | ⏳ pending | |
| RP-4 | Faturar depois da liberação, sem confirmar, com número da NF-e | ⏳ pending | validar NUMNOTA na base de teste |
| RP-5 | Anexo PDF/XML na nota: link para o módulo (upload depende da plataforma) | ⏳ pending | decisão do usuário |
| RP-6 | NFS-e e PDF sem itens: produto padrão por fornecedor ou manual | ⏳ pending | decisão do usuário |
| RP-7 | Conferência de NFS-e: "Não se aplica" | ⏳ pending | |
| AC-1 | Acesso pelo usuário e grupo do Sankhya | ✅ done | Configurações → Acesso pelo Sankhya |
| AC-2 | Escopo por loja a partir da empresa do Sankhya | ⏳ pending | |
| AC-3 | Função só de conferência para o agente de IA | ⏳ pending | |
| EX-1 | Senha da frota@, proteção de perfis nas telas, aprovadores reais, dúvidas V-05/V-07 | ⛔ externo | TI, admin do workspace, Diretoria |
