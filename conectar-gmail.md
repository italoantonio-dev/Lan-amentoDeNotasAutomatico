# Conectar a caixa de e-mail (Gmail)

A conexão `gmail` já está na aba de Integrações, esperando três valores. Leva uns 10 minutos, uma vez, com a **conta Google dona da caixa**. A caixa lida é a da conta que autorizar: nenhum endereço fica no código.

## Parte 1 — Gerar as credenciais
1. **Projeto**: console.cloud.google.com, logado na conta da caixa → seletor de projeto → Novo projeto → Criar. Confira que ficou selecionado.
2. **Gmail API**: APIs e serviços → Biblioteca → “Gmail API” → Ativar.
3. **Tela de consentimento**: APIs e serviços → Tela de permissão OAuth → Externo → nome livre, seu e-mail nos contatos → salvar e continuar → Usuários de teste → adicionar o próprio e-mail.
   > Em “Testing”, o Google expira o refresh token em **7 dias**. Para uso contínuo, **Publicar app** nesta tela (o Google pode pedir verificação, porque o escopo é sensível).
4. **Credencial**: Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web → URI de redirecionamento: `https://developers.google.com/oauthplayground` (exatamente assim, sem barra no fim) → Criar. Anote **client id** e **client secret**.
5. **Refresh token**: developers.google.com/oauthplayground → engrenagem → “Use your own OAuth credentials” → cole id e secret → escopo `https://www.googleapis.com/auth/gmail.readonly` → Authorize APIs → escolha a conta → Avançado → Acessar → **Exchange authorization code for tokens** → copie o **Refresh token** (começa com `1//`).

Escopo **somente leitura**: o robô lê e baixa anexos; não envia, não apaga, não marca nada. Revogue quando quiser em myaccount.google.com/permissions.

## Parte 2 — Preencher
- **Pela tela**: Configurações → Integrações → Caixa de e-mail (Gmail) → troque os três `PREENCHER` → salvar.
- **Pelo script** (só para projeto onde a conexão ainda não existe): `cd backend && node add-gmail.mjs "<client_id>" "<client_secret>" "<refresh_token>"`. Ele confere com uma consulta real e mostra o e-mail conectado.

Conectar dá **permissão** de ler, não **ordem** de ler: a caixa só é lida pelo botão Buscar agora ou a pedido no Assistente.

## Parte 3 — Conferir
Caixa de entrada → **Testar conexão** (o selo da tela de Integrações fica vermelho para sempre em conector próprio, e isso não é erro) → mande uma nota para a caixa → **Buscar agora**.

Ajuste o que ler em Caixa de entrada → Ajustes → Busca na caixa. Busca recomendada:
```
has:attachment (filename:xml OR filename:pdf) (nf OR nfe OR "nf-e" OR danfe OR "nota fiscal" OR nota OR notas OR fiscal OR boleto OR fatura OR duplicata OR financeiro OR cobranca OR pagamento) -from:docusign.net
```

## Se der errado
| Mensagem | Causa | Correção |
|---|---|---|
| `redirect_uri_mismatch` | Redirect diferente | Passo 4, URI exata |
| `Gmail API has not been used` | API desligada | Passo 2 |
| `access_denied` | E-mail fora dos usuários de teste | Passo 3 |
| `invalid_grant` depois de dias | Token expirou (app em Testing) | Refazer o passo 5 ou publicar o app |
| `A integracao "gmail" ja existe` | Conexão criada | Trocar a credencial pela tela |
