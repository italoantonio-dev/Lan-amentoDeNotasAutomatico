# Contas e perfis: investigação de 05/11/2026

Somente leitura. Nenhum usuário, perfil ou permissão foi alterado ou excluído.

## Achados

| Item | O que é | Evidência | Risco |
|---|---|---|---|
| Usuário 7, "Olimaquinas", `avncxowf@guerrillamailblock.com` | Conta de desenvolvedor e **único membro do perfil Administrador**. É também a identidade da chave de desenvolvimento usada neste projeto | 3.716 execuções de funções e 26 acessos registrados (registro retido por 3 dias). Todas as ações administrativas recentes saíram desta conta | **Crítico.** E-mail descartável: quem acessar a caixa pode recuperar a senha |
| Usuário 8, "Felipe" | Segunda conta de desenvolvedor, com e-mail de fora do Grupo Lidon | Sem execuções nem acessos no período registrado; não está em Administrador | Médio: desenvolvedor tem acesso total ao projeto. Confirmar se deve continuar |
| Perfil "dummy" (id -999) | Perfil interno com id negativo, com todos os usuários | 0 funções, 0 tabelas, 0 telas, 0 ações | **Nenhuma permissão.** Não parece ter sido criado por este projeto. Manter |
| Perfil Administrador (id 2) | 187 funções e 19 tabelas | Só o usuário 7 | Ponto único de falha |
| Perfis Operador Financeiro e Aprovador | 138 e 135 funções, 19 tabelas | Sem usuários | Sem risco hoje |
| Proteção "perfis nas telas" | **Desligada** | Dado do projeto | Enquanto desligada, qualquer usuário business executa toda função privada. Ligar é do administrador do workspace |

## O que a conta de desenvolvedor alcança
Mudar qualquer função, chamar a integração com o Sankhya direto (ver V-17), administrar perfis e usuários. A trava de gravação vale nas funções do sistema, não para quem pode editar essas funções.

## Migração proposta (nada executado)
1. O Grupo Lidon define a conta corporativa, de preferência com login corporativo e segundo fator, e uma segunda pessoa de contingência.
2. Convidar a conta como desenvolvedor e incluir no perfil Administrador, com autorização sua.
3. A nova conta entra e confere: Configuração, Usuários e Aprovadores.
4. Pedir ao suporte da plataforma a troca da identidade da chave de desenvolvimento para a conta corporativa. **Antes disso, não remova o usuário 7**: scripts e testes rodam com ele.
5. Depois de um período de observação, trocar a senha do usuário 7, retirá-lo de Administrador pela interface e remover o acesso.
6. Revisar a permanência do usuário 8.
7. Pedir ao administrador do workspace a ligação de "perfis nas telas" antes do primeiro usuário business.

## V-17: integração acessível pelo navegador
Sonda rodada de novo, enviando só `SELECT 1`.

| Quem chama | Resultado |
|---|---|
| Sem token | HTTP 403, não chegou ao ERP |
| Token inválido | HTTP 403, não chegou ao ERP |
| Desenvolvedor | HTTP 200, **chegou ao ERP** |
| Usuário business | **Não testado:** o projeto não tem usuário business, e criar um alteraria usuários reais |

**Conclusão:** para desenvolvedor, a rota contorna a porta única. A trava do servidor não impede esse caminho, e o código do sistema não consegue fechá-lo. As telas não usam essa função (nenhuma ocorrência em `frontend/src`). A correção definitiva é um usuário de integração no Sankhya sem permissão de gravar nem de confirmar (V-13) e o bloqueio da rota para business pela plataforma. Antes de habilitar qualquer escrita, isso precisa estar resolvido.
